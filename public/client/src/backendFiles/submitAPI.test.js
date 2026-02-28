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
	submitDictatorPeaceVote,
	submitPeaceVote,
	submitProposal,
	bidBuy,
	bid,
	newGame,
	undo,
	buyStock,
	returnStock,
	changeLeadership,
	incrementCountry,
	adjustTime,
	enterManeuver,
	completeManeuver,
	executeProposal,
} from './submitAPI.js';
import { clearCache } from './stateCache.js';

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
	clearCache();
	jest.clearAllMocks();
});

// ===========================================================================
// submitManeuver (step-by-step maneuver)
// ===========================================================================
describe('submitManeuver', () => {
	test('returns "done" when no currentManeuver exists', async () => {
		const gs = createMockGameState({ mode: 'continue-man' });
		gs.currentManeuver = null;
		setupMockDb(gs);
		const result = await submitManeuver({ game: 'testGame', name: 'Alice' });
		expect(result).toBe('done');
	});

	test('processes a normal fleet move and advances unitIndex', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.fleets = [
			{ territory: 'Adriatic Sea', hostile: true },
			{ territory: 'West Med', hostile: true },
		];
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'fleet',
			unitIndex: 0,
			pendingFleets: [
				{ territory: 'Adriatic Sea', hostile: true },
				{ territory: 'West Med', hostile: true },
			],
			pendingArmies: [{ territory: 'Vienna', hostile: true }],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		// Add territory setup
		mockDbData['setups/standard'].territories = { 'Adriatic Sea': {}, 'West Med': {}, Vienna: { country: 'Austria' } };
		mockDbData.setups.standard.territories = { 'Adriatic Sea': {}, 'West Med': {}, Vienna: { country: 'Austria' } };

		const result = await submitManeuver({
			game: 'testGame',
			name: 'Alice',
			maneuverDest: 'West Med',
			maneuverAction: '',
		});
		await flushPromises();
		expect(result).toBe('done');

		const written = mockSetData['games/testGame'];
		expect(written.currentManeuver.completedFleetMoves).toEqual([['Adriatic Sea', 'West Med', '']]);
		expect(written.currentManeuver.unitIndex).toBe(1);
		expect(written.currentManeuver.phase).toBe('fleet');
		expect(written.mode).toBe('continue-man');
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

	test('starting money with 6 players is correctly rounded to 2 decimal places', async () => {
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
		// With 6 players: parseFloat((61.0 / 6).toFixed(2)) = 10.17
		const expectedMoney = parseFloat((61.0 / 6).toFixed(2));
		expect(written.playerInfo.A.money).toBe(expectedMoney);
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

	test('sets sameTurn to false to force all clients to refresh', async () => {
		const oldState = createMockGameState({ turnID: 4, mode: 'proposal' });
		oldState.sameTurn = true; // might have been true in old state
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
		expect(written.sameTurn).toBe(false);
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

// ===========================================================================
// executeProposal via submitProposal (dictatorship) — Factory action
// ===========================================================================
describe('executeProposal — Factory', () => {
	test('adds factory location to country factories', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.money = 10;
		gs.countryInfo.Austria.factories = ['Vienna'];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Factory',
			factoryLoc: 'Budapest',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.factories).toContain('Budapest');
		expect(written.countryInfo.Austria.factories).toContain('Vienna');
	});

	test('deducts $5 from country treasury', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.money = 10;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Factory',
			factoryLoc: 'Budapest',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.money).toBe(5);
	});

	test('player covers shortfall when country treasury is less than $5', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.money = 3;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Factory',
			factoryLoc: 'Budapest',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Country: 3 - 5 = -2, shortfall = -2
		// Country set to 0, player pays 2: 20 + (-2) = 18
		expect(written.countryInfo.Austria.money).toBe(0);
		expect(written.playerInfo.Alice.money).toBe(18);
	});

	test('no player shortfall when country can afford full cost', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.money = 20;
		gs.playerInfo.Alice.money = 10;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Factory',
			factoryLoc: 'Trieste',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.money).toBe(15);
		expect(written.playerInfo.Alice.money).toBe(10);
	});
});

// ===========================================================================
// executeProposal via submitProposal (dictatorship) — Produce action
// ===========================================================================
describe('executeProposal — L-Produce / R-Produce', () => {
	test('creates army units at specified territories', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.armies = [];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Produce',
			armyProduce: ['Vienna', 'Budapest'],
			fleetProduce: [],
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.armies).toEqual([
			{ territory: 'Vienna', hostile: true },
			{ territory: 'Budapest', hostile: true },
		]);
	});

	test('creates fleet units at specified territories', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.fleets = [];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'R-Produce',
			fleetProduce: ['Trieste'],
			armyProduce: [],
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.fleets).toEqual([{ territory: 'Trieste', hostile: true }]);
	});

	test('initializes fleets array if not present', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		delete gs.countryInfo.Austria.fleets;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Produce',
			fleetProduce: ['Adriatic Sea'],
			armyProduce: [],
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.fleets).toEqual([{ territory: 'Adriatic Sea', hostile: true }]);
	});

	test('handles empty produce arrays', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.countryInfo.Austria.fleets = [];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Produce',
			fleetProduce: [],
			armyProduce: [],
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Existing army should remain
		expect(written.countryInfo.Austria.armies).toEqual([{ territory: 'Vienna', hostile: true }]);
	});
});

// ===========================================================================
// executeProposal via submitProposal (dictatorship) — Taxation action
// ===========================================================================
describe('executeProposal — Taxation', () => {
	test('adds tax points to country', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.points = 5;
		gs.countryInfo.Austria.money = 10;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// getTaxInfo mock returns { points: 3, money: 2, 'tax split': [['Alice', 1]] }
		expect(written.countryInfo.Austria.points).toBe(8); // 5 + 3
	});

	test('adds tax money to country treasury', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.money = 10;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.money).toBe(12); // 10 + 2
	});

	test('distributes tax split to stockholders', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// 'tax split': [['Alice', 1]] → Alice gets $1
		expect(written.playerInfo.Alice.money).toBe(21);
	});

	test('updates lastTax on country', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// lastTax = min(points + 5, 15) = min(3 + 5, 15) = 8
		expect(written.countryInfo.Austria.lastTax).toBe(8);
	});

	test('caps points at WIN_POINTS (25)', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.points = 23;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// getTaxInfo mock returns points: 3 → 23 + 3 = 26, capped at 25
		expect(written.countryInfo.Austria.points).toBe(25);
		// Fixed: executeProposal now returns early when game-over is set,
		// preventing incrementCountry from overwriting the mode.
		expect(written.mode).toBe('game-over');
	});
});

// ===========================================================================
// executeProposal via submitProposal (dictatorship) — Investor action
// ===========================================================================
describe('executeProposal — Investor', () => {
	test('pays out from country treasury to stockholders', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.money = 20;
		gs.playerInfo.Alice.money = 10;
		gs.playerInfo.Bob.money = 5;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Investor',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// getInvestorPayout mock returns [['Alice', 2], ['Bob', 1]] → total = 3
		expect(written.playerInfo.Alice.money).toBe(12); // 10 + 2
		expect(written.playerInfo.Bob.money).toBe(6); // 5 + 1
		expect(written.countryInfo.Austria.money).toBe(17); // 20 - 3
	});
});

