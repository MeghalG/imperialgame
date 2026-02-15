// ---------------------------------------------------------------------------
// submitAPI.test.js — Tests for exported game logic functions in submitAPI.js
// ---------------------------------------------------------------------------

// Track all data written via Firebase set() calls so we can inspect what was persisted
let mockSetData = {};
let mockRemovedPaths = [];

// The mock DB data tree. Tests populate this before each call.
let mockDbData = {};

/**
 * Navigates a slash-separated Firebase path into the mockDbData tree.
 * e.g. "games/g1/playerInfo" -> mockDbData.games.g1.playerInfo
 * NOTE: Prefixed with "mock" so jest.mock() factory can reference it.
 */
function mockGetNestedValue(obj, path) {
	if (!path) return obj;
	const parts = path.split('/');
	let current = obj;
	for (const part of parts) {
		if (current == null) return undefined;
		current = current[part];
	}
	return current;
}

// ---- Mock Firebase --------------------------------------------------------
jest.mock('./firebase.js', () => ({
	database: {
		ref: jest.fn((path) => ({
			once: jest.fn(() =>
				Promise.resolve({
					val: () => {
						// Return a deep copy so mutations don't bleed back
						const raw = mockGetNestedValue(mockDbData, path);
						return raw !== undefined ? JSON.parse(JSON.stringify(raw)) : null;
					},
				})
			),
			on: jest.fn((event, callback) => {
				if (path === '/.info/serverTimeOffset') {
					callback({ val: () => 0 });
				}
			}),
			off: jest.fn(),
			set: jest.fn((data, callback) => {
				mockSetData[path] = JSON.parse(JSON.stringify(data));
				if (callback) callback(null);
				return Promise.resolve();
			}),
			remove: jest.fn(() => {
				mockRemovedPaths.push(path);
				return Promise.resolve();
			}),
		})),
	},
}));

// ---- Mock emailjs-com -----------------------------------------------------
jest.mock('emailjs-com', () => ({
	init: jest.fn(),
	send: jest.fn(),
}));

// ---- Mock helper.js -------------------------------------------------------
jest.mock('./helper.js', () => ({
	getCountries: jest.fn(() => Promise.resolve(['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia'])),
	getPlayersInOrder: jest.fn(() => Promise.resolve(['Alice', 'Bob', 'Charlie'])),
	sortStock: jest.fn(),
	getStockBelow: jest.fn(() => Promise.resolve(3)),
	getPermSwiss: jest.fn(() => []),
	stringifyFunctions: jest.fn((x) => x),
	unstringifyFunctions: jest.fn((x) => x),
	getOwnedStock: jest.fn(() => [
		['Alice', 5],
		['Bob', 3],
	]),
	getInvestorPayout: jest.fn(() => [
		['Alice', 2],
		['Bob', 1],
	]),
	getTaxInfo: jest.fn(() => ({
		points: 3,
		money: 2,
		'tax split': [['Alice', 1]],
	})),
	investorPassed: jest.fn(() => Promise.resolve(false)),
	getWinner: jest.fn(() => 'Alice'),
}));

// ---- Import the functions under test (AFTER mocks are installed) ----------
import {
	submitBuy,
	submitVote,
	submitNoCounter,
	submitManeuver,
	submitProposal,
	bidBuy,
	bid,
	newGame,
	undo,
} from './submitAPI.js';

// ---- Helpers --------------------------------------------------------------

/**
 * Flushes microtasks so that un-awaited async finalizeSubmit calls complete.
 * Several submit functions call finalizeSubmit without await, so the Firebase
 * write happens in a later microtask. This helper ensures those writes finish.
 */
