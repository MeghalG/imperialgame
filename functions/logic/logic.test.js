/**
 * logic.test.js — Jest tests for Cloud Functions game logic modules.
 */

const { MODES, GOV_TYPES, PUNT_BUY } = require('../shared/gameConstants');
const submitHelpers = require('./submitHelpers');
const { submitBuyLogic } = require('./submitBuy');
const { bidLogic, bidBuyLogic, getStockBelowPure, doneBuying } = require('./submitBid');
const { newGameLogic, undoLogic } = require('./gameAdmin');

// ---------------------------------------------------------------------------
// Helpers to build mock state
// ---------------------------------------------------------------------------

function makePlayer(overrides = {}) {
  return {
    money: 10,
    stock: [],
    myTurn: false,
    investor: false,
    swiss: false,
    order: 1,
    scoreModifier: 0,
    banked: 300,
    ...overrides,
  };
}

function makeCountry(overrides = {}) {
  return {
    money: 0,
    availStock: [2, 4, 6, 9],
    leadership: [],
    gov: GOV_TYPES.DEMOCRACY,
    offLimits: false,
    points: 0,
    lastTax: 0,
    factories: [],
    fleets: [],
    armies: [],
    ...overrides,
  };
}

function makeGameState(overrides = {}) {
  return {
    playerInfo: {
      Alice: makePlayer({ myTurn: true, order: 1 }),
      Bob: makePlayer({ order: 2 }),
    },
    countryInfo: {
      Austria: makeCountry({ leadership: ['Alice'] }),
      Italy: makeCountry({ leadership: ['Bob'] }),
      France: makeCountry(),
      England: makeCountry(),
      Germany: makeCountry(),
      Russia: makeCountry(),
    },
    countryUp: 'Austria',
    round: 1,
    mode: MODES.PROPOSAL,
    sameTurn: false,
    history: [],
    timer: { timed: false, pause: 0, lastMove: 0, increment: 0 },
    swissSet: null,
    undo: null,
    ...overrides,
  };
}

const COUNTRIES = ['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia'];
const STOCK_COSTS = { 2: 2, 4: 6, 6: 12, 9: 20 };

// ===========================================================================
// submitHelpers
// ===========================================================================