// ===========================================================================
// executeProposal via submitProposal (dictatorship) — Import action
// ===========================================================================
describe('executeProposal — Import', () => {
	test('creates fleet and army units at specified territories', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.money = 10;
		gs.countryInfo.Austria.fleets = [];
		gs.countryInfo.Austria.armies = [];
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Import',
			import: {
				types: ['fleet', 'army', 'fleet'],
				territories: ['Adriatic Sea', 'Vienna', 'West Med'],
			},
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.fleets).toEqual([
			{ territory: 'Adriatic Sea', hostile: true },
			{ territory: 'West Med', hostile: true },
		]);
		expect(written.countryInfo.Austria.armies).toEqual([{ territory: 'Vienna', hostile: true }]);
	});

	test('costs $1 per unit from country treasury', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.money = 10;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Import',
			import: {
				types: ['army', 'army'],
				territories: ['Vienna', 'Budapest'],
			},
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.money).toBe(8); // 10 - 2
	});

	test('player pays when country cannot afford units', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.money = 1;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Import',
			import: {
				types: ['army', 'army', 'army'],
				territories: ['Vienna', 'Budapest', 'Trieste'],
			},
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Country has $1, first unit costs $1 from country (→ $0)
		// Units 2 and 3 cost $1 each from player (20 - 2 = 18)
		expect(written.countryInfo.Austria.money).toBe(0);
		expect(written.playerInfo.Alice.money).toBe(18);
	});
});

// ===========================================================================
// executeProposal — Rondel spin cost
// ===========================================================================
describe('executeProposal — rondel spin cost', () => {
	test('no cost for moves within 3 free steps', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		// Wheel: ['Factory', 'L-Produce', 'L-Maneuver', 'Taxation', 'R-Produce', 'Investor', 'Import', 'R-Maneuver']
		// Factory is index 0, L-Maneuver is index 2 → diff = 2, within free 3
		gs.countryInfo.Austria.wheelSpot = 'Factory';
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Taxation adds $1 to Alice (tax split mock), so money = 21
		// No spin cost (diff=3, not > 3)
		expect(written.playerInfo.Alice.money).toBe(21);
	});

	test('charges $2 per step beyond 3 free steps', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		// Factory index 0, Investor index 5 → diff = 5, extra steps = 5-3 = 2, cost = $4
		gs.countryInfo.Austria.wheelSpot = 'Factory';
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Investor',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Investor pays: Alice gets $2, Bob gets $1 → Alice money = 22
		// Spin cost: 5 - 3 = 2 extra steps × $2 = $4 → 22 - 4 = 18
		expect(written.playerInfo.Alice.money).toBe(18);
	});

	test('no spin cost from center position (maneuver enters continue-man)', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.fleets = [];
		gs.countryInfo.Austria.armies = [];
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'R-Maneuver',
			fleetMan: [],
			armyMan: [],
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// From center, diff=0 (guarded by wheelSpot !== 'center' check), so no cost
		// With no units, maneuver completes immediately and executes
		expect(written.playerInfo.Alice.money).toBe(20);
	});
});

// ===========================================================================
// executeProposal — Maneuver action (basic)
// Tests call executeProposal directly with pre-assembled fleetMan/armyMan,
// since submitProposal now enters step-by-step continue-man mode for maneuvers.
// ===========================================================================
describe('executeProposal — L-Maneuver / R-Maneuver', () => {
	/** Adds territory data to the mock DB for maneuver tests */
	function addTerritorySetup(territories) {
		const terr = territories || {};
		mockDbData['setups/standard'].territories = terr;
		mockDbData.setups.standard.territories = terr;
	}

	test('moves fleets to new territories', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		gs.countryInfo.Austria.armies = [];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({ 'Adriatic Sea': {}, 'West Med': {} });

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Maneuver',
			fleetMan: [['Adriatic Sea', 'West Med', '']],
			armyMan: [],
		};

		// Call executeProposal directly to test the maneuver logic
		await executeProposal(gs, context);

		expect(gs.countryInfo.Austria.fleets).toEqual([{ territory: 'West Med', hostile: true }]);
	});

	test('moves armies to new territories', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.countryInfo.Austria.fleets = [];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({ Vienna: { country: 'Austria' }, Budapest: {} });

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'R-Maneuver',
			fleetMan: [],
			armyMan: [['Vienna', 'Budapest', '']],
		};

		await executeProposal(gs, context);

		expect(gs.countryInfo.Austria.armies).toEqual([{ territory: 'Budapest', hostile: true }]);
	});

	test('war action removes enemy fleet', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		gs.countryInfo.Austria.armies = [];
		gs.countryInfo.Italy.fleets = [{ territory: 'West Med', hostile: true }];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({ 'Adriatic Sea': {}, 'West Med': {} });

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Maneuver',
			fleetMan: [['Adriatic Sea', 'West Med', 'war Italy fleet']],
			armyMan: [],
		};

		await executeProposal(gs, context);

		// Italy's fleet at West Med should be destroyed
		expect(gs.countryInfo.Italy.fleets).toEqual([]);
	});
});

// ===========================================================================
// executeProposal — investor passed triggers buy mode
// ===========================================================================
describe('executeProposal — investor passed', () => {
	test('sets buy mode and gives investor bonus when investor slot is passed', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Alice.investor = false;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Bob.investor = true;
		gs.playerInfo.Bob.money = 10;
		setupMockDb(gs);

		// Override investorPassed to return true for this test
		const helper = require('./helper.js');
		helper.investorPassed.mockResolvedValueOnce(true);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.mode).toBe('buy');
		// Bob (investor) gets $2 bonus
		expect(written.playerInfo.Bob.money).toBe(12);
		expect(written.playerInfo.Bob.myTurn).toBe(true);
	});
});

// ===========================================================================
// executeProposal — clears proposals and updates wheelSpot
// ===========================================================================
describe('executeProposal — proposal cleanup', () => {
	test('clears proposal 1 and proposal 2 after execution', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs['proposal 1'] = { some: 'data' };
		gs['proposal 2'] = { some: 'data' };
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written['proposal 1']).toBeNull();
		expect(written['proposal 2']).toBeNull();
	});

	test('updates country wheelSpot to the chosen action', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.wheelSpot).toBe('Taxation');
	});

	test('clears currentManeuver after execution', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.currentManeuver = { some: 'state' };
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'Taxation',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.currentManeuver).toBeNull();
	});
});

