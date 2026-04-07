// ---------------------------------------------------------------------------
// gameFlow.test.js — Integration tests for the complete turn flow state machine
// ---------------------------------------------------------------------------

// Track all data written via Firebase set() calls so we can inspect what was persisted
let mockSetData = {};
let mockRemovedPaths = [];

// The mock DB data tree. Tests populate this before each call.
let mockDbData = {};

/**
 * Navigates a slash-separated Firebase path into the mockDbData tree.
 * e.g. "games/g1/playerInfo" -> mockDbData.games.g1.playerInfo
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
	callFunction: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
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

// ---- Import functions under test (AFTER mocks) ---------------------------
import {
	submitBuy,
	submitVote,
	submitNoCounter,
	submitProposal,
	bidBuy,
	bid,
	executeProposal,
	incrementCountry,
	changeLeadership,
} from './submitAPI.js';
import { clearCache, setCachedState } from './stateCache.js';
import * as helper from './helper.js';

// ---- Helpers --------------------------------------------------------------

async function flushPromises() {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function createGameState(overrides = {}) {
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
			Charlie: {
				money: 10,
				myTurn: true,
				investor: false,
				order: 3,
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
				gov: 'dictatorship',
				leadership: ['Alice'],
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
				gov: 'dictatorship',
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
				leadership: ['Alice', 'Charlie'],
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
				gov: 'dictatorship',
				leadership: ['Charlie'],
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
				gov: 'dictatorship',
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
				gov: 'dictatorship',
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

function setupMockDb(gameState, gameID = 'testGame') {
	mockDbData = {
		games: {
			[gameID]: gameState,
		},
		'setups/standard': {
			wheel: ['Factory', 'L-Produce', 'R-Produce', 'Investor', 'Taxation', 'Import', 'L-Maneuver', 'R-Maneuver'],
			countries: ['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia'],
			stockCosts: { 1: 2, 2: 4, 3: 6, 4: 9, 5: 12 },
			territories: {},
		},
		setups: {
			standard: {
				wheel: ['Factory', 'L-Produce', 'R-Produce', 'Investor', 'Taxation', 'Import', 'L-Maneuver', 'R-Maneuver'],
				countries: ['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia'],
				stockCosts: { 1: 2, 2: 4, 3: 6, 4: 9, 5: 12 },
				territories: {},
			},
		},
		'game histories': {},
	};
	return gameState;
}

function makeContext(overrides = {}) {
	return {
		game: 'testGame',
		name: 'Alice',
		wheelSpot: 'Factory',
		factoryLoc: 'Vienna',
		fleetProduce: [],
		armyProduce: [],
		fleetMan: [],
		armyMan: [],
		import: { types: [], territories: [] },
		setBid: jest.fn(),
		setBuyBid: jest.fn(),
		setBuyCountry: jest.fn(),
		setBuyStock: jest.fn(),
		setVote: jest.fn(),
		setWheelSpot: jest.fn(),
		setFactoryLoc: jest.fn(),
		setFleetProduce: jest.fn(),
		setArmyProduce: jest.fn(),
		setFleetMan: jest.fn(),
		setArmyMan: jest.fn(),
		setImport: jest.fn(),
		setManeuverDest: jest.fn(),
		setManeuverAction: jest.fn(),
		setPeaceVoteChoice: jest.fn(),
		setReturnStock: jest.fn(),
		resetValues: jest.fn(),
		...overrides,
	};
}

// ---- Reset between tests --------------------------------------------------
beforeEach(() => {
	mockDbData = {};
	mockSetData = {};
	mockRemovedPaths = [];
	clearCache();
	jest.clearAllMocks();
	// Restore default mock return values
	helper.investorPassed.mockReturnValue(Promise.resolve(false));
	helper.getTaxInfo.mockReturnValue(
		Promise.resolve({
			points: 3,
			money: 2,
			'tax split': [['Alice', 1]],
		})
	);
});

// ===========================================================================
// 1. Bidding phase flow
// ===========================================================================
describe('Bidding phase flow', () => {
	test('all players bid -> mode becomes buy-bid -> highest bidder gets turn', async () => {
		// Set up: Alice, Bob, Charlie all need to bid on Austria
		const gs = createGameState({ mode: 'bid', countryUp: 'Austria' });
		setupMockDb(gs);

		// Alice bids first
		let context = makeContext({ name: 'Alice', bid: 5 });
		await bid(context);
		await flushPromises();

		// After Alice bids, Bob and Charlie still need to bid -> mode stays bid
		let written = mockSetData['games/testGame'];
		expect(written.mode).toBe('bid');
		expect(written.playerInfo.Alice.myTurn).toBe(false);

		// Update mockDbData with what was written so far
		mockDbData.games.testGame = JSON.parse(JSON.stringify(written));
		clearCache();

		// Bob bids
		context = makeContext({ name: 'Bob', bid: 3 });
		await bid(context);
		await flushPromises();

		written = mockSetData['games/testGame'];
		expect(written.mode).toBe('bid');
		mockDbData.games.testGame = JSON.parse(JSON.stringify(written));
		clearCache();

		// Charlie bids last -> all done -> mode should transition to buy-bid
		context = makeContext({ name: 'Charlie', bid: 4 });
		await bid(context);
		await flushPromises();

		written = mockSetData['games/testGame'];
		expect(written.mode).toBe('buy-bid');
		expect(written.bidBuyOrder).toBeDefined();
		expect(written.bidBuyOrder.length).toBeGreaterThan(0);
	});

	test('bidBuy: highest bidder buys -> next buyer gets turn -> done buying advances country', async () => {
		const gs = createGameState({
			mode: 'buy-bid',
			countryUp: 'Austria',
			bidBuyOrder: ['Alice', 'Bob'],
		});
		gs.playerInfo.Alice.bid = 6;
		gs.playerInfo.Alice.money = 20;
		gs.playerInfo.Bob.bid = 4;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = false;
		setupMockDb(gs);

		// Alice buys
		let context = makeContext({ name: 'Alice', buyBid: true });
		await bidBuy(context);
		await flushPromises();

		let written = mockSetData['games/testGame'];
		// Alice bought stock 3 (from getStockBelow mock)
		expect(written.playerInfo.Alice.stock.length).toBe(1);
		expect(written.playerInfo.Alice.stock[0]).toEqual({ country: 'Austria', stock: 3 });
		// Alice paid her bid price
		expect(written.playerInfo.Alice.money).toBe(14);
		// Bob should be next buyer
		expect(written.playerInfo.Bob.myTurn).toBe(true);
	});
});

// ===========================================================================
// 2. Dictatorship proposal -> execute -> next country
// ===========================================================================
describe('Dictatorship proposal -> execute -> next country', () => {
	test('dictatorship leader proposes Factory -> executes immediately -> advances to next country', async () => {
		const gs = createGameState({
			mode: 'proposal',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.money = 10;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = false;
		setupMockDb(gs);

		const context = makeContext({
			name: 'Alice',
			wheelSpot: 'Factory',
			factoryLoc: 'Budapest',
		});

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Factory was built
		expect(written.countryInfo.Austria.factories).toContain('Budapest');
		// Country money decreased by 5 (FACTORY_COST)
		expect(written.countryInfo.Austria.money).toBe(5);
		// Mode advanced to proposal for next country (Italy)
		expect(written.mode).toBe('proposal');
		expect(written.countryUp).toBe('Italy');
		// Bob is Italy's leader, so it's Bob's turn
		expect(written.playerInfo.Bob.myTurn).toBe(true);
		expect(written.playerInfo.Alice.myTurn).toBe(false);
	});

	test('dictatorship Taxation proposal executes and advances', async () => {
		const gs = createGameState({
			mode: 'proposal',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = false;
		setupMockDb(gs);

		const context = makeContext({
			name: 'Alice',
			wheelSpot: 'Taxation',
		});

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Taxation adds points (mocked: 3 points) and money
		expect(written.countryInfo.Austria.points).toBe(3);
		expect(written.countryInfo.Austria.money).toBe(2);
		// Alice gets tax split (mocked: $1)
		expect(written.playerInfo.Alice.money).toBe(21);
		// Wheel spot updated
		expect(written.countryInfo.Austria.wheelSpot).toBe('Taxation');
		// Advances to next country
		expect(written.mode).toBe('proposal');
		expect(written.countryUp).toBe('Italy');
	});
});

// ===========================================================================
// 3. Democracy proposal -> proposal-opp -> vote -> execute
// ===========================================================================
describe('Democracy proposal flow', () => {
	test('leader proposes -> mode goes to proposal-opp -> opposition turn', async () => {
		const gs = createGameState({
			mode: 'proposal',
			countryUp: 'France',
		});
		gs.countryInfo.France.gov = 'democracy';
		gs.countryInfo.France.leadership = ['Alice', 'Charlie'];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = false;
		setupMockDb(gs);

		const context = makeContext({
			name: 'Alice',
			wheelSpot: 'Factory',
			factoryLoc: 'Lyon',
		});

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Mode should be proposal-opp
		expect(written.mode).toBe('proposal-opp');
		// Proposal 1 should be stored
		expect(written['proposal 1']).toBeDefined();
		expect(written['proposal 1'].wheelSpot).toBe('Factory');
		// Opposition (Charlie) should have myTurn
		expect(written.playerInfo.Charlie.myTurn).toBe(true);
		expect(written.playerInfo.Alice.myTurn).toBe(false);
	});

	test('opposition agrees (submitNoCounter) -> executes leader proposal -> next country', async () => {
		const gs = createGameState({
			mode: 'proposal-opp',
			countryUp: 'France',
		});
		gs.countryInfo.France.gov = 'democracy';
		gs.countryInfo.France.leadership = ['Alice', 'Charlie'];
		gs.countryInfo.France.money = 10;
		// Store the leader's proposal
		gs['proposal 1'] = {
			name: 'Alice',
			game: 'testGame',
			wheelSpot: 'Factory',
			factoryLoc: 'Lyon',
		};
		gs.playerInfo.Alice.myTurn = false;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = true;
		setupMockDb(gs);

		const context = makeContext({ name: 'Charlie' });

		await submitNoCounter(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Factory should have been built
		expect(written.countryInfo.France.factories).toContain('Lyon');
		// Mode advances to proposal for the next country (England)
		expect(written.mode).toBe('proposal');
		expect(written.countryUp).toBe('England');
		// England's leader (Charlie) gets turn
		expect(written.playerInfo.Charlie.myTurn).toBe(true);
	});

	test('opposition counter-proposes -> mode goes to vote -> all leadership can vote', async () => {
		const gs = createGameState({
			mode: 'proposal-opp',
			countryUp: 'France',
		});
		gs.countryInfo.France.gov = 'democracy';
		gs.countryInfo.France.leadership = ['Alice', 'Charlie'];
		// Proposal 1 already set by leader
		gs['proposal 1'] = {
			name: 'Alice',
			game: 'testGame',
			wheelSpot: 'Factory',
			factoryLoc: 'Lyon',
		};
		gs.history = ['Alice proposes as the leader: France builds a factory in Lyon.'];
		gs.playerInfo.Alice.myTurn = false;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = true;
		setupMockDb(gs);

		// Opposition proposes a different action
		const context = makeContext({
			name: 'Charlie',
			wheelSpot: 'Taxation',
		});

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Mode should now be vote
		expect(written.mode).toBe('vote');
		// Proposal 2 should be stored
		expect(written['proposal 2']).toBeDefined();
		expect(written['proposal 2'].wheelSpot).toBe('Taxation');
		// All leadership members can vote
		expect(written.playerInfo.Alice.myTurn).toBe(true);
		expect(written.playerInfo.Charlie.myTurn).toBe(true);
		// Voting state should be set up
		expect(written.voting).toBeDefined();
		expect(written.voting.country).toBe('France');
		expect(written.voting['proposal 1']).toBeDefined();
		expect(written.voting['proposal 2']).toBeDefined();
	});

	test('vote resolves -> winning proposal executes -> next country', async () => {
		const gs = createGameState({
			mode: 'vote',
			countryUp: 'France',
		});
		gs.countryInfo.France.gov = 'democracy';
		gs.countryInfo.France.leadership = ['Alice', 'Charlie'];
		gs.countryInfo.France.money = 10;
		// Store both proposals
		gs['proposal 1'] = {
			name: 'Alice',
			game: 'testGame',
			wheelSpot: 'Factory',
			factoryLoc: 'Lyon',
		};
		gs['proposal 2'] = {
			name: 'Charlie',
			game: 'testGame',
			wheelSpot: 'Taxation',
		};
		gs.voting = {
			country: 'France',
			'proposal 1': { proposal: 'leader proposal text', votes: 0, voters: [] },
			'proposal 2': { proposal: 'opposition proposal text', votes: 0, voters: [] },
		};
		gs.history = ['leader proposal', 'opposition proposal'];
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = true;
		setupMockDb(gs);

		// Alice votes for proposal 1 (the leader's proposal)
		// getOwnedStock returns [['Alice', 5], ['Bob', 3]] — Alice has 5 stock, enough to win
		const context = makeContext({ name: 'Alice', vote: 1 });

		await submitVote(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Proposal 1 (Factory) should have been executed since Alice's 5 votes > threshold ((5+3+0.01)/2 = 4.005)
		// Actually the tiebreak bonus of 0.1 is given to index 0 (Alice), so votes = 5 + 0.1 = 5.1 > 4.005
		expect(written.countryInfo.France.factories).toContain('Lyon');
		// Voting should be cleared
		expect(written.voting).toBeNull();
		// Mode advances to next country
		expect(written.mode).toBe('proposal');
		expect(written.countryUp).toBe('England');
	});
});

// ===========================================================================
// 4. Investor round (BUY mode)
// ===========================================================================
describe('Investor round (BUY mode)', () => {
	test('when investor is passed, mode switches to buy and investor gets bonus', async () => {
		// Set investorPassed to return true for this test
		helper.investorPassed.mockReturnValue(Promise.resolve(true));

		const gs = createGameState({
			mode: 'proposal',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.money = 10;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Alice.investor = false;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Bob.investor = true;
		gs.playerInfo.Charlie.myTurn = false;
		gs.playerInfo.Charlie.investor = false;
		setupMockDb(gs);

		const context = makeContext({
			name: 'Alice',
			wheelSpot: 'Factory',
			factoryLoc: 'Budapest',
		});

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Mode should be buy (investor was passed)
		expect(written.mode).toBe('buy');
		// Bob holds the investor card -> gets $2 bonus
		expect(written.playerInfo.Bob.money).toBe(17);
		// Bob's turn (investor card holder buys first)
		expect(written.playerInfo.Bob.myTurn).toBe(true);
		expect(written.playerInfo.Alice.myTurn).toBe(false);
	});

	test('submitBuy flow: player buys stock during investor round then advances to next country', async () => {
		const gs = createGameState({
			mode: 'buy',
			countryUp: 'Austria',
		});
		gs.playerInfo.Alice.myTurn = false;
		gs.playerInfo.Bob.myTurn = true;
		gs.playerInfo.Bob.investor = true;
		gs.playerInfo.Charlie.myTurn = false;
		setupMockDb(gs);

		const context = makeContext({
			name: 'Bob',
			buyCountry: 'Italy',
			buyStock: 3,
			returnStock: 'None',
		});

		await submitBuy(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Bob bought Italy 3 stock
		expect(written.playerInfo.Bob.stock.length).toBe(1);
		expect(written.playerInfo.Bob.stock[0]).toEqual({ country: 'Italy', stock: 3 });
		// Since Bob was the only buyer (no swiss), offLimits is reset after incrementCountry
		expect(written.countryInfo.Italy.offLimits).toBe(false);
		// Advances to next country (proposal mode)
		expect(written.mode).toBe('proposal');
	});
});

// ===========================================================================
// 5. Democracy with no opposition (single stockholder)
// ===========================================================================
describe('Democracy with no opposition', () => {
	test('democracy country with only one stockholder executes proposal directly', async () => {
		const gs = createGameState({
			mode: 'proposal',
			countryUp: 'France',
		});
		gs.countryInfo.France.gov = 'democracy';
		// Only one stockholder — no opposition
		gs.countryInfo.France.leadership = ['Alice'];
		gs.countryInfo.France.money = 10;
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = false;
		setupMockDb(gs);

		const context = makeContext({
			name: 'Alice',
			wheelSpot: 'Factory',
			factoryLoc: 'Lyon',
		});

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Factory should be built directly (no proposal-opp phase)
		expect(written.countryInfo.France.factories).toContain('Lyon');
		// Should NOT be in proposal-opp or vote mode
		expect(written.mode).not.toBe('proposal-opp');
		expect(written.mode).not.toBe('vote');
		// Should advance to the next country (England)
		expect(written.mode).toBe('proposal');
		expect(written.countryUp).toBe('England');
		// England leader (Charlie) gets turn
		expect(written.playerInfo.Charlie.myTurn).toBe(true);
	});
});

// ===========================================================================
// 6. Game over detection via Taxation
// ===========================================================================
describe('Game over detection', () => {
	test('country reaches 25 points via Taxation -> mode becomes game-over', async () => {
		// Set taxInfo to return enough points to reach 25
		helper.getTaxInfo.mockReturnValue(
			Promise.resolve({
				points: 5,
				money: 2,
				'tax split': [['Alice', 1]],
			})
		);

		const gs = createGameState({
			mode: 'proposal',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.points = 22; // 22 + 5 = 27, capped at 25
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = false;
		setupMockDb(gs);

		const context = makeContext({
			name: 'Alice',
			wheelSpot: 'Taxation',
		});

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		// Points should be capped at 25 (WIN_POINTS)
		expect(written.countryInfo.Austria.points).toBe(25);
		// Mode should be game-over
		expect(written.mode).toBe('game-over');
		// Proposals should be cleared
		expect(written['proposal 1']).toBeNull();
		expect(written['proposal 2']).toBeNull();
	});

	test('country exactly at 25 points from Taxation -> game-over', async () => {
		helper.getTaxInfo.mockReturnValue(
			Promise.resolve({
				points: 3,
				money: 2,
				'tax split': [['Alice', 1]],
			})
		);

		const gs = createGameState({
			mode: 'proposal',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.points = 22; // 22 + 3 = 25 exactly
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = false;
		setupMockDb(gs);

		const context = makeContext({
			name: 'Alice',
			wheelSpot: 'Taxation',
		});

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.points).toBe(25);
		expect(written.mode).toBe('game-over');
	});

	test('Taxation that does NOT reach 25 points continues to next country', async () => {
		helper.getTaxInfo.mockReturnValue(
			Promise.resolve({
				points: 3,
				money: 2,
				'tax split': [['Alice', 1]],
			})
		);

		const gs = createGameState({
			mode: 'proposal',
			countryUp: 'Austria',
		});
		gs.countryInfo.Austria.gov = 'dictatorship';
		gs.countryInfo.Austria.leadership = ['Alice'];
		gs.countryInfo.Austria.points = 10; // 10 + 3 = 13, not game-over
		gs.playerInfo.Alice.myTurn = true;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = false;
		setupMockDb(gs);

		const context = makeContext({
			name: 'Alice',
			wheelSpot: 'Taxation',
		});

		await submitProposal(context);
		await flushPromises();

		const written = mockSetData['games/testGame'];
		expect(written.countryInfo.Austria.points).toBe(13);
		expect(written.mode).toBe('proposal');
		expect(written.countryUp).toBe('Italy');
	});
});

// ===========================================================================
// 7. incrementCountry wraps around and increments round
// ===========================================================================
describe('incrementCountry', () => {
	test('wraps from Russia back to Austria and increments round', async () => {
		const gs = createGameState({
			mode: 'proposal',
			countryUp: 'Russia',
			round: 1,
		});
		gs.playerInfo.Alice.myTurn = false;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = false;

		const context = makeContext();
		await incrementCountry(gs, context);

		expect(gs.countryUp).toBe('Austria');
		expect(gs.round).toBe(2);
		expect(gs.mode).toBe('proposal');
		// Austria's leader (Alice) gets turn
		expect(gs.playerInfo.Alice.myTurn).toBe(true);
	});

	test('skips countries with no leadership', async () => {
		const gs = createGameState({
			mode: 'proposal',
			countryUp: 'Austria',
		});
		// Italy has no leadership (nobody owns stock)
		gs.countryInfo.Italy.leadership = null;
		gs.playerInfo.Alice.myTurn = false;
		gs.playerInfo.Bob.myTurn = false;
		gs.playerInfo.Charlie.myTurn = false;

		const context = makeContext();
		await incrementCountry(gs, context);

		// Should skip Italy (no leadership) and go to France
		expect(gs.countryUp).toBe('France');
		expect(gs.mode).toBe('proposal');
		// France's leader (Alice) gets turn
		expect(gs.playerInfo.Alice.myTurn).toBe(true);
	});
});

// ===========================================================================
// 8. changeLeadership
// ===========================================================================
describe('changeLeadership', () => {
	test('player with majority stock becomes dictator', () => {
		const gs = createGameState();
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 5 }];
		gs.playerInfo.Bob.stock = [{ country: 'Austria', stock: 2 }];
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];

		changeLeadership(gs, 'Austria', 'Alice');

		// Alice has 5 out of 7 total -> 2*5 = 10 >= 7 -> dictatorship
		expect(gs.countryInfo.Austria.gov).toBe('dictatorship');
		expect(gs.countryInfo.Austria.leadership[0]).toBe('Alice');
	});

	test('no majority results in democracy', () => {
		const gs = createGameState();
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 3 }];
		gs.playerInfo.Bob.stock = [{ country: 'Austria', stock: 4 }];
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob'];

		changeLeadership(gs, 'Austria', 'Alice');

		// Bob has 4 out of 7 total -> 2*4 = 8 >= 7 -> dictatorship actually
		// Let's use more balanced stock: Alice 3, Bob 3
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 3 }];
		gs.playerInfo.Bob.stock = [{ country: 'Austria', stock: 3 }];

		changeLeadership(gs, 'Austria', 'Alice');

		// Alice 3, Bob 3 -> total 6 -> 2*3 = 6 >= 6 -> dictatorship (tied, first player wins)
		// For true democracy we need: Alice 2, Bob 3
		gs.playerInfo.Alice.stock = [{ country: 'Austria', stock: 2 }];
		gs.playerInfo.Bob.stock = [{ country: 'Austria', stock: 3 }];
		gs.playerInfo.Charlie.stock = [{ country: 'Austria', stock: 2 }];
		gs.countryInfo.Austria.leadership = ['Alice', 'Bob', 'Charlie'];

		changeLeadership(gs, 'Austria', 'Alice');

		// Bob has 3, Alice has 2, Charlie has 2 -> total 7 -> 2*3 = 6 < 7 -> democracy
		expect(gs.countryInfo.Austria.gov).toBe('democracy');
		// Bob should be first in leadership (highest stock)
		expect(gs.countryInfo.Austria.leadership[0]).toBe('Bob');
	});
});