describe('submitHelpers', () => {
  // -----------------------------------------------------------------------
  // adjustTime
  // -----------------------------------------------------------------------
  describe('adjustTime', () => {
    test('deducts time from banked when remaining is positive', () => {
      const gs = makeGameState({
        timer: { timed: true, pause: 0, lastMove: 5000, increment: 10 },
      });
      gs.playerInfo.Alice.banked = 300;
      // serverTime=10000 -> ti = 300*1000 - 10000 + 10*1000 + 5000 = 305000 > 0
      submitHelpers.adjustTime('Alice', gs, 10000);
      expect(gs.playerInfo.Alice.banked).toBeLessThanOrEqual(300);
      expect(gs.playerInfo.Alice.scoreModifier).toBe(0);
    });

    test('applies score penalty and resets banked to 60 when time goes negative', () => {
      const gs = makeGameState({
        timer: { timed: true, pause: 0, lastMove: 1000, increment: 0 },
      });
      gs.playerInfo.Alice.banked = 5; // 5 seconds banked
      // serverTime=100000 -> ti = 5*1000 - 100000 + 0 + 1000 = -94000 < 0
      submitHelpers.adjustTime('Alice', gs, 100000);
      expect(gs.playerInfo.Alice.banked).toBe(60);
      expect(gs.playerInfo.Alice.scoreModifier).toBe(-1);
    });

    test('uses pause value instead of serverTime when pause is non-zero', () => {
      const gs = makeGameState({
        timer: { timed: true, pause: 2000, lastMove: 1000, increment: 5 },
      });
      gs.playerInfo.Alice.banked = 100;
      // time = pause = 2000, ti = 100*1000 - 2000 + 5*1000 + 1000 = 104000
      submitHelpers.adjustTime('Alice', gs, 999999);
      // Should use pause=2000 not serverTime
      expect(gs.playerInfo.Alice.scoreModifier).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // handleTimer
  // -----------------------------------------------------------------------
  describe('handleTimer', () => {
    test('does nothing for untimed games', () => {
      const gs = makeGameState();
      gs.timer.timed = false;
      const oldState = JSON.parse(JSON.stringify(gs));
      submitHelpers.handleTimer(gs, oldState, 50000, 'Alice');
      expect(gs.playerInfo.Alice.banked).toBe(300);
    });

    test('debits time from myTurn player on normal turn', () => {
      const gs = makeGameState({
        timer: { timed: true, pause: 0, lastMove: 1000, increment: 5 },
      });
      gs.playerInfo.Alice.banked = 200;
      gs.playerInfo.Alice.myTurn = true;
      gs.sameTurn = false;
      const oldState = JSON.parse(JSON.stringify(gs));
      submitHelpers.handleTimer(gs, oldState, 5000, 'Bob');
      // Alice had myTurn=true in oldState, so her time was adjusted
      expect(gs.timer.lastMove).toBe(5000);
      expect(gs.timer.pause).toBe(0);
    });

    test('debits submitter on sameTurn action', () => {
      const gs = makeGameState({
        timer: { timed: true, pause: 0, lastMove: 1000, increment: 5 },
      });
      gs.playerInfo.Bob.banked = 200;
      gs.sameTurn = true;
      const oldState = JSON.parse(JSON.stringify(gs));
      submitHelpers.handleTimer(gs, oldState, 5000, 'Bob');
      // sameTurn=true, so Bob (submitter) is debited
      expect(gs.timer.pause).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // incrementCountry
  // -----------------------------------------------------------------------
  describe('incrementCountry', () => {
    test('advances to the next country in order', () => {
      const gs = makeGameState();
      gs.countryUp = 'Austria';
      gs.countryInfo.Italy.leadership = ['Bob'];
      submitHelpers.incrementCountry(gs, COUNTRIES);
      expect(gs.countryUp).toBe('Italy');
      expect(gs.mode).toBe(MODES.PROPOSAL);
      expect(gs.playerInfo.Bob.myTurn).toBe(true);
    });

    test('wraps around and increments round', () => {
      const gs = makeGameState();
      gs.countryUp = 'Russia';
      gs.round = 1;
      gs.countryInfo.Austria.leadership = ['Alice'];
      submitHelpers.incrementCountry(gs, COUNTRIES);
      expect(gs.countryUp).toBe('Austria');
      expect(gs.round).toBe(2);
    });

    test('skips countries with no leadership (falsy)', () => {
      const gs = makeGameState();
      gs.countryUp = 'Austria';
      gs.countryInfo.Italy.leadership = null; // no leader -> skipped
      gs.countryInfo.France.leadership = ['Bob'];
      submitHelpers.incrementCountry(gs, COUNTRIES);
      expect(gs.countryUp).toBe('France');
    });

    test('skips countries with null leadership', () => {
      const gs = makeGameState();
      gs.countryUp = 'Austria';
      gs.countryInfo.Italy.leadership = null;
      gs.countryInfo.France.leadership = ['Bob'];
      submitHelpers.incrementCountry(gs, COUNTRIES);
      expect(gs.countryUp).toBe('France');
    });

    test('sets all players myTurn to false except the new leader', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.myTurn = true;
      gs.playerInfo.Bob.myTurn = true;
      gs.countryUp = 'Austria';
      gs.countryInfo.Italy.leadership = ['Bob'];
      submitHelpers.incrementCountry(gs, COUNTRIES);
      expect(gs.playerInfo.Alice.myTurn).toBe(false);
      expect(gs.playerInfo.Bob.myTurn).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // buyStock
  // -----------------------------------------------------------------------
  describe('buyStock', () => {
    test('transfers stock from country to player and money from player to country', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.money = 20;
      gs.countryInfo.Austria.availStock = [2, 4, 6, 9];
      gs.countryInfo.Austria.money = 0;

      submitHelpers.buyStock(gs, 'Alice', { country: 'Austria', stock: 4 }, 6, COUNTRIES);

      expect(gs.playerInfo.Alice.money).toBe(14);
      expect(gs.countryInfo.Austria.money).toBe(6);
      expect(gs.playerInfo.Alice.stock).toContainEqual({ country: 'Austria', stock: 4 });
      expect(gs.countryInfo.Austria.availStock).not.toContain(4);
    });

    test('initializes stock array if player has none', () => {
      const gs = makeGameState();
      delete gs.playerInfo.Alice.stock;

      submitHelpers.buyStock(gs, 'Alice', { country: 'Austria', stock: 2 }, 2, COUNTRIES);
      expect(gs.playerInfo.Alice.stock).toEqual([{ country: 'Austria', stock: 2 }]);
    });

    test('does nothing if stock not in availStock', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.money = 20;
      gs.countryInfo.Austria.availStock = [2, 6];

      submitHelpers.buyStock(gs, 'Alice', { country: 'Austria', stock: 4 }, 6, COUNTRIES);
      expect(gs.playerInfo.Alice.money).toBe(20); // unchanged
    });
  });

  // -----------------------------------------------------------------------
  // returnStock
  // -----------------------------------------------------------------------
  describe('returnStock', () => {
    test('returns stock to country available pool and refunds money', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 4 }];
      gs.playerInfo.Alice.money = 10;
      gs.countryInfo.Austria.availStock = [2, 6];
      gs.countryInfo.Austria.money = 20;

      submitHelpers.returnStock(gs, 'Alice', { country: 'Austria', stock: 4 }, 6);

      expect(gs.playerInfo.Alice.stock).toEqual([]);
      expect(gs.playerInfo.Alice.money).toBe(16);
      expect(gs.countryInfo.Austria.money).toBe(14);
      expect(gs.countryInfo.Austria.availStock).toContain(4);
    });

    test('bond-0 stocks are removed but not returned to pool, no money exchange', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 0 }];
      gs.playerInfo.Alice.money = 10;
      gs.countryInfo.Austria.availStock = [2, 6];
      gs.countryInfo.Austria.money = 20;

      submitHelpers.returnStock(gs, 'Alice', { country: 'Austria', stock: 0 }, 0);

      expect(gs.playerInfo.Alice.stock).toEqual([]);
      expect(gs.playerInfo.Alice.money).toBe(10); // unchanged
      expect(gs.countryInfo.Austria.money).toBe(20); // unchanged
      expect(gs.countryInfo.Austria.availStock).not.toContain(0);
    });

    test('handles stock not found gracefully', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 2 }];
      gs.playerInfo.Alice.money = 10;
      gs.countryInfo.Austria.availStock = [];
      gs.countryInfo.Austria.money = 20;

      submitHelpers.returnStock(gs, 'Alice', { country: 'Austria', stock: 9 }, 20);
      // stock 9 not found, but availStock still gets it pushed and money still moves
      expect(gs.countryInfo.Austria.availStock).toContain(9);
      expect(gs.playerInfo.Alice.money).toBe(30);
    });
  });

  // -----------------------------------------------------------------------
  // changeLeadership
  // -----------------------------------------------------------------------
  describe('changeLeadership', () => {
    test('sets dictatorship when one player owns >= 50% of stock', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.stock = [
        { country: 'Austria', stock: 9 },
        { country: 'Austria', stock: 6 },
      ];
      gs.playerInfo.Bob.stock = [{ country: 'Austria', stock: 2 }];
      gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];

      submitHelpers.changeLeadership(gs, 'Austria', 'Alice');

      expect(gs.countryInfo.Austria.gov).toBe(GOV_TYPES.DICTATORSHIP);
      expect(gs.countryInfo.Austria.leadership[0]).toBe('Alice');
    });

    test('sets democracy when no single player owns >= 50%', () => {
      const gs = makeGameState();
      // Alice=4, Bob=6, Charlie=4 => total=14, max=6 => 2*6=12 < 14 => democracy
      gs.playerInfo.Charlie = makePlayer();
      gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 4 }];
      gs.playerInfo.Bob.stock = [{ country: 'Austria', stock: 6 }];
      gs.playerInfo.Charlie.stock = [{ country: 'Austria', stock: 4 }];
      gs.countryInfo.Austria.leadership = ['Alice', 'Bob', 'Charlie'];

      submitHelpers.changeLeadership(gs, 'Austria', 'Alice');

      expect(gs.countryInfo.Austria.gov).toBe(GOV_TYPES.DEMOCRACY);
      // Bob has most stock, should be first in leadership
      expect(gs.countryInfo.Austria.leadership[0]).toBe('Bob');
    });

    test('adds player to leadership if not already present', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 4 }];
      gs.playerInfo.Bob.stock = [];
      gs.countryInfo.Austria.leadership = ['Alice'];

      submitHelpers.changeLeadership(gs, 'Austria', 'Bob');

      expect(gs.countryInfo.Austria.leadership).toContain('Bob');
    });

    test('initializes empty leadership array when null', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 9 }];
      gs.countryInfo.Austria.leadership = null;

      submitHelpers.changeLeadership(gs, 'Austria', 'Alice');

      expect(gs.countryInfo.Austria.leadership).toContain('Alice');
      expect(gs.countryInfo.Austria.gov).toBe(GOV_TYPES.DICTATORSHIP);
    });
  });

  // -----------------------------------------------------------------------
  // roundMoney
  // -----------------------------------------------------------------------
  describe('roundMoney', () => {
    test('rounds player and country money to 2 decimal places', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.money = 10.005;
      gs.playerInfo.Bob.money = 7.999;
      gs.countryInfo.Austria.money = 3.1415;
      gs.countryInfo.Italy.money = 0.1 + 0.2; // classic float issue

      submitHelpers.roundMoney(gs);

      expect(gs.playerInfo.Alice.money).toBe(10.01);
      expect(gs.playerInfo.Bob.money).toBe(8);
      expect(gs.countryInfo.Austria.money).toBe(3.14);
      expect(gs.countryInfo.Italy.money).toBe(0.3);
    });
  });
});