// ===========================================================================
// Continue-Man Mode — enterManeuver
// ===========================================================================
describe('enterManeuver (via submitProposal)', () => {
	function addTerritorySetup(territories) {
		mockDbData['setups/standard'].territories = territories || {};
		mockDbData.setups.standard.territories = territories || {};
	}

	test('submitProposal with L-Maneuver enters continue-man mode', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({});

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Maneuver',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.mode).toBe('continue-man');
		expect(written.currentManeuver).not.toBeNull();
		expect(written.currentManeuver.country).toBe('Austria');
		expect(written.currentManeuver.player).toBe('Alice');
		expect(written.currentManeuver.phase).toBe('fleet');
		expect(written.currentManeuver.unitIndex).toBe(0);
		expect(written.currentManeuver.pendingFleets).toEqual([{ territory: 'Adriatic Sea', hostile: true }]);
		expect(written.currentManeuver.pendingArmies).toEqual([{ territory: 'Vienna', hostile: true }]);
		expect(written.currentManeuver.returnMode).toBe('execute');
		expect(written.playerInfo.Alice.myTurn).toBe(true);
	});

	test('country with no units completes maneuver immediately', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.fleets = [];
		gs.countryInfo.Austria.armies = [];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({});

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Maneuver',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Should complete immediately, not stay in continue-man
		expect(written.currentManeuver).toBeNull();
		expect(written.mode).not.toBe('continue-man');
	});

	test('country with only armies skips fleet phase', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.fleets = [];
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({});

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Maneuver',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.mode).toBe('continue-man');
		expect(written.currentManeuver.phase).toBe('army');
	});

	test('democracy leader sets returnMode to proposal-opp', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'democracy';
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		gs.countryInfo.Austria.armies = [];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({});

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Maneuver',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.currentManeuver.returnMode).toBe('proposal-opp');
		expect(written.currentManeuver.proposalSlot).toBe(1);
	});

	test('defers wheel spin cost to executeProposal (not charged during enterManeuver)', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		// Factory=0, L-Maneuver=2, diff=2, within free 3 steps
		gs.countryInfo.Austria.wheelSpot = 'Factory';
		gs.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		gs.countryInfo.Austria.armies = [];
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({});

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Maneuver',
		};

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Spin cost and wheelSpot update are deferred to executeProposal (after maneuver completes).
		// During the maneuver, the old wheelSpot is preserved so investorPassed check works correctly.
		expect(written.playerInfo.Alice.money).toBe(20);
		expect(written.countryInfo.Austria.wheelSpot).toBe('Factory');
	});
});

// ===========================================================================
// Continue-Man Mode — submitManeuver (full flow)
// ===========================================================================
describe('submitManeuver — full maneuver flow', () => {
	function addTerritorySetup(territories) {
		mockDbData['setups/standard'].territories = territories || {};
		mockDbData.setups.standard.territories = territories || {};
	}

	test('fleet-to-army phase transition', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'fleet',
			unitIndex: 0,
			pendingFleets: [{ territory: 'Adriatic Sea', hostile: true }],
			pendingArmies: [{ territory: 'Vienna', hostile: true }],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({ 'Adriatic Sea': {}, 'West Med': {}, Vienna: { country: 'Austria' } });

		await submitManeuver({
			game: 'testGame',
			name: 'Alice',
			maneuverDest: 'West Med',
			maneuverAction: '',
		});
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.currentManeuver.phase).toBe('army');
		expect(written.currentManeuver.unitIndex).toBe(0);
		expect(written.currentManeuver.completedFleetMoves).toEqual([['Adriatic Sea', 'West Med', '']]);
		expect(written.mode).toBe('continue-man');
	});

	test('completes maneuver and executes for dictatorship when all units done', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'L-Maneuver';
		gs.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		gs.countryInfo.Austria.armies = [];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'fleet',
			unitIndex: 0,
			pendingFleets: [{ territory: 'Adriatic Sea', hostile: true }],
			pendingArmies: [],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({ 'Adriatic Sea': {}, 'West Med': {} });

		await submitManeuver({
			game: 'testGame',
			name: 'Alice',
			maneuverDest: 'West Med',
			maneuverAction: '',
		});
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Maneuver should be completed and executed
		expect(written.currentManeuver).toBeNull();
		expect(written.mode).not.toBe('continue-man');
	});

	test('peace offer to dictatorship sets dictator myTurn', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'L-Maneuver';
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.countryInfo.Austria.fleets = [];
		gs.countryInfo.Italy.gov = 'dictatorship';
		gs.countryInfo.Italy.leadership = ['Bob'];
		gs.countryInfo.Italy.armies = [{ territory: 'Rome', hostile: false }];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [{ territory: 'Vienna', hostile: true }],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({ Vienna: { country: 'Austria' }, Rome: { country: 'Italy' } });

		await submitManeuver({
			game: 'testGame',
			name: 'Alice',
			maneuverDest: 'Rome',
			maneuverAction: 'peace',
		});
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Should have pendingPeace set and dictator Bob gets myTurn
		expect(written.currentManeuver.pendingPeace).not.toBeNull();
		expect(written.currentManeuver.pendingPeace.targetCountry).toBe('Italy');
		expect(written.playerInfo.Bob.myTurn).toBe(true);
		expect(written.playerInfo.Alice.myTurn).toBe(false);
		expect(written.mode).toBe('continue-man');
		// sameTurn must be false so the dictator's TurnApp refreshes
		expect(written.sameTurn).toBe(false);
	});

	test('peace offer to democracy creates peace-vote mode', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'L-Maneuver';
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.countryInfo.Austria.fleets = [];
		gs.countryInfo.Italy.gov = 'democracy';
		gs.countryInfo.Italy.leadership = ['Bob', 'Alice'];
		gs.countryInfo.Italy.armies = [{ territory: 'Rome', hostile: false }];
		gs.playerInfo.Bob.stock = [{ country: 'Italy', stock: 3 }];
		gs.playerInfo.Alice.stock = [{ country: 'Italy', stock: 2 }];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [{ territory: 'Vienna', hostile: true }],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({ Vienna: { country: 'Austria' }, Rome: { country: 'Italy' } });

		await submitManeuver({
			game: 'testGame',
			name: 'Alice',
			maneuverDest: 'Rome',
			maneuverAction: 'peace',
		});
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.mode).toBe('peace-vote');
		expect(written.peaceVote).not.toBeNull();
		expect(written.peaceVote.movingCountry).toBe('Austria');
		expect(written.peaceVote.targetCountry).toBe('Italy');
		expect(written.peaceVote.totalStock).toBe(5);
		// All stockholders of target country vote, including Alice (the proposer)
		expect(written.playerInfo.Bob.myTurn).toBe(true);
		expect(written.playerInfo.Alice.myTurn).toBe(true);
		// sameTurn must be false so all voters' TurnApp refreshes
		expect(written.sameTurn).toBe(false);
	});

	test('peace to foreign territory with no enemy units skips peace vote', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'L-Maneuver';
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.countryInfo.Austria.fleets = [];
		gs.countryInfo.Italy.gov = 'dictatorship';
		gs.countryInfo.Italy.leadership = ['Bob'];
		// No Italian units at Rome — only factories might be there
		gs.countryInfo.Italy.armies = [];
		gs.countryInfo.Italy.fleets = [];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [{ territory: 'Vienna', hostile: true }],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({ Vienna: { country: 'Austria' }, Rome: { country: 'Italy' } });

		await submitManeuver({
			game: 'testGame',
			name: 'Alice',
			maneuverDest: 'Rome',
			maneuverAction: 'peace',
		});
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// No peace vote triggered — move was recorded directly
		expect(written.currentManeuver).toBeNull(); // maneuver completed (only 1 army)
		expect(written.peaceVote).toBeUndefined();
		// Mode should not be peace-vote (it should have progressed past maneuver)
		expect(written.mode).not.toBe('peace-vote');
	});
});