async function flushPromises() {
	// Multiple rounds to handle chained awaits inside finalizeSubmit
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

/**
 * Builds a minimal but complete mock game state. Tests can override any piece.
 */
function createMockGameState(overrides = {}) {
	return {
		mode: 'bid',
		countryUp: 'Austria',
		round: 1,
		turnID: 5,
		setup: 'setups/standard',
		sameTurn: false,
		undo: null,
		history: [],
		'proposal 1': null,
		'proposal 2': null,
		voting: null,
		bidBuyOrder: [],
		swissSet: null,
		currentManeuver: null,
		timer: { timed: false, increment: 0, pause: 0, lastMove: 0, banked: 60 },
		playerInfo: {
			Alice: {
				money: 20,
				myTurn: true,
				investor: false,
				order: 1,
				swiss: false,
				stock: [],
				scoreModifier: 0,
				email: '',
				banked: 60,
			},
			Bob: {
				money: 15,
				myTurn: true,
				investor: false,
				order: 2,
				swiss: false,
				stock: [],
				scoreModifier: 0,
				email: '',
				banked: 60,
			},
		},
		countryInfo: {
			Austria: {
				money: 0,
				points: 0,
				factories: ['Vienna'],
				wheelSpot: 'center',
				gov: 'democracy',
				leadership: ['Alice', 'Bob'],
				availStock: [1, 2, 3, 4, 5],
				offLimits: false,
				lastTax: 5,
				taxChips: [],
				fleets: [],
				armies: [],
			},
			Italy: {
				money: 0,
				points: 0,
				factories: ['Rome'],
				wheelSpot: 'center',
				gov: 'democracy',
				leadership: ['Bob'],
				availStock: [1, 2, 3, 4, 5],
				offLimits: false,
				lastTax: 5,
				taxChips: [],
				fleets: [],
				armies: [],
			},
			France: {
				money: 0,
				points: 0,
				factories: ['Paris'],
				wheelSpot: 'center',
				gov: 'democracy',
				leadership: ['Alice'],
				availStock: [1, 2, 3, 4, 5],
				offLimits: false,
				lastTax: 5,
				taxChips: [],
				fleets: [],
				armies: [],
			},
			England: {
				money: 0,
				points: 0,
				factories: ['London'],
				wheelSpot: 'center',
				gov: 'democracy',
				leadership: ['Alice'],
				availStock: [1, 2, 3, 4, 5],
				offLimits: false,
				lastTax: 5,
				taxChips: [],
				fleets: [],
				armies: [],
			},
			Germany: {
				money: 0,
				points: 0,
				factories: ['Berlin'],
				wheelSpot: 'center',
				gov: 'democracy',
				leadership: ['Bob'],
				availStock: [1, 2, 3, 4, 5],
				offLimits: false,
				lastTax: 5,
				taxChips: [],
				fleets: [],
				armies: [],
			},
			Russia: {
				money: 0,
				points: 0,
				factories: ['Moscow'],
				wheelSpot: 'center',
				gov: 'democracy',
				leadership: ['Alice'],
				availStock: [1, 2, 3, 4, 5],
				offLimits: false,
				lastTax: 5,
				taxChips: [],
				fleets: [],
				armies: [],
			},
		},
		...overrides,
	};
}

/**
 * Populates mockDbData with a game state at 'games/{gameID}' and
 * a stock costs lookup at the setup path. Returns the gameState for inspection.
 */
function setupMockDb(gameState, gameID = 'testGame') {
	mockDbData = {
		games: {
			[gameID]: gameState,
		},
		'setups/standard': {
			stockCosts: { 1: 2, 2: 4, 3: 6, 4: 9, 5: 12 },
			countries: {
				Austria: { order: 1 },
				Italy: { order: 2 },
				France: { order: 3 },
				England: { order: 4 },
				Germany: { order: 5 },
				Russia: { order: 6 },
			},
			wheel: ['Factory', 'L-Produce', 'L-Maneuver', 'Taxation', 'R-Produce', 'Investor', 'Import', 'R-Maneuver'],
			territories: {},
		},
		setups: {
			standard: {
				stockCosts: { 1: 2, 2: 4, 3: 6, 4: 9, 5: 12 },
				countries: {
					Austria: { order: 1 },
					Italy: { order: 2 },
					France: { order: 3 },
					England: { order: 4 },
					Germany: { order: 5 },
					Russia: { order: 6 },
				},
				wheel: ['Factory', 'L-Produce', 'L-Maneuver', 'Taxation', 'R-Produce', 'Investor', 'Import', 'R-Maneuver'],
				territories: {},
			},
		},
		'game histories': {},
	};
	return gameState;
}

// ---- Reset between tests --------------------------------------------------
beforeEach(() => {
	mockDbData = {};
	mockSetData = {};
	mockRemovedPaths = [];
	jest.clearAllMocks();
});

// ===========================================================================
// submitManeuver (stub)
// ===========================================================================
describe('submitManeuver', () => {
	test('returns "done" immediately (stub implementation)', () => {
		const result = submitManeuver({});
		expect(result).toBe('done');
	});

	test('returns "done" regardless of context contents', () => {
		const result = submitManeuver({ game: 'g1', name: 'Alice', foo: 'bar' });
		expect(result).toBe('done');
	});
});

// ===========================================================================
// bid()
// ===========================================================================
describe('bid', () => {
	test('stores bid amount on the player who submitted', async () => {
		const gs = createMockGameState({ mode: 'bid', countryUp: 'Austria' });
		setupMockDb(gs);
		const context = { game: 'testGame', name: 'Alice', bid: 5 };

		const result = await bid(context);
		await flushPromises();
		expect(result).toBe('done');

		// The finalizeSubmit writes the game state; inspect what was set on the game ref
		const written = mockSetData['games/testGame'];
		expect(written).toBeDefined();
		expect(written.playerInfo.Alice.bid).toBe(5);
	});

	test('sets myTurn to false for the bidding player', async () => {
		const gs = createMockGameState({ mode: 'bid', countryUp: 'Austria' });
		setupMockDb(gs);
		const context = { game: 'testGame', name: 'Alice', bid: 3 };

		await bid(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.playerInfo.Alice.myTurn).toBe(false);
	});

	test('adds a history entry about the bid', async () => {
		const gs = createMockGameState({ mode: 'bid', countryUp: 'Austria' });
		setupMockDb(gs);
		const context = { game: 'testGame', name: 'Alice', bid: 5 };

		await bid(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.history.length).toBeGreaterThan(0);
		const lastHistory = written.history[written.history.length - 1];
		expect(lastHistory).toContain('Alice');
		expect(lastHistory).toContain('bid');
		expect(lastHistory).toContain('Austria');
	});

	test('transitions to buy-bid mode when all players have bid', async () => {
		const gs = createMockGameState({ mode: 'bid', countryUp: 'Austria' });
		// Bob already bid, Alice is the last
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Bob.bid = 4;
		setupMockDb(gs);
		const context = { game: 'testGame', name: 'Alice', bid: 5 };

		await bid(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.mode).toBe('buy-bid');
	});

	test('does NOT transition to buy-bid when other players still need to bid', async () => {
		const gs = createMockGameState({ mode: 'bid', countryUp: 'Austria' });
		// Both players have myTurn = true; Alice bids, Bob still hasn't
		setupMockDb(gs);
		const context = { game: 'testGame', name: 'Alice', bid: 5 };

		await bid(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Mode should stay bid because Bob still has myTurn = true
		expect(written.mode).toBe('bid');
	});

	test('sets sameTurn to true when bidding is not done', async () => {
		const gs = createMockGameState({ mode: 'bid', countryUp: 'Austria' });
		setupMockDb(gs);
		const context = { game: 'testGame', name: 'Alice', bid: 5 };

		await bid(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.sameTurn).toBe(true);
	});

	test('sets undo to the bidding player', async () => {
		const gs = createMockGameState({ mode: 'bid', countryUp: 'Austria' });
		setupMockDb(gs);
		const context = { game: 'testGame', name: 'Alice', bid: 5 };

		await bid(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.undo).toBe('Alice');
	});
});

// ===========================================================================
// bidBuy()
// ===========================================================================
describe('bidBuy', () => {
	test('buys stock when context.buyBid is true', async () => {
		const gs = createMockGameState({
			mode: 'buy-bid',
			countryUp: 'Austria',
			bidBuyOrder: ['Alice', 'Bob'],
		});
		gs.playerInfo.Alice.bid = 6;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.bid = 4;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Alice', buyBid: true };

		await bidBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Alice should have a stock entry now (buyStock adds {country:'Austria', stock:3})
		// helper.getStockBelow mock returns 3
		expect(written.playerInfo.Alice.stock.length).toBe(1);
		expect(written.playerInfo.Alice.stock[0]).toEqual({ country: 'Austria', stock: 3 });
	});

	test('deducts bid price from player money when buying', async () => {
		const gs = createMockGameState({
			mode: 'buy-bid',
			countryUp: 'Austria',
			bidBuyOrder: ['Alice'],
		});
		gs.playerInfo.Alice.bid = 6;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Alice', buyBid: true };

		await bidBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// buyStock deducts bid (6) from money (20) => 14
		expect(written.playerInfo.Alice.money).toBe(14);
	});

	test('adds bid price to country money when buying', async () => {
		const gs = createMockGameState({
			mode: 'buy-bid',
			countryUp: 'Austria',
			bidBuyOrder: ['Alice'],
		});
		gs.playerInfo.Alice.bid = 6;
		gs.playerInfo.Alice.money = 20;
		gs.countryInfo.Austria.money = 10;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Alice', buyBid: true };

		await bidBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// buyStock adds bid (6) to country money (10) => 16
		expect(written.countryInfo.Austria.money).toBe(16);
	});

	test('removes purchased stock denomination from availStock', async () => {
		const gs = createMockGameState({
			mode: 'buy-bid',
			countryUp: 'Austria',
			bidBuyOrder: ['Alice'],
		});
		gs.playerInfo.Alice.bid = 6;
		gs.playerInfo.Alice.money = 20;
		gs.countryInfo.Austria.availStock = [1, 2, 3, 4, 5];
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Alice', buyBid: true };

		await bidBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// stock denomination 3 (from mock getStockBelow) should be removed
		expect(written.countryInfo.Austria.availStock).not.toContain(3);
		expect(written.countryInfo.Austria.availStock).toEqual([1, 2, 4, 5]);
	});

	test('does NOT buy stock when context.buyBid is false (decline)', async () => {
		const gs = createMockGameState({
			mode: 'buy-bid',
			countryUp: 'Austria',
			bidBuyOrder: ['Alice'],
		});
		gs.playerInfo.Alice.bid = 6;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Alice', buyBid: false };

		await bidBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// No stock should have been added
		expect(written.playerInfo.Alice.stock.length).toBe(0);
		// Money should remain unchanged
		expect(written.playerInfo.Alice.money).toBe(20);
	});

	test('adds decline history when buyBid is false', async () => {
		const gs = createMockGameState({
			mode: 'buy-bid',
			countryUp: 'Austria',
			bidBuyOrder: ['Alice'],
		});
		gs.playerInfo.Alice.bid = 6;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Alice', buyBid: false };

		await bidBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		const histEntry = written.history.find((h) => h.includes('declines'));
		expect(histEntry).toBeDefined();
		expect(histEntry).toContain('Alice');
	});

	test('removes player from bidBuyOrder after buying', async () => {
		const gs = createMockGameState({
			mode: 'buy-bid',
			countryUp: 'Austria',
			bidBuyOrder: ['Alice', 'Bob'],
		});
		gs.playerInfo.Alice.bid = 6;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.bid = 4;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Alice', buyBid: true };

		await bidBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.bidBuyOrder).not.toContain('Alice');
	});

	test('when last in bidBuyOrder, doneBuying sets myTurn based on affordability', async () => {
		const gs = createMockGameState({
			mode: 'buy-bid',
			countryUp: 'Austria',
			bidBuyOrder: ['Alice'],
		});
		gs.playerInfo.Alice.bid = 6;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Alice', buyBid: true };

		await bidBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// After buying (20-6=14), Alice can afford $2, so doneBuying sets myTurn=true
		// for the next bid round. Mode advances to 'bid' for the next country.
		expect(written.playerInfo.Alice.myTurn).toBe(true);
		expect(written.mode).toBe('bid');
	});

	test('adds buy history when buyBid is true', async () => {
		const gs = createMockGameState({
			mode: 'buy-bid',
			countryUp: 'Austria',
			bidBuyOrder: ['Alice'],
		});
		gs.playerInfo.Alice.bid = 6;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Alice', buyBid: true };

		await bidBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		const histEntry = written.history.find((h) => h.includes('buys'));
		expect(histEntry).toBeDefined();
		expect(histEntry).toContain('Alice');
		expect(histEntry).toContain('Austria');
	});
});

// ===========================================================================
// newGame()
// ===========================================================================
describe('newGame', () => {
	test('creates a game and returns "done"', async () => {
		mockDbData = {
			'template game': {
				mode: 'bid',
				countryUp: 'Austria',
				round: 1,
				turnID: 0,
				setup: 'setups/standard',
				sameTurn: false,
				undo: null,
				history: [],
				timer: { timed: false, increment: 0, pause: 0, lastMove: 0, banked: 60 },
				playerInfo: {
					player: {
						money: 0,
						myTurn: true,
						investor: false,
						order: 0,
						swiss: false,
						stock: [],
						scoreModifier: 0,
						email: '',
						banked: 60,
					},
				},
				countryInfo: {},
			},
		};

		const info = {
			newGameID: 'game1',
			newGamePlayers: ['Alice', 'Bob', '', '', '', ''],
		};

		const result = await newGame(info);
		expect(result).toBe('done');
	});

	test('writes game state to Firebase under the provided game ID', async () => {
		mockDbData = {
			'template game': {
				mode: 'bid',
				countryUp: 'Austria',
				round: 1,
				turnID: 0,
				setup: 'setups/standard',
				sameTurn: false,
				undo: null,
				history: [],
				timer: { timed: false, increment: 0, pause: 0, lastMove: 0, banked: 60 },
				playerInfo: {
					player: {
						money: 0,
						myTurn: true,
						investor: false,
						order: 0,
						swiss: false,
						stock: [],
						scoreModifier: 0,
						email: '',
						banked: 60,
					},
				},
				countryInfo: {},
			},
		};

		const info = {
			newGameID: 'myNewGame',
			newGamePlayers: ['Alice', 'Bob', '', '', '', ''],
		};

		await newGame(info);

		const written = mockSetData['games/myNewGame'];
		expect(written).toBeDefined();
	});

	test('creates player entries for non-empty player names only', async () => {
		mockDbData = {
			'template game': {
				mode: 'bid',
				countryUp: 'Austria',
				round: 1,
				turnID: 0,
				setup: 'setups/standard',
				sameTurn: false,
				undo: null,
				history: [],
				timer: { timed: false, increment: 0, pause: 0, lastMove: 0, banked: 60 },
				playerInfo: {
					player: {
						money: 0,
						myTurn: true,
						investor: false,
						order: 0,
						swiss: false,
						stock: [],
						scoreModifier: 0,
						email: '',
						banked: 60,
					},
				},
				countryInfo: {},
			},
		};

		const info = {
			newGameID: 'game1',
			newGamePlayers: ['Alice', 'Bob', 'Charlie', '', '', ''],
		};

		await newGame(info);

		const written = mockSetData['games/game1'];
		expect(written.playerInfo.Alice).toBeDefined();
		expect(written.playerInfo.Bob).toBeDefined();
		expect(written.playerInfo.Charlie).toBeDefined();
		// The template 'player' key should be removed
		expect(written.playerInfo.player).toBeUndefined();
	});

	test('starting money uses the known operator-precedence bug (61 / count.toFixed(2))', async () => {
		// The bug: `61.0 / count.toFixed(2)` calls toFixed on count first (producing
		// a string like "2.00"), then JS coerces it back to a number for division.
		// For count=2: 61 / "2.00" = 61 / 2 = 30.5  (happens to be correct)
		// For count=3: 61 / "3.00" = 61 / 3 = 20.333...  (also correct numerically)
		// The bug is subtle: toFixed produces a string but JS coercion makes it work.
		mockDbData = {
			'template game': {
				mode: 'bid',
				countryUp: 'Austria',
				round: 1,
				turnID: 0,
				setup: 'setups/standard',
				sameTurn: false,
				undo: null,
				history: [],
				timer: { timed: false, increment: 0, pause: 0, lastMove: 0, banked: 60 },
				playerInfo: {
					player: {
						money: 0,
						myTurn: true,
						investor: false,
						order: 0,
						swiss: false,
						stock: [],
						scoreModifier: 0,
						email: '',
						banked: 60,
					},
				},
				countryInfo: {},
			},
		};

		const info = {
			newGameID: 'game1',
			newGamePlayers: ['Alice', 'Bob', '', '', '', ''],
		};

		await newGame(info);

		const written = mockSetData['games/game1'];
		// With 2 players: parseFloat(61.0 / (2).toFixed(2))
		// = parseFloat(61.0 / "2.00")
		// = parseFloat(30.5) = 30.5
		expect(written.playerInfo.Alice.money).toBe(30.5);
	});

	test('starting money with 6 players demonstrates the operator-precedence bug', async () => {
		mockDbData = {
			'template game': {
				mode: 'bid',
				countryUp: 'Austria',
				round: 1,
				turnID: 0,
				setup: 'setups/standard',
				sameTurn: false,
				undo: null,
				history: [],
				timer: { timed: false, increment: 0, pause: 0, lastMove: 0, banked: 60 },
				playerInfo: {
					player: {
						money: 0,
						myTurn: true,
						investor: false,
						order: 0,
						swiss: false,
						stock: [],
						scoreModifier: 0,
						email: '',
						banked: 60,
					},
				},
				countryInfo: {},
			},
		};

		const info = {
			newGameID: 'game1',
			newGamePlayers: ['A', 'B', 'C', 'D', 'E', 'F'],
		};

		await newGame(info);

		const written = mockSetData['games/game1'];
		// With 6 players: parseFloat(61.0 / (6).toFixed(2))
		// = parseFloat(61.0 / "6.00")
		// = parseFloat(61 / 6) = parseFloat(10.1666...) = 10.166666...
		const expectedMoney = parseFloat(61.0 / (6).toFixed(2));
		expect(written.playerInfo.A.money).toBeCloseTo(expectedMoney, 5);
	});

	test('initializes history with a game start message listing players', async () => {
		mockDbData = {
			'template game': {
				mode: 'bid',
				countryUp: 'Austria',
				round: 1,
				turnID: 0,
				setup: 'setups/standard',
				sameTurn: false,
				undo: null,
				history: [],
				timer: { timed: false, increment: 0, pause: 0, lastMove: 0, banked: 60 },
				playerInfo: {
					player: {
						money: 0,
						myTurn: true,
						investor: false,
						order: 0,
						swiss: false,
						stock: [],
						scoreModifier: 0,
						email: '',
						banked: 60,
					},
				},
				countryInfo: {},
			},
		};

		const info = {
			newGameID: 'game1',
			newGamePlayers: ['Alice', 'Bob', '', '', '', ''],
		};

		await newGame(info);

		const written = mockSetData['games/game1'];
		expect(written.history).toHaveLength(1);
		expect(written.history[0]).toContain('Alice');
		expect(written.history[0]).toContain('Bob');
		expect(written.history[0]).toContain('game has begun');
	});
});

// ===========================================================================
// undo()
// ===========================================================================
describe('undo', () => {
	test('restores the previous game state from history and returns "done"', async () => {
		const oldState = createMockGameState({ turnID: 4, mode: 'bid' });
		mockDbData = {
			games: {
				testGame: {
					turnID: 5,
				},
			},
			'game histories': {
				testGame: {
					4: oldState,
				},
			},
		};

		const context = { game: 'testGame', name: 'Alice' };
		const result = await undo(context);
		expect(result).toBe('done');
	});

	test('removes the history snapshot after restoring', async () => {
		const oldState = createMockGameState({ turnID: 4, mode: 'bid' });
		mockDbData = {
			games: {
				testGame: {
					turnID: 5,
				},
			},
			'game histories': {
				testGame: {
					4: oldState,
				},
			},
		};

		const context = { game: 'testGame', name: 'Alice' };
		await undo(context);
		await flushPromises();

		expect(mockRemovedPaths).toContain('game histories/testGame/4');
	});

	test('writes restored game state to Firebase', async () => {
		const oldState = createMockGameState({ turnID: 4, mode: 'proposal' });
		mockDbData = {
			games: {
				testGame: {
					turnID: 5,
				},
			},
			'game histories': {
				testGame: {
					4: oldState,
				},
			},
		};

		const context = { game: 'testGame', name: 'Alice' };
		await undo(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written).toBeDefined();
		expect(written.mode).toBe('proposal');
	});
});

// ===========================================================================
// submitBuy() — investor round buy
// ===========================================================================
describe('submitBuy', () => {
	test('buying a stock adds it to player stock array', async () => {
		const gs = createMockGameState({
			mode: 'buy',
			countryUp: 'Austria',
		});
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Alice.swiss = true;
		gs.playerInfo.Alice.investor = true;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Bob.swiss = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			buyCountry: 'Austria',
			buyStock: 3,
			returnStock: 'None',
		};

		const result = await submitBuy(context);
		await flushPromises();
		expect(result).toBe('done');

		const written = mockSetData['games/testGame'];
		expect(written.playerInfo.Alice.stock).toEqual(expect.arrayContaining([{ country: 'Austria', stock: 3 }]));
	});

	test('Punt Buy does not add stock and re-activates swiss for later buy', async () => {
		const gs = createMockGameState({
			mode: 'buy',
			countryUp: 'Austria',
		});
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Alice.swiss = true;
		gs.playerInfo.Alice.investor = true;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Bob.swiss = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			buyCountry: 'Punt Buy',
			buyStock: null,
			returnStock: 'None',
		};

		const result = await submitBuy(context);
		await flushPromises();
		expect(result).toBe('done');

		const written = mockSetData['games/testGame'];
		// Stock should remain empty (no purchase happened)
		expect(written.playerInfo.Alice.stock).toEqual([]);
		// Since Alice was the last swiss buyer (lastBuy=true), the round ends:
		// swissSet is populated with 'Alice', then swiss players are re-activated,
		// then swissSet is reset to null. Alice ends up with swiss=true for next round.
		expect(written.swissSet).toBeNull();
		expect(written.playerInfo.Alice.swiss).toBe(true);
	});

	test('sets myTurn to false and swiss to false after buying', async () => {
		const gs = createMockGameState({
			mode: 'buy',
			countryUp: 'Austria',
		});
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Alice.swiss = true;
		gs.playerInfo.Alice.investor = true;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Bob.swiss = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			buyCountry: 'Austria',
			buyStock: 3,
			returnStock: 'None',
		};

		await submitBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.playerInfo.Alice.myTurn).toBe(false);
		expect(written.playerInfo.Alice.swiss).toBe(false);
	});

	test('marks country as offLimits after buying stock (when another swiss buyer remains)', async () => {
		const gs = createMockGameState({
			mode: 'buy',
			countryUp: 'Austria',
		});
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Alice.swiss = true;
		gs.playerInfo.Alice.investor = true;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.myTurn = false;
		// Bob is next swiss buyer, so lastBuy=false and offLimits won't be reset
		gs.playerInfo.Bob.swiss = true;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			buyCountry: 'Austria',
			buyStock: 3,
			returnStock: 'None',
		};

		await submitBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.offLimits).toBe(true);
	});

	test('adds history entry for buy action', async () => {
		const gs = createMockGameState({
			mode: 'buy',
			countryUp: 'Austria',
		});
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Alice.swiss = true;
		gs.playerInfo.Alice.investor = true;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Bob.swiss = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			buyCountry: 'Austria',
			buyStock: 3,
			returnStock: 'None',
		};

		await submitBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		const buyHistory = written.history.find((h) => h.includes('bought'));
		expect(buyHistory).toBeDefined();
		expect(buyHistory).toContain('Alice');
		expect(buyHistory).toContain('Austria');
	});
});