// ===========================================================================
// submitBuy
// ===========================================================================

describe('submitBuyLogic', () => {
  const setup = { stockCosts: STOCK_COSTS };
  const playersInOrder = ['Alice', 'Bob'];

  test('buys stock, deducts money, marks country offLimits', () => {
    const gs = makeGameState();
    gs.playerInfo.Alice.money = 20;
    gs.playerInfo.Alice.myTurn = true;
    gs.playerInfo.Alice.swiss = true;
    gs.playerInfo.Bob.swiss = true; // Bob still needs to buy, so not lastBuy
    gs.countryInfo.Austria.availStock = [2, 4, 6, 9];

    submitBuyLogic(gs, setup, {
      playerName: 'Alice',
      buyCountry: 'Austria',
      buyStock: 4,
      returnStock: 'None',
    }, COUNTRIES, playersInOrder);

    expect(gs.playerInfo.Alice.money).toBe(14);
    expect(gs.countryInfo.Austria.offLimits).toBe(true);
    expect(gs.playerInfo.Alice.myTurn).toBe(false);
    expect(gs.playerInfo.Alice.swiss).toBe(false);
  });

  test('punt buy adds player to swissSet', () => {
    const gs = makeGameState();
    gs.playerInfo.Alice.myTurn = true;
    gs.playerInfo.Alice.swiss = true;
    gs.playerInfo.Bob.swiss = true; // Bob still needs to buy, so not lastBuy

    submitBuyLogic(gs, setup, {
      playerName: 'Alice',
      buyCountry: PUNT_BUY,
      buyStock: null,
      returnStock: null,
    }, COUNTRIES, playersInOrder);

    expect(gs.swissSet).toContain('Alice');
  });

  test('advances to next country when last buy is done', () => {
    const gs = makeGameState();
    gs.playerInfo.Alice.myTurn = true;
    gs.playerInfo.Alice.swiss = true;
    gs.playerInfo.Alice.investor = true;
    gs.playerInfo.Bob.swiss = false;
    gs.playerInfo.Alice.money = 20;
    gs.countryInfo.Austria.availStock = [2, 4, 6, 9];
    gs.countryInfo.Italy.leadership = ['Bob'];

    submitBuyLogic(gs, setup, {
      playerName: 'Alice',
      buyCountry: 'Austria',
      buyStock: 2,
      returnStock: 'None',
    }, COUNTRIES, playersInOrder);

    // Alice was the only swiss buyer, so this should be the last buy
    expect(gs.mode).toBe(MODES.PROPOSAL);
  });

  test('passes turn to next swiss player when not last buy', () => {
    const gs = makeGameState();
    gs.playerInfo.Alice.myTurn = true;
    gs.playerInfo.Alice.swiss = true;
    gs.playerInfo.Bob.swiss = true;
    gs.playerInfo.Alice.money = 20;
    gs.countryInfo.Austria.availStock = [2, 4, 6, 9];

    submitBuyLogic(gs, setup, {
      playerName: 'Alice',
      buyCountry: 'Austria',
      buyStock: 2,
      returnStock: 'None',
    }, COUNTRIES, playersInOrder);

    expect(gs.playerInfo.Bob.myTurn).toBe(true);
  });

  test('records history entry with return stock info', () => {
    const gs = makeGameState();
    gs.playerInfo.Alice.money = 20;
    gs.playerInfo.Alice.myTurn = true;
    gs.playerInfo.Alice.swiss = true;
    gs.playerInfo.Bob.swiss = true; // Bob still needs to buy
    gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 2 }];
    gs.countryInfo.Austria.availStock = [4, 6, 9];

    submitBuyLogic(gs, setup, {
      playerName: 'Alice',
      buyCountry: 'Austria',
      buyStock: 4,
      returnStock: 2,
    }, COUNTRIES, playersInOrder);

    const lastHistory = gs.history[gs.history.length - 1];
    expect(lastHistory).toContain('returning the');
  });
});