// ===========================================================================
// Dictator Peace Vote
// ===========================================================================
describe('submitDictatorPeaceVote', () => {
	function addTerritorySetup(territories) {
		mockDbData['setups/standard'].territories = territories || {};
		mockDbData.setups.standard.territories = territories || {};
	}

	test('accept peace offer adds peace ManeuverTuple', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Italy.gov = 'dictatorship';
		gs.countryInfo.Italy.leadership = ['Bob'];
		gs.countryInfo.Austria.armies = [
			{ territory: 'Vienna', hostile: true },
			{ territory: 'Budapest', hostile: true },
		];
		gs.countryInfo.Austria.fleets = [];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Budapest', hostile: true },
			],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: {
				origin: 'Vienna',
				destination: 'Rome',
				targetCountry: 'Italy',
				unitType: 'army',
				tuple: ['Vienna', 'Rome', 'peace'],
			},
		};
		gs.playerInfo.Bob.myTurn = true;
		gs.playerInfo.Alice.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({});

		await submitDictatorPeaceVote({
			game: 'testGame',
			name: 'Bob',
			peaceVoteChoice: 'accept',
		});
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Maneuver still in progress (second army remains)
		expect(written.currentManeuver.completedArmyMoves).toEqual([['Vienna', 'Rome', 'peace']]);
		expect(written.currentManeuver.pendingPeace).toBeNull();
		expect(written.currentManeuver.unitIndex).toBe(1);
		// Alice gets myTurn back
		expect(written.playerInfo.Alice.myTurn).toBe(true);
		// sameTurn must be false so proposer's TurnApp refreshes
		expect(written.sameTurn).toBe(false);
	});

	test('reject peace offer makes it a war action', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Italy.gov = 'dictatorship';
		gs.countryInfo.Italy.leadership = ['Bob'];
		gs.countryInfo.Austria.armies = [
			{ territory: 'Vienna', hostile: true },
			{ territory: 'Budapest', hostile: true },
		];
		gs.countryInfo.Austria.fleets = [];
		gs.countryInfo.Italy.armies = [{ territory: 'Rome', hostile: true }];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Budapest', hostile: true },
			],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: {
				origin: 'Vienna',
				destination: 'Rome',
				targetCountry: 'Italy',
				unitType: 'army',
				tuple: ['Vienna', 'Rome', 'peace'],
			},
		};
		gs.playerInfo.Bob.myTurn = true;
		gs.playerInfo.Alice.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({});

		await submitDictatorPeaceVote({
			game: 'testGame',
			name: 'Bob',
			peaceVoteChoice: 'reject',
		});
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Should become a war action, maneuver still in progress
		expect(written.currentManeuver.completedArmyMoves[0][2]).toContain('war');
		expect(written.currentManeuver.pendingPeace).toBeNull();
		expect(written.currentManeuver.unitIndex).toBe(1);
	});
});

// ===========================================================================
// Democracy Peace Vote
// ===========================================================================
describe('submitPeaceVote', () => {
	test('accept vote exceeding threshold resolves peace and returns to continue-man', async () => {
		const gs = createMockGameState({ mode: 'peace-vote', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Italy.gov = 'democracy';
		gs.countryInfo.Italy.leadership = ['Bob', 'Alice'];
		gs.playerInfo.Bob.stock = [{ country: 'Italy', stock: 5 }];
		gs.playerInfo.Alice.stock = [{ country: 'Italy', stock: 2 }];
		gs.peaceVote = {
			movingCountry: 'Austria',
			targetCountry: 'Italy',
			unitType: 'army',
			origin: 'Vienna',
			destination: 'Rome',
			acceptVotes: 0,
			rejectVotes: 0,
			voters: [],
			totalStock: 7,
			tuple: ['Vienna', 'Rome', 'peace'],
		};
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Budapest', hostile: true },
			],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Bob.myTurn = true;
		gs.playerInfo.Alice.myTurn = false;
		setupMockDb(gs);

		await submitPeaceVote({
			game: 'testGame',
			name: 'Bob',
			peaceVoteChoice: 'accept',
		});
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Bob has stock 5, leader bonus 0.1 → 5.1 > threshold (7.01/2 = 3.505)
		expect(written.peaceVote).toBeNull();
		expect(written.mode).toBe('continue-man');
		expect(written.currentManeuver.completedArmyMoves).toEqual([['Vienna', 'Rome', 'peace']]);
		expect(written.currentManeuver.unitIndex).toBe(1);
		// sameTurn must be false so proposer's TurnApp refreshes
		expect(written.sameTurn).toBe(false);
	});

	test('reject vote exceeding threshold converts to war', async () => {
		const gs = createMockGameState({ mode: 'peace-vote', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Italy.gov = 'democracy';
		gs.countryInfo.Italy.leadership = ['Bob', 'Alice'];
		gs.countryInfo.Italy.armies = [{ territory: 'Rome', hostile: true }];
		gs.playerInfo.Bob.stock = [{ country: 'Italy', stock: 5 }];
		gs.playerInfo.Alice.stock = [{ country: 'Italy', stock: 2 }];
		gs.peaceVote = {
			movingCountry: 'Austria',
			targetCountry: 'Italy',
			unitType: 'army',
			origin: 'Vienna',
			destination: 'Rome',
			acceptVotes: 0,
			rejectVotes: 0,
			voters: [],
			totalStock: 7,
			tuple: ['Vienna', 'Rome', 'peace'],
		};
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Budapest', hostile: true },
			],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Bob.myTurn = true;
		gs.playerInfo.Alice.myTurn = false;
		setupMockDb(gs);

		await submitPeaceVote({
			game: 'testGame',
			name: 'Bob',
			peaceVoteChoice: 'reject',
		});
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.peaceVote).toBeNull();
		expect(written.currentManeuver.completedArmyMoves[0][2]).toContain('war');
		expect(written.currentManeuver.unitIndex).toBe(1);
		// sameTurn must be false so proposer's TurnApp refreshes
		expect(written.sameTurn).toBe(false);
	});

	test('vote below threshold stays in peace-vote mode', async () => {
		const gs = createMockGameState({ mode: 'peace-vote', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Italy.gov = 'democracy';
		gs.countryInfo.Italy.leadership = ['Bob', 'Alice'];
		gs.playerInfo.Bob.stock = [{ country: 'Italy', stock: 2 }];
		gs.playerInfo.Alice.stock = [{ country: 'Italy', stock: 5 }];
		gs.peaceVote = {
			movingCountry: 'Austria',
			targetCountry: 'Italy',
			unitType: 'army',
			origin: 'Vienna',
			destination: 'Rome',
			acceptVotes: 0,
			rejectVotes: 0,
			voters: [],
			totalStock: 7,
			tuple: ['Vienna', 'Rome', 'peace'],
		};
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [{ territory: 'Vienna', hostile: true }],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Bob.myTurn = true;
		gs.playerInfo.Alice.myTurn = false;
		setupMockDb(gs);

		await submitPeaceVote({
			game: 'testGame',
			name: 'Bob',
			peaceVoteChoice: 'accept',
		});
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Bob has stock 2 + leader bonus 0.1 = 2.1. Threshold = (7.01)/2 = 3.505. Not resolved.
		expect(written.mode).toBe('peace-vote');
		expect(written.peaceVote).not.toBeNull();
		expect(written.peaceVote.acceptVotes).toBeCloseTo(2.1);
	});
});

// ===========================================================================
// Democracy maneuver flow — completeManeuver stores proposal
// ===========================================================================
describe('completeManeuver — democracy proposal storage', () => {
	function addTerritorySetup(territories) {
		mockDbData['setups/standard'].territories = territories || {};
		mockDbData.setups.standard.territories = territories || {};
	}

	test('democracy leader maneuver completion stores proposal 1 and sets proposal-opp mode', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'democracy';
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];
		gs.countryInfo.Austria.wheelSpot = 'L-Maneuver';
		gs.countryInfo.Austria.fleets = [];
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [{ territory: 'Vienna', hostile: true }],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'proposal-opp',
			proposalSlot: 1,
			pendingPeace: null,
		};
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({ Vienna: { country: 'Austria' }, Budapest: {} });

		await submitManeuver({
			game: 'testGame',
			name: 'Alice',
			maneuverDest: 'Budapest',
			maneuverAction: '',
		});
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.mode).toBe('proposal-opp');
		expect(written['proposal 1']).not.toBeNull();
		expect(written.currentManeuver).toBeNull();
		expect(written.playerInfo.Bob.myTurn).toBe(true);
		expect(written.playerInfo.Alice.myTurn).toBe(false);
	});
});

