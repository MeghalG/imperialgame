/**
 * submitBid.js — Server-side pure game logic for bidding, extracted from submitAPI.js.
 *
 * All functions are pure: they take a gameState (and supporting data) as input
 * and mutate gameState in place. No Firebase I/O.
 */

const { MODES } = require('../shared/gameConstants');
const helper = require('../shared/helper');
const { incrementCountry, buyStock, changeLeadership } = require('./submitHelpers');

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates in-place shuffle.
 *
 * @param {any[]} array - Array to shuffle (mutated in place).
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

// ---------------------------------------------------------------------------
// Stock-below helper (pure replacement for helper.getStockBelow)
// ---------------------------------------------------------------------------

/**
 * Find the highest available stock a player can afford.
 *
 * This is a pure replacement for `helper.getStockBelow`, which reads setup
 * data from Firebase. Here the stock cost mapping is passed in directly.
 *
 * @param {number} money       - Amount of money the player has available.
 * @param {object} countryInfo - Country info object (needs `availStock` array).
 * @param {object} stockCosts  - Map of stock value to cost, e.g. `{ 2: 2, 4: 6, ... }`.
 * @returns {number} The highest affordable stock value, or 0 if none.
 */
function getStockBelowPure(money, countryInfo, stockCosts) {
  let availStock = countryInfo.availStock || [];
  if (availStock.length === 0) return 0;
  let sorted = [...availStock].sort((a, b) => b - a);
  for (let stock of sorted) {
    if (stockCosts[stock] <= money) {
      return stock;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Bid ordering
// ---------------------------------------------------------------------------

/**
 * Sort players by descending bid amount with random tiebreaking, and record
 * a history entry listing bids in order.
 *
 * @param {object} gameState - Full game state (mutated in place).
 */
function setBidBuyOrder(gameState) {
  let p = Object.keys(gameState.playerInfo);
  shuffle(p);
  let players = [];
  for (let elt of p) {
    if (gameState.playerInfo[elt].bid !== undefined) {
      players.push(elt);
    }
  }
  players.sort((a, b) => gameState.playerInfo[b].bid - gameState.playerInfo[a].bid);
  gameState.bidBuyOrder = players;
  let a = players.map((x) => x + ' bidding $' + gameState.playerInfo[x].bid);
  let s = a.join(', ');
  gameState.history.push(
    'The ' + gameState.countryUp + ' bids in order were ' + s + '.'
  );
}

// ---------------------------------------------------------------------------
// End-of-bidding logic
// ---------------------------------------------------------------------------

/**
 * Handle the end of a bid/buy round for a country.
 *
 * If there are more countries to bid on and at least one player can afford a
 * $2 bid, advances to the next country's BID mode. Otherwise, determines
 * final player order, assigns the investor card, sets up the Swiss banking
 * set, and increments to the first country's proposal turn.
 *
 * @param {object}   gameState - Full game state (mutated in place).
 * @param {string}   country   - The country whose bid round just finished.
 * @param {string[]} countries - Ordered array of all country names.
 */
function doneBuying(gameState, country, countries) {
  let players = Object.keys(gameState.playerInfo);
  for (let i in players) {
    delete gameState.playerInfo[players[i]].bid;
  }
  if (country !== 'Russia') {
    let existsB = false;
    for (let i in players) {
      let b = false;
      let money = gameState.playerInfo[players[i]].money;
      if (money >= 2) {
        b = true;
        existsB = true;
      }
      gameState.playerInfo[players[i]].myTurn = b;
    }
    if (existsB) {
      let index = countries.indexOf(country);
      let newCountry = countries[(index + 1) % countries.length];
      gameState.countryUp = newCountry;
      gameState.mode = MODES.BID;
      return;
    }
  }
  let t = [];
  for (let key in gameState.playerInfo) {
    t.push([gameState.playerInfo[key].money, key]);
  }
  shuffle(t);
  t.sort((a, b) => b[0] - a[0]);
  for (let i in t) {
    gameState.playerInfo[t[i][1]].order = parseInt(i) + 1;
  }
  gameState.playerInfo[t[0][1]].investor = true;
  if (!gameState.swissSet) {
    gameState.swissSet = [];
  }
  let permSwiss = helper.getPermSwiss(gameState);
  for (let i in permSwiss) {
    gameState.swissSet.push(permSwiss[i]);
  }
  incrementCountry(gameState, countries);
}

// ---------------------------------------------------------------------------
// Next buyer selection
// ---------------------------------------------------------------------------

/**
 * Find the next buyer in the bid-buy order, or finalize the round.
 *
 * Peeks at the first player in `bidBuyOrder`. If they can afford any
 * available stock (via `getStockBelowPure`), activates their turn.
 * Otherwise calls `doneBuying` to wrap up.
 *
 * @param {object}   gameState  - Full game state (mutated in place).
 * @param {string}   country    - Country being bid on.
 * @param {string[]} countries  - Ordered array of all country names.
 * @param {object}   stockCosts - Map of stock value to cost.
 */
function setNextBuyer(gameState, country, countries, stockCosts) {
  let money = 0;
  let player = '';
  if (gameState.bidBuyOrder.length > 0) {
    player = gameState.bidBuyOrder[0];
    money = gameState.playerInfo[player].bid;
  }
  let stockBelow = getStockBelowPure(money, gameState.countryInfo[country], stockCosts);
  if (stockBelow === 0) {
    player = '';
  }
  if (!player) {
    doneBuying(gameState, country, countries);
  } else {
    gameState.playerInfo[player].myTurn = true;
  }
}

// ---------------------------------------------------------------------------
// Bid-buy action (highest bidder buys or passes)
// ---------------------------------------------------------------------------

/**
 * Process the highest bidder's buy-or-pass decision.
 *
 * If the player accepts, purchases the highest affordable stock at their bid
 * price, updates leadership, and logs the action. If declined, logs the pass.
 * Then advances to the next buyer or finishes the round.
 *
 * @param {object}   gameState  - Full game state (mutated in place).
 * @param {object}   setup      - Setup data (needs `stockCosts`).
 * @param {object}   params     - Action parameters.
 * @param {string}   params.playerName - Name of the acting player.
 * @param {boolean}  params.accept     - Whether the player accepts the stock.
 * @param {string[]} countries  - Ordered array of all country names.
 */
function bidBuyLogic(gameState, setup, params, countries) {
  gameState.sameTurn = false;
  let country = gameState.countryUp;
  let bid = gameState.playerInfo[params.playerName].bid;
  let stockCosts = setup.stockCosts;
  let stock = getStockBelowPure(bid, gameState.countryInfo[country], stockCosts);

  if (params.accept) {
    buyStock(gameState, params.playerName, { country: country, stock: stock }, bid, countries);
    changeLeadership(gameState, country, params.playerName);
    gameState.history.push(
      params.playerName + ' buys the ' + country + ' ' + stock + '.'
    );
  } else {
    gameState.history.push(
      params.playerName + ' declines the ' + country + ' ' + stock + '.'
    );
  }
  delete gameState.playerInfo[params.playerName].bid;
  gameState.bidBuyOrder.splice(0, 1);
  gameState.playerInfo[params.playerName].myTurn = false;

  setNextBuyer(gameState, country, countries, stockCosts);
  gameState.undo = params.playerName;
}

// ---------------------------------------------------------------------------
// Bid submission
// ---------------------------------------------------------------------------

/**
 * Record a player's bid and, if all players have bid, transition to buy-bid
 * mode with the bid-buy order set.
 *
 * @param {object}   gameState  - Full game state (mutated in place).
 * @param {object}   params     - Action parameters.
 * @param {string}   params.playerName - Name of the bidding player.
 * @param {number}   params.bidAmount  - The bid amount in dollars.
 * @param {string[]} countries  - Ordered array of all country names.
 * @param {object}   stockCosts - Map of stock value to cost.
 */
function bidLogic(gameState, params, countries, stockCosts) {
  gameState.sameTurn = false;
  let country = gameState.countryUp;

  gameState.playerInfo[params.playerName].bid = params.bidAmount;
  gameState.playerInfo[params.playerName].myTurn = false;
  gameState.history.push(
    params.playerName + ' has submitted a bid for ' + country + '.'
  );

  let doneBidding = true;
  for (let key in gameState.playerInfo) {
    if (gameState.playerInfo[key].myTurn) {
      doneBidding = false;
    }
  }
  gameState.sameTurn = true;
  if (doneBidding) {
    gameState.sameTurn = false;
    gameState.mode = MODES.BUY_BID;
    setBidBuyOrder(gameState);
    setNextBuyer(gameState, country, countries, stockCosts);
  }
  gameState.undo = params.playerName;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  shuffle,
  getStockBelowPure,
  setBidBuyOrder,
  doneBuying,
  setNextBuyer,
  bidBuyLogic,
  bidLogic,
};