// ===========================================================================
// submitBid
// ===========================================================================

describe('submitBid', () => {
  // -----------------------------------------------------------------------
  // getStockBelowPure
  // -----------------------------------------------------------------------
  describe('getStockBelowPure', () => {
    test('returns highest affordable stock', () => {
      const countryInfo = { availStock: [2, 4, 6, 9] };
      expect(getStockBelowPure(12, countryInfo, STOCK_COSTS)).toBe(6);
    });

    test('returns 0 when player cannot afford any stock', () => {
      const countryInfo = { availStock: [2, 4, 6, 9] };
      expect(getStockBelowPure(1, countryInfo, STOCK_COSTS)).toBe(0);
    });

    test('returns 0 when availStock is empty', () => {
      const countryInfo = { availStock: [] };
      expect(getStockBelowPure(100, countryInfo, STOCK_COSTS)).toBe(0);
    });

    test('returns 0 when availStock is undefined', () => {
      const countryInfo = {};
      expect(getStockBelowPure(100, countryInfo, STOCK_COSTS)).toBe(0);
    });

    test('returns the only affordable stock', () => {
      const countryInfo = { availStock: [2] };
      expect(getStockBelowPure(5, countryInfo, STOCK_COSTS)).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // bidLogic
  // -----------------------------------------------------------------------
  describe('bidLogic', () => {
    test('records bid amount and marks player as no longer their turn', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.myTurn = true;
      gs.playerInfo.Bob.myTurn = true;
      gs.mode = MODES.BID;

      bidLogic(gs, { playerName: 'Alice', bidAmount: 5 }, COUNTRIES, STOCK_COSTS);

      expect(gs.playerInfo.Alice.bid).toBe(5);
      expect(gs.playerInfo.Alice.myTurn).toBe(false);
      expect(gs.sameTurn).toBe(true); // Bob still needs to bid
    });

    test('transitions to buy-bid mode when all bids are in', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.myTurn = false;
      gs.playerInfo.Alice.bid = 3;
      gs.playerInfo.Bob.myTurn = true;
      gs.mode = MODES.BID;
      gs.countryInfo.Austria.availStock = [2, 4, 6, 9];

      bidLogic(gs, { playerName: 'Bob', bidAmount: 7 }, COUNTRIES, STOCK_COSTS);

      expect(gs.mode).toBe(MODES.BUY_BID);
      expect(gs.sameTurn).toBe(false);
      expect(gs.bidBuyOrder).toBeDefined();
      expect(gs.bidBuyOrder.length).toBe(2);
    });

    test('adds history entry for each bid', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.myTurn = true;
      gs.playerInfo.Bob.myTurn = true;

      bidLogic(gs, { playerName: 'Alice', bidAmount: 5 }, COUNTRIES, STOCK_COSTS);

      expect(gs.history.length).toBe(1);
      expect(gs.history[0]).toContain('Alice');
      expect(gs.history[0]).toContain('bid');
    });
  });

  // -----------------------------------------------------------------------
  // bidBuyLogic
  // -----------------------------------------------------------------------
  describe('bidBuyLogic', () => {
    test('accepts bid: buys stock, updates leadership, records history', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.bid = 10;
      gs.playerInfo.Alice.myTurn = true;
      gs.playerInfo.Alice.money = 20;
      gs.countryInfo.Austria.availStock = [2, 4, 6, 9];
      gs.bidBuyOrder = ['Alice', 'Bob'];
      gs.playerInfo.Bob.bid = 5;

      const setup = { stockCosts: STOCK_COSTS };
      bidBuyLogic(gs, setup, { playerName: 'Alice', accept: true }, COUNTRIES);

      // Alice bid 10, highest affordable stock with 10 is 4 (cost 6)
      expect(gs.playerInfo.Alice.stock.length).toBeGreaterThan(0);
      expect(gs.history[gs.history.length - 1]).toContain('buys');
      expect(gs.bidBuyOrder[0]).toBe('Bob'); // Alice removed
    });

    test('declines bid: records decline, moves to next buyer', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.bid = 10;
      gs.playerInfo.Alice.myTurn = true;
      gs.playerInfo.Alice.money = 20;
      gs.countryInfo.Austria.availStock = [2, 4, 6, 9];
      gs.bidBuyOrder = ['Alice', 'Bob'];
      gs.playerInfo.Bob.bid = 5;

      const setup = { stockCosts: STOCK_COSTS };
      bidBuyLogic(gs, setup, { playerName: 'Alice', accept: false }, COUNTRIES);

      expect(gs.history[gs.history.length - 1]).toContain('declines');
      expect(gs.playerInfo.Alice.myTurn).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // doneBuying
  // -----------------------------------------------------------------------
  describe('doneBuying', () => {
    test('advances to next country bid if not Russia and players can afford $2', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.bid = 5;
      gs.playerInfo.Bob.bid = 3;
      gs.playerInfo.Alice.money = 10;
      gs.playerInfo.Bob.money = 10;
      gs.countryUp = 'Austria';

      doneBuying(gs, 'Austria', COUNTRIES);

      expect(gs.countryUp).toBe('Italy');
      expect(gs.mode).toBe(MODES.BID);
      expect(gs.playerInfo.Alice.bid).toBeUndefined();
    });

    test('finishes bidding at Russia regardless of money', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.bid = 5;
      gs.playerInfo.Bob.bid = 3;
      gs.playerInfo.Alice.money = 100;
      gs.playerInfo.Bob.money = 100;
      gs.countryUp = 'Russia';
      // Need a country with leadership for incrementCountry
      gs.countryInfo.Austria.leadership = ['Alice'];

      doneBuying(gs, 'Russia', COUNTRIES);

      // Should have assigned investor and advanced to proposal
      expect(gs.mode).toBe(MODES.PROPOSAL);
    });

    test('assigns player order by descending money', () => {
      const gs = makeGameState();
      gs.playerInfo.Alice.bid = 5;
      gs.playerInfo.Bob.bid = 3;
      gs.playerInfo.Alice.money = 5;
      gs.playerInfo.Bob.money = 20;
      gs.countryUp = 'Russia';
      gs.countryInfo.Austria.leadership = ['Alice'];

      doneBuying(gs, 'Russia', COUNTRIES);

      // Bob has more money, should get order 1
      expect(gs.playerInfo.Bob.order).toBe(1);
      expect(gs.playerInfo.Alice.order).toBe(2);
      expect(gs.playerInfo.Bob.investor).toBe(true);
    });
  });
});

// ===========================================================================
// gameAdmin
// ===========================================================================

describe('gameAdmin', () => {
  // -----------------------------------------------------------------------
  // newGameLogic
  // -----------------------------------------------------------------------
  describe('newGameLogic', () => {
    test('creates game with correct number of players and starting money', () => {
      const template = {
        playerInfo: {
          player: { money: 0, stock: [], myTurn: false, scoreModifier: 0 },
        },
        timer: { timed: false, lastMove: 0 },
        history: [],
      };

      const result = newGameLogic(template, {
        newGameID: 'game1',
        newGamePlayers: ['Alice', 'Bob', 'Charlie'],
      }, 1000);

      expect(Object.keys(result.playerInfo)).toEqual(['Alice', 'Bob', 'Charlie']);
      // 61 / 3 = 20.33
      const expectedMoney = parseFloat((61 / 3).toFixed(2));
      expect(result.playerInfo.Alice.money).toBe(expectedMoney);
      expect(result.playerInfo.Bob.money).toBe(expectedMoney);
      expect(result.playerInfo.Charlie.money).toBe(expectedMoney);
    });

    test('deep clones player template so players do not share references', () => {
      const template = {
        playerInfo: {
          player: { money: 0, stock: [{ country: 'Austria', stock: 2 }], myTurn: false },
        },
        timer: { timed: false, lastMove: 0 },
        history: [],
      };

      const result = newGameLogic(template, {
        newGameID: 'game1',
        newGamePlayers: ['Alice', 'Bob'],
      }, 1000);

      // Modify Alice's stock and ensure Bob's is not affected
      result.playerInfo.Alice.stock.push({ country: 'Italy', stock: 4 });
      expect(result.playerInfo.Bob.stock.length).toBe(1);
    });

    test('skips falsy player entries', () => {
      const template = {
        playerInfo: {
          player: { money: 0, stock: [], myTurn: false },
        },
        timer: { timed: false, lastMove: 0 },
        history: [],
      };

      const result = newGameLogic(template, {
        newGameID: 'game1',
        newGamePlayers: ['Alice', '', null, 'Bob'],
      }, 1000);

      expect(Object.keys(result.playerInfo)).toEqual(['Alice', 'Bob']);
      // 61 / 2 = 30.5
      expect(result.playerInfo.Alice.money).toBe(30.5);
    });

    test('sets lastMove to serverTime for timed games', () => {
      const template = {
        playerInfo: {
          player: { money: 0, stock: [], myTurn: false },
        },
        timer: { timed: true, lastMove: 0, banked: 300 },
        history: [],
      };

      const result = newGameLogic(template, {
        newGameID: 'game1',
        newGamePlayers: ['Alice'],
      }, 5000);

      expect(result.timer.lastMove).toBe(5000);
      expect(result.playerInfo.Alice.banked).toBe(300);
    });

    test('records history entry with player names', () => {
      const template = {
        playerInfo: {
          player: { money: 0, stock: [], myTurn: false },
        },
        timer: { timed: false, lastMove: 0 },
        history: [],
      };

      const result = newGameLogic(template, {
        newGameID: 'game1',
        newGamePlayers: ['Alice', 'Bob'],
      }, 1000);

      expect(result.history[0]).toContain('Alice, Bob');
      expect(result.history[0]).toContain('begun');
    });
  });

  // -----------------------------------------------------------------------
  // undoLogic
  // -----------------------------------------------------------------------
  describe('undoLogic', () => {
    test('restores state and updates timer lastMove', () => {
      const historyState = {
        mode: MODES.BID,
        countryUp: 'Austria',
        timer: { timed: true, lastMove: 1000 },
        sameTurn: true,
        playerInfo: { Alice: makePlayer() },
      };

      const result = undoLogic(historyState, 9000);

      expect(result.timer.lastMove).toBe(9000);
      expect(result.sameTurn).toBe(false);
      expect(result.mode).toBe(MODES.BID);
    });

    test('clears sameTurn flag', () => {
      const historyState = {
        timer: { lastMove: 0 },
        sameTurn: true,
      };

      const result = undoLogic(historyState, 5000);
      expect(result.sameTurn).toBe(false);
    });
  });
});