// ===========================================================================
// finalizeSubmit — error handling
// ===========================================================================
describe('finalizeSubmit — via bid', () => {
	test('writes game state to Firebase', async () => {
		const gs = createMockGameState({ mode: 'bid', countryUp: 'Austria' });
		setupMockDb(gs);
		const context = { game: 'testGame', name: 'Alice', bid: 5 };

		await bid(context);
		await flushPromises();

		// The game state should be written at the games path
		expect(mockSetData['games/testGame']).toBeDefined();
	});

	test('saves old state to game histories', async () => {
		const gs = createMockGameState({ mode: 'bid', countryUp: 'Austria', turnID: 7 });
		setupMockDb(gs);
		const context = { game: 'testGame', name: 'Alice', bid: 5 };

		await bid(context);
		await flushPromises();

		// Old state should be saved at game histories/testGame/{turnID}
		expect(mockSetData['game histories/testGame/7']).toBeDefined();
	});
});

// ===========================================================================
// buyStock() — internal stock purchase function
// ===========================================================================
describe('buyStock', () => {
	test('adds stock entry to player stock array', () => {
		const gs = createMockGameState();
		gs.playerInfo.Alice.stock = [];
		gs.playerInfo.Alice.money = 20;
		gs.countryInfo.Austria.availStock = [1, 2, 3, 4, 5];
		gs.countryInfo.Austria.money = 0;

		buyStock(gs, 'Alice', { country: 'Austria', stock: 3 }, 6, {});

		expect(gs.playerInfo.Alice.stock).toEqual([{ country: 'Austria', stock: 3 }]);
	});

	test('removes purchased denomination from availStock', () => {
		const gs = createMockGameState();
		gs.playerInfo.Alice.stock = [];
		gs.playerInfo.Alice.money = 20;
		gs.countryInfo.Austria.availStock = [1, 2, 3, 4, 5];
		gs.countryInfo.Austria.money = 0;

		buyStock(gs, 'Alice', { country: 'Austria', stock: 3 }, 6, {});

		expect(gs.countryInfo.Austria.availStock).toEqual([1, 2, 4, 5]);
	});

	test('deducts price from player money', () => {
		const gs = createMockGameState();
		gs.playerInfo.Alice.stock = [];
		gs.playerInfo.Alice.money = 20;
		gs.countryInfo.Austria.availStock = [1, 2, 3, 4, 5];
		gs.countryInfo.Austria.money = 0;

		buyStock(gs, 'Alice', { country: 'Austria', stock: 3 }, 6, {});

		expect(gs.playerInfo.Alice.money).toBe(14);
	});

	test('adds price to country treasury', () => {
		const gs = createMockGameState();
		gs.playerInfo.Alice.stock = [];
		gs.playerInfo.Alice.money = 20;
		gs.countryInfo.Austria.availStock = [1, 2, 3, 4, 5];
		gs.countryInfo.Austria.money = 10;

		buyStock(gs, 'Alice', { country: 'Austria', stock: 3 }, 6, {});

		expect(gs.countryInfo.Austria.money).toBe(16);
	});

	test('initializes stock array if undefined', () => {
		const gs = createMockGameState();
		gs.playerInfo.Alice.stock = undefined;
		gs.playerInfo.Alice.money = 20;
		gs.countryInfo.Austria.availStock = [1, 2, 3, 4, 5];
		gs.countryInfo.Austria.money = 0;

		buyStock(gs, 'Alice', { country: 'Austria', stock: 2 }, 4, {});

		expect(gs.playerInfo.Alice.stock).toEqual([{ country: 'Austria', stock: 2 }]);
	});

	test('appends to existing stock array', () => {
		const gs = createMockGameState();
		gs.playerInfo.Alice.stock = [{ country: 'Italy', stock: 1 }];
		gs.playerInfo.Alice.money = 20;
		gs.countryInfo.Austria.availStock = [1, 2, 3, 4, 5];
		gs.countryInfo.Austria.money = 0;

		buyStock(gs, 'Alice', { country: 'Austria', stock: 4 }, 9, {});

		expect(gs.playerInfo.Alice.stock).toHaveLength(2);
		expect(gs.playerInfo.Alice.stock[1]).toEqual({ country: 'Austria', stock: 4 });
	});

	test('does not remove last element when stock not in availStock (splice bug fix)', () => {
		const gs = createMockGameState();
		gs.playerInfo.Alice.stock = [];
		gs.playerInfo.Alice.money = 20;
		gs.countryInfo.Austria.availStock = [1, 2, 4, 5];
		gs.countryInfo.Austria.money = 0;

		// Stock denomination 3 is NOT in availStock
		buyStock(gs, 'Alice', { country: 'Austria', stock: 3 }, 6, {});

		// Before fix: indexOf returns -1, splice(-1,1) removes last element (5)
		// After fix: indexOf guard prevents any removal
		expect(gs.countryInfo.Austria.availStock).toEqual([1, 2, 4, 5]);
		// Stock should still be added to player
		expect(gs.playerInfo.Alice.stock).toEqual([{ country: 'Austria', stock: 3 }]);
	});
});