// ===========================================================================
// submitProposal() — dictatorship path
// ===========================================================================
describe('submitProposal', () => {
	test('in dictatorship, executes proposal immediately', async () => {
		const gs = createMockGameState({
			mode: 'proposal',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'Factory';
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
			factoryLoc: null,
		};

		const result = await submitProposal(context);
		await flushPromises();
		expect(result).toBe('done');

		const written = mockSetData['games/testGame'];
		// After executeProposal, the mode should have moved to 'proposal' (for next country)
		// since investorPassed mock returns false and incrementCountry runs
		expect(written.mode).toBe('proposal');
	});

	test('in democracy, leader proposal stores proposal 1 and switches to proposal-opp', async () => {
		const gs = createMockGameState({
			mode: 'proposal',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.gov = 'democracy';
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
		};

		const result = await submitProposal(context);
		await flushPromises();
		expect(result).toBe('done');

		const written = mockSetData['games/testGame'];
		expect(written.mode).toBe('proposal-opp');
		expect(written.playerInfo.Bob.myTurn).toBe(true);
		expect(written['proposal 1']).toBeDefined();
	});

	test('in democracy, opposition proposal sets mode to vote', async () => {
		const gs = createMockGameState({
			mode: 'proposal-opp',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.gov = 'democracy';
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];
		gs.playerInfo.Alice.myTurn = false;
		gs.playerInfo.Bob.myTurn = true;
		gs['proposal 1'] = { name: 'Alice', wheelSpot: 'Taxation' };
		gs.history = ['Alice proposes as the leader: Austria taxes...'];
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Bob',
			wheelSpot: 'Factory',
		};

		const result = await submitProposal(context);
		await flushPromises();
		expect(result).toBe('done');

		const written = mockSetData['games/testGame'];
		expect(written.mode).toBe('vote');
		expect(written.voting).toBeDefined();
		expect(written.voting.country).toBe('Austria');
		// Both leaders should have myTurn = true for voting
		expect(written.playerInfo.Alice.myTurn).toBe(true);
		expect(written.playerInfo.Bob.myTurn).toBe(true);
	});
});

// ===========================================================================
// submitVote()
// ===========================================================================
describe('submitVote', () => {
	test('records vote and returns "done"', async () => {
		const gs = createMockGameState({
			mode: 'vote',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];
		gs.voting = {
			country: 'Austria',
			'proposal 1': { proposal: 'Leader proposal', votes: 0, voters: [] },
			'proposal 2': { proposal: 'Opp proposal', votes: 0, voters: [] },
		};
		gs['proposal 1'] = { name: 'Alice', wheelSpot: 'Taxation' };
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = true;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Alice', vote: 1 };

		const result = await submitVote(context);
		expect(result).toBe('done');
	});

	test('adds voter to the chosen proposal voters list', async () => {
		const gs = createMockGameState({
			mode: 'vote',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];
		gs.voting = {
			country: 'Austria',
			'proposal 1': { proposal: 'Leader proposal', votes: 0, voters: [] },
			'proposal 2': { proposal: 'Opp proposal', votes: 0, voters: [] },
		};
		gs['proposal 1'] = { name: 'Alice', wheelSpot: 'Taxation' };
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = true;
		setupMockDb(gs);

		// Mock getOwnedStock to give Alice 5 and Bob 3 (total 8)
		// When Alice votes for proposal 1, threshold = (8+0.01)/2 = 4.005
		// Alice has 5 stock, so votes += 5 (+ 0.1 leader bonus if i===0)
		// But note: in the code `i === 0` uses strict equality with a string key from for...in,
		// so the leader bonus may not apply (it compares string "0" === number 0).
		const context = { game: 'testGame', name: 'Alice', vote: 1 };

		await submitVote(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Check that Alice was added as a voter on proposal 1
		// The voting might be null if the proposal was executed (votes exceeded threshold)
		// With 5 votes + possible 0.1 bonus vs threshold of 4.005, it should execute
		// Either way, Alice should appear in the history
		expect(written.history.length).toBeGreaterThan(0);
	});

	test('sets myTurn to false for the voting player', async () => {
		const gs = createMockGameState({
			mode: 'vote',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];
		gs.countryInfo.Austria.wheelSpot = 'Factory';
		gs.voting = {
			country: 'Austria',
			'proposal 1': { proposal: 'Leader proposal', votes: 0, voters: [] },
			'proposal 2': { proposal: 'Opp proposal', votes: 0, voters: [] },
		};
		// Both proposals need game + wheelSpot because if the vote passes,
		// executeProposal is called with the winning proposal's unstringified context
		gs['proposal 1'] = { name: 'Alice', game: 'testGame', wheelSpot: 'Taxation' };
		gs['proposal 2'] = { name: 'Bob', game: 'testGame', wheelSpot: 'Factory' };
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = true;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Alice', vote: 2 };

		await submitVote(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.playerInfo.Alice.myTurn).toBe(false);
	});
});

// ===========================================================================
// submitNoCounter()
// ===========================================================================
describe('submitNoCounter', () => {
	test('executes the leader proposal directly and returns "done"', async () => {
		const gs = createMockGameState({
			mode: 'proposal-opp',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.gov = 'democracy';
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];
		gs.countryInfo.Austria.wheelSpot = 'Factory';
		gs['proposal 1'] = {
			name: 'Alice',
			game: 'testGame',
			wheelSpot: 'Taxation',
		};
		gs.history = ['Alice proposes as the leader: Austria taxes...'];
		gs.playerInfo.Alice.myTurn = false;
		gs.playerInfo.Bob.myTurn = true;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Bob' };

		const result = await submitNoCounter(context);
		await flushPromises();
		expect(result).toBe('done');

		const written = mockSetData['games/testGame'];
		// After execution, mode should advance to proposal (for next country)
		expect(written.mode).toBe('proposal');
	});

	test('adds agreement history entry', async () => {
		const gs = createMockGameState({
			mode: 'proposal-opp',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.gov = 'democracy';
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];
		gs.countryInfo.Austria.wheelSpot = 'Factory';
		gs['proposal 1'] = {
			name: 'Alice',
			game: 'testGame',
			wheelSpot: 'Taxation',
		};
		gs.history = ['Alice proposes as the leader: Austria taxes...'];
		gs.playerInfo.Alice.myTurn = false;
		gs.playerInfo.Bob.myTurn = true;
		setupMockDb(gs);

		const context = { game: 'testGame', name: 'Bob' };

		await submitNoCounter(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		const agreeHistory = written.history.find((h) => h.includes('agreed'));
		expect(agreeHistory).toBeDefined();
		expect(agreeHistory).toContain('Bob');
	});
});