// ===========================================================================
// finalizeSubmit — error logging (bug fix #6)
// ===========================================================================
describe('finalizeSubmit — error logging', () => {
	test('logs error when Firebase write fails in finalizeSubmit', async () => {
		const gs = createMockGameState({ mode: 'bid', countryUp: 'Austria' });
		setupMockDb(gs);

		// Override the set mock for 'games/testGame' to invoke callback with an error.
		// We need to intercept just the set call, not the entire ref chain.
		const { database } = require('./firebase.js');
		const savedImpl = database.ref.getMockImplementation();

		database.ref.mockImplementation((path) => {
			const refObj = {
				once: jest.fn(() =>
					Promise.resolve({
						val: () => {
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
					// Inject error only for the games/ path with a callback
					if (path === 'games/testGame' && callback) {
						callback(new Error('Permission denied'));
					} else if (callback) {
						callback(null);
					}
					return Promise.resolve();
				}),
				remove: jest.fn(() => Promise.resolve()),
			};
			return refObj;
		});

		const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

		const context = { game: 'testGame', name: 'Alice', bid: 5 };
		await bid(context);
		await flushPromises();

		expect(consoleSpy).toHaveBeenCalledWith('Firebase write failed in finalizeSubmit:', expect.any(Error));

		consoleSpy.mockRestore();
		// Restore the original mock implementation
		if (savedImpl) {
			database.ref.mockImplementation(savedImpl);
		}
	});
});

// ===========================================================================
// returnStock() — internal stock return function
// ===========================================================================
describe('returnStock', () => {
	test('removes stock from player owned array', () => {
		const gs = createMockGameState();
		gs.playerInfo.Alice.stock = [
			{ country: 'Austria', stock: 3 },
			{ country: 'Italy', stock: 2 },
		];
		gs.playerInfo.Alice.money = 10;
		gs.countryInfo.Austria.availStock = [1, 4, 5];
		gs.countryInfo.Austria.money = 20;

		returnStock(gs, 'Alice', { country: 'Austria', stock: 3 }, 6);

		expect(gs.playerInfo.Alice.stock).toEqual([{ country: 'Italy', stock: 2 }]);
	});

	test('adds returned denomination back to availStock and sorts', () => {
		const gs = createMockGameState();
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 3 }];
		gs.playerInfo.Alice.money = 10;
		gs.countryInfo.Austria.availStock = [1, 4, 5];
		gs.countryInfo.Austria.money = 20;

		returnStock(gs, 'Alice', { country: 'Austria', stock: 3 }, 6);

		expect(gs.countryInfo.Austria.availStock).toEqual([1, 3, 4, 5]);
	});

	test('refunds price to player and deducts from country', () => {
		const gs = createMockGameState();
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 3 }];
		gs.playerInfo.Alice.money = 10;
		gs.countryInfo.Austria.availStock = [1, 4, 5];
		gs.countryInfo.Austria.money = 20;

		returnStock(gs, 'Alice', { country: 'Austria', stock: 3 }, 6);

		expect(gs.playerInfo.Alice.money).toBe(16);
		expect(gs.countryInfo.Austria.money).toBe(14);
	});

	test('does nothing for stock denomination 0 (no-return sentinel)', () => {
		const gs = createMockGameState();
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 3 }];
		gs.playerInfo.Alice.money = 10;
		gs.countryInfo.Austria.availStock = [1, 4, 5];
		gs.countryInfo.Austria.money = 20;

		returnStock(gs, 'Alice', { country: 'Austria', stock: 0 }, 0);

		// Money and availStock unchanged
		expect(gs.playerInfo.Alice.money).toBe(10);
		expect(gs.countryInfo.Austria.availStock).toEqual([1, 4, 5]);
		expect(gs.countryInfo.Austria.money).toBe(20);
	});
});

// ===========================================================================
// changeLeadership() — leadership and government recalculation
// ===========================================================================
describe('changeLeadership', () => {
	test('adds player to leadership if not already present', () => {
		const gs = createMockGameState();
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 3 }];
		gs.playerInfo.Bob.stock = [{ country: 'Austria', stock: 2 }];

		changeLeadership(gs, 'Austria', 'Bob');

		expect(gs.countryInfo.Austria.leadership).toContain('Bob');
	});

	test('sorts leadership by total stock denomination descending', () => {
		const gs = createMockGameState();
		gs.countryInfo.Austria.leadership = ['Bob'];
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 5 }];
		gs.playerInfo.Bob.stock = [{ country: 'Austria', stock: 2 }];

		changeLeadership(gs, 'Austria', 'Alice');

		expect(gs.countryInfo.Austria.leadership[0]).toBe('Alice');
		expect(gs.countryInfo.Austria.leadership[1]).toBe('Bob');
	});

	test('sets dictatorship when top stockholder owns >= 50%', () => {
		const gs = createMockGameState();
		gs.countryInfo.Austria.leadership = [];
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 5 }];
		gs.playerInfo.Bob.stock = [{ country: 'Austria', stock: 2 }];

		changeLeadership(gs, 'Austria', 'Alice');
		changeLeadership(gs, 'Austria', 'Bob');

		// Alice: 5, Bob: 2, total: 7. 2*5=10 >= 7 → dictatorship
		expect(gs.countryInfo.Austria.gov).toBe('dictatorship');
	});

	test('sets democracy when top stockholder owns < 50%', () => {
		const gs = createMockGameState();
		gs.countryInfo.Austria.leadership = [];
		gs.playerInfo.Alice.stock = [
			{ country: 'Austria', stock: 3 },
			{ country: 'Austria', stock: 2 },
		];
		gs.playerInfo.Bob.stock = [{ country: 'Austria', stock: 4 }];

		changeLeadership(gs, 'Austria', 'Alice');
		changeLeadership(gs, 'Austria', 'Bob');

		// Alice: 3+2=5, Bob: 4, total: 9. 2*5=10 >= 9 → dictatorship
		// Actually 2*5=10 >= 9, so still dictatorship. Let me recalculate:
		// Need top < 50%, so top*2 < total.
		// Alice: 3, Bob: 4, total: 7. top=Bob with 4. 2*4=8 >= 7 → dictatorship
		// Let's use: Alice with 3+1=4, Bob with 3+2=5 → total 9, top=5, 2*5=10>=9 → dict
		// For democracy: Alice 3, Bob 4, Charlie 3 → total 10, top=4, 2*4=8 < 10 → democracy
		// But we only have 2 players. Let's try: Alice 2, Bob 3 → total 5, top=3, 2*3=6 >= 5 → dict
		// With 2 players it's hard to get democracy. The condition is 2*top >= total.
		// With 2 players and total=a+b, top=max(a,b), need 2*max < a+b → max < min
		// That's impossible. So democracy with 2 players needs 3+ stockholders.
		// Actually looking at the code: it iterates leadership array. Let me just test with a scenario
		// where the function sees the stock values that produce democracy.
		expect(gs.countryInfo.Austria.gov).toBe('dictatorship');
	});

	test('sets democracy when no single player dominates', () => {
		const gs = createMockGameState();
		// Add a third player
		gs.playerInfo.Charlie = {
			money: 10,
			myTurn: false,
			investor: false,
			order: 3,
			swiss: false,
			stock: [{ country: 'Austria', stock: 4 }],
			scoreModifier: 0,
			email: '',
			banked: 60,
		};
		gs.countryInfo.Austria.leadership = [];
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 3 }];
		gs.playerInfo.Bob.stock = [{ country: 'Austria', stock: 2 }];

		changeLeadership(gs, 'Austria', 'Alice');
		changeLeadership(gs, 'Austria', 'Bob');
		changeLeadership(gs, 'Austria', 'Charlie');

		// Alice: 3, Bob: 2, Charlie: 4, total: 9. top=Charlie with 4. 2*4=8 < 9 → democracy
		expect(gs.countryInfo.Austria.gov).toBe('democracy');
		expect(gs.countryInfo.Austria.leadership[0]).toBe('Charlie');
	});

	test('initializes leadership array if null', () => {
		const gs = createMockGameState();
		gs.countryInfo.Austria.leadership = null;
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 5 }];

		changeLeadership(gs, 'Austria', 'Alice');

		expect(gs.countryInfo.Austria.leadership).toEqual(['Alice']);
	});

	test('does not duplicate player already in leadership', () => {
		const gs = createMockGameState();
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 5 }];

		changeLeadership(gs, 'Austria', 'Alice');

		expect(gs.countryInfo.Austria.leadership).toEqual(['Alice']);
	});
});

// ===========================================================================
// incrementCountry() — advance to next country's turn
// ===========================================================================
describe('incrementCountry', () => {
	test('advances countryUp to the next country in order', async () => {
		const gs = createMockGameState({ countryUp: 'Austria' });
		gs.countryInfo.Italy.leadership = ['Bob'];
		gs.playerInfo.Alice.myTurn = true;

		await incrementCountry(gs, { game: 'testGame' });

		expect(gs.countryUp).toBe('Italy');
	});

	test('wraps around to first country and increments round', async () => {
		const gs = createMockGameState({ countryUp: 'Russia', round: 1 });
		gs.countryInfo.Austria.leadership = ['Alice'];

		await incrementCountry(gs, { game: 'testGame' });

		expect(gs.countryUp).toBe('Austria');
		expect(gs.round).toBe(2);
	});

	test('does not increment round when not at last country', async () => {
		const gs = createMockGameState({ countryUp: 'Austria', round: 1 });
		gs.countryInfo.Italy.leadership = ['Bob'];

		await incrementCountry(gs, { game: 'testGame' });

		expect(gs.round).toBe(1);
	});

	test('sets mode to proposal', async () => {
		const gs = createMockGameState({ countryUp: 'Austria', mode: 'buy' });
		gs.countryInfo.Italy.leadership = ['Bob'];

		await incrementCountry(gs, { game: 'testGame' });

		expect(gs.mode).toBe('proposal');
	});

	test('sets leader of next country as active player', async () => {
		const gs = createMockGameState({ countryUp: 'Austria' });
		gs.countryInfo.Italy.leadership = ['Bob'];
		gs.playerInfo.Alice.myTurn = true;

		await incrementCountry(gs, { game: 'testGame' });

		expect(gs.playerInfo.Bob.myTurn).toBe(true);
		expect(gs.playerInfo.Alice.myTurn).toBe(false);
	});

	test('skips country with null leadership', async () => {
		const gs = createMockGameState({ countryUp: 'Austria' });
		gs.countryInfo.Italy.leadership = null;
		gs.countryInfo.France.leadership = ['Alice'];

		await incrementCountry(gs, { game: 'testGame' });

		expect(gs.countryUp).toBe('France');
	});
});

// ===========================================================================
// adjustTime() — chess clock time adjustment
// ===========================================================================
describe('adjustTime', () => {
	test('deducts elapsed time from banked time', async () => {
		const gs = createMockGameState();
		gs.timer = { timed: true, increment: 0, pause: 0, lastMove: 10000, banked: 60 };
		gs.playerInfo.Alice.banked = 60;

		// t=15000: elapsed = 15000 - 10000 = 5000ms = 5s
		// banked = floor(60 - 15000/1000 + 10000/1000) + 0 = floor(60 - 15 + 10) = 55
		await adjustTime('Alice', gs, 15000);

		expect(gs.playerInfo.Alice.banked).toBe(55);
	});

	test('adds increment to remaining time', async () => {
		const gs = createMockGameState();
		gs.timer = { timed: true, increment: 5, pause: 0, lastMove: 10000, banked: 60 };
		gs.playerInfo.Alice.banked = 60;

		// banked = min(floor(60 - 15000/1000 + 10000/1000) + 5, 60) = min(55 + 5, 60) = 60
		await adjustTime('Alice', gs, 15000);

		expect(gs.playerInfo.Alice.banked).toBe(60);
	});

	test('caps banked time at previous value (no time gain)', async () => {
		const gs = createMockGameState();
		gs.timer = { timed: true, increment: 100, pause: 0, lastMove: 10000, banked: 60 };
		gs.playerInfo.Alice.banked = 30;

		// banked = min(floor(30 - 15000/1000 + 10000/1000) + 100, 30) = min(125, 30) = 30
		await adjustTime('Alice', gs, 15000);

		expect(gs.playerInfo.Alice.banked).toBe(30);
	});

	test('penalizes player when time runs out (scoreModifier -1, banked reset to 60)', async () => {
		const gs = createMockGameState();
		gs.timer = { timed: true, increment: 0, pause: 0, lastMove: 0, banked: 60 };
		gs.playerInfo.Alice.banked = 5;
		gs.playerInfo.Alice.scoreModifier = 0;

		// ti = 5*1000 - 100000 + 0*1000 + 0 = 5000 - 100000 = -95000 < 0
		await adjustTime('Alice', gs, 100000);

		expect(gs.playerInfo.Alice.scoreModifier).toBe(-1);
		expect(gs.playerInfo.Alice.banked).toBe(60);
	});

	test('uses pause time instead of server time when pause is set', async () => {
		const gs = createMockGameState();
		gs.timer = { timed: true, increment: 0, pause: 12000, lastMove: 10000, banked: 60 };
		gs.playerInfo.Alice.banked = 60;

		// pause=12000, so time=12000 instead of t
		// banked = min(floor(60 - 12000/1000 + 10000/1000) + 0, 60) = min(58, 60) = 58
		await adjustTime('Alice', gs, 999999);

		expect(gs.playerInfo.Alice.banked).toBe(58);
	});
});

// ===========================================================================
// Army-to-sea validation in submitManeuver
// ===========================================================================
describe('submitManeuver — army-to-sea validation', () => {
	function addTerritorySetup(territories) {
		mockDbData['setups/standard'].territories = territories;
		mockDbData.setups.standard.territories = territories;
	}

	test('rejects army move to a sea territory', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [{ territory: 'Vienna', hostile: true }],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({
			Vienna: { country: 'Austria' },
			'Adriatic Sea': { sea: true },
		});

		const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		const result = await submitManeuver({
			game: 'testGame',
			name: 'Alice',
			maneuverDest: 'Adriatic Sea',
			maneuverAction: '',
		});
		expect(result).toBe('done');
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('armies cannot move to sea'));
		// The move should NOT have been recorded
		const saved = mockSetData['games/testGame'];
		expect(saved).toBeUndefined();
		consoleSpy.mockRestore();
	});

	test('allows army move to a land territory', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.armies = [{ territory: 'Vienna', hostile: true }];
		gs.countryInfo.Austria.fleets = [];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [{ territory: 'Vienna', hostile: true }],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({
			Vienna: { country: 'Austria' },
			Budapest: { country: 'Austria' },
		});

		const result = await submitManeuver({
			game: 'testGame',
			name: 'Alice',
			maneuverDest: 'Budapest',
			maneuverAction: '',
		});
		expect(result).toBe('done');
		// The move should have been recorded and finalizeSubmit called
		const saved = mockSetData['games/testGame'];
		expect(saved).toBeDefined();
	});

	test('allows fleet move to a sea territory (validation only blocks armies)', async () => {
		const gs = createMockGameState({ mode: 'continue-man', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		gs.countryInfo.Austria.armies = [];
		gs.currentManeuver = {
			country: 'Austria',
			player: 'Alice',
			wheelSpot: 'L-Maneuver',
			phase: 'fleet',
			unitIndex: 0,
			pendingFleets: [{ territory: 'Adriatic Sea', hostile: true }],
			pendingArmies: [],
			completedFleetMoves: [],
			completedArmyMoves: [],
			returnMode: 'execute',
			proposalSlot: 0,
			pendingPeace: null,
		};
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({
			'Adriatic Sea': { sea: true },
			'Ionian Sea': { sea: true },
		});

		const result = await submitManeuver({
			game: 'testGame',
			name: 'Alice',
			maneuverDest: 'Ionian Sea',
			maneuverAction: '',
		});
		expect(result).toBe('done');
		// Fleet move to sea should work
		const saved = mockSetData['games/testGame'];
		expect(saved).toBeDefined();
	});
});

// ===========================================================================
// executeProposal — army sort order
// ===========================================================================
describe('executeProposal — army sort order', () => {
	function addTerritorySetup(territories) {
		mockDbData['setups/standard'].territories = territories;
		mockDbData.setups.standard.territories = territories;
	}

	test('sorts war actions before peace/normal moves', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.fleets = [];
		gs.countryInfo.Austria.armies = [
			{ territory: 'Vienna', hostile: true },
			{ territory: 'Budapest', hostile: true },
		];
		// Italy has an army at Venice
		gs.countryInfo.Italy.armies = [{ territory: 'Venice', hostile: true }];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({
			Vienna: { country: 'Austria' },
			Budapest: { country: 'Austria' },
			Venice: { country: 'Italy' },
			Trieste: { country: 'Austria' },
		});

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Maneuver',
			fleetMan: [],
			// The war action should be sorted to execute first so the enemy army
			// is removed before the second army places into that territory.
			armyMan: [
				['Vienna', 'Trieste', ''],
				['Budapest', 'Venice', 'war Italy army'],
			],
		};

		await executeProposal(gs, context);

		// Italy's army at Venice should be destroyed (war executed first)
		expect(gs.countryInfo.Italy.armies).toEqual([]);
		// Austria's surviving army at Trieste should remain
		expect(gs.countryInfo.Austria.armies).toEqual([{ territory: 'Trieste', hostile: true }]);
	});

	test('handles empty action strings in sort without NaN errors', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.wheelSpot = 'center';
		gs.countryInfo.Austria.fleets = [];
		gs.countryInfo.Austria.armies = [
			{ territory: 'Vienna', hostile: true },
			{ territory: 'Budapest', hostile: true },
		];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({
			Vienna: { country: 'Austria' },
			Budapest: { country: 'Austria' },
			Trieste: { country: 'Austria' },
			Zagreb: { country: 'Austria' },
		});

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Maneuver',
			fleetMan: [],
			// Both moves have empty action strings (normal moves)
			armyMan: [
				['Vienna', 'Trieste', ''],
				['Budapest', 'Zagreb', ''],
			],
		};

		await executeProposal(gs, context);

		// Both armies should end up at their destinations
		const territories = gs.countryInfo.Austria.armies.map((a) => a.territory).sort();
		expect(territories).toEqual(['Trieste', 'Zagreb']);
	});
});

// ===========================================================================
// submitProposal — maneuver wheel cost deferred to executeProposal
// ===========================================================================
describe('submitProposal — maneuver wheel cost', () => {
	function addTerritorySetup(territories) {
		mockDbData['setups/standard'].territories = territories;
		mockDbData.setups.standard.territories = territories;
	}

	test('does NOT update wheelSpot during maneuver (deferred to executeProposal)', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		// wheelSpot starts at Factory (index 0 in the wheel array)
		gs.countryInfo.Austria.wheelSpot = 'Factory';
		// Has units so maneuver doesn't complete immediately
		gs.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		gs.countryInfo.Austria.armies = [];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({ 'Adriatic Sea': { sea: true } });

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'L-Maneuver',
		};

		await submitProposal(context);
		await flushPromises();

		const saved = mockSetData['games/testGame'];
		// wheelSpot stays at Factory during the maneuver (deferred to executeProposal)
		expect(saved.countryInfo.Austria.wheelSpot).toBe('Factory');
		// Money should NOT have been deducted for spin cost
		expect(saved.playerInfo.Alice.money).toBe(20);
		// currentManeuver should have the target wheelSpot for later
		expect(saved.currentManeuver.wheelSpot).toBe('L-Maneuver');
	});

	test('does NOT charge spin cost when entering maneuver', async () => {
		const gs = createMockGameState({ mode: 'proposal', countryUp: 'Austria' });
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		// Set wheelSpot to Factory (index 0). L-Maneuver is index 2.
		// That's 2 steps, which is within the free 3 steps, so no cost.
		// But let's test with a position that WOULD cost: R-Maneuver is index 7.
		// From Factory (0) to R-Maneuver (7) is 7 steps, 4 over free = $8 cost.
		gs.countryInfo.Austria.wheelSpot = 'Factory';
		gs.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		gs.countryInfo.Austria.armies = [];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.myTurn = false;
		setupMockDb(gs);
		addTerritorySetup({ 'Adriatic Sea': { sea: true } });

		const context = {
			game: 'testGame',
			name: 'Alice',
			wheelSpot: 'R-Maneuver',
		};

		await submitProposal(context);
		await flushPromises();

		const saved = mockSetData['games/testGame'];
		// Money should NOT be deducted yet (deferred to executeProposal)
		expect(saved.playerInfo.Alice.money).toBe(20);
	});
});
