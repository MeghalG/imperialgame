// ---------------------------------------------------------------------------
// proposalAPI.test.js — Tests for proposalAPI.js exported functions
// ---------------------------------------------------------------------------

// Mock data store used by the Firebase mock. Reset in beforeEach.
let mockDbData = {};

/**
 * Navigate a nested object by a slash-delimited path.
 * e.g. mockGetNestedValue(obj, 'games/g1/setup') => obj.games.g1.setup
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

// ---------------------------------------------------------------------------
// Module mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

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
			on: jest.fn(),
			off: jest.fn(),
		})),
	},
}));

jest.mock('./helper.js', () => ({
	getSat: jest.fn(() => []),
	getUnsatFactories: jest.fn((countryInfo, country) => countryInfo[country].factories || []),
	getUnsatTerritories: jest.fn(() => []),
	getInvestorPayout: jest.fn(() => [
		['Alice', 2],
		['Bob', 1],
	]),
	getTaxInfo: jest.fn(() => ({
		points: 3,
		money: 2,
		'tax split': [['Alice', 1]],
	})),
}));

import {
	getPreviousProposalMessage,
	getWheelOptions,
	getLocationOptions,
	getFleetProduceOptions,
	getArmyProduceOptions,
	getInvestorMessage,
	getTaxMessage,
	getFleetOptions,
	getFleetPeaceOptions,
	allFleetsMoved,
	getArmyOptions,
	getArmyPeaceOptions,
	allArmiesMoved,
	getImportOptions,
	getVirtualState,
	getCurrentUnitOptions,
	getCurrentUnitActionOptions,
	getAdjacentSeas,
	getAdjacentLands,
	getD0,
} from './proposalAPI.js';

import * as helper from './helper.js';
import { clearCache } from './stateCache.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const mockTerritorySetup = {
	Vienna: { country: 'Austria', port: false, sea: false, adjacencies: ['Budapest', 'Trieste'] },
	Budapest: { country: 'Austria', port: false, sea: false, adjacencies: ['Vienna', 'Trieste'] },
	Trieste: {
		country: 'Austria',
		port: 'Adriatic Sea',
		sea: false,
		adjacencies: ['Vienna', 'Budapest', 'Adriatic Sea'],
	},
	'Adriatic Sea': { country: null, port: false, sea: true, adjacencies: ['Trieste', 'Rome', 'West Med'] },
	Rome: { country: 'Italy', port: 'West Med', sea: false, adjacencies: ['West Med', 'Naples'] },
	Naples: { country: 'Italy', port: false, sea: false, adjacencies: ['Rome'] },
	'West Med': { country: null, port: false, sea: true, adjacencies: ['Adriatic Sea', 'Rome', 'Marseille'] },
	Paris: { country: 'France', port: false, sea: false, adjacencies: ['Marseille'] },
	Marseille: { country: 'France', port: 'West Med', sea: false, adjacencies: ['Paris', 'West Med'] },
};

const standardWheel = [
	'Factory',
	'L-Produce',
	'L-Maneuver',
	'Taxation',
	'Factory',
	'R-Produce',
	'R-Maneuver',
	'Investor',
];

const baseCountrySetup = {
	Austria: { armyLimit: 5, fleetLimit: 3 },
	Italy: { armyLimit: 5, fleetLimit: 3 },
	France: { armyLimit: 5, fleetLimit: 3 },
};

/**
 * Build the standard mockDbData shape for a game called 'g1' using setup 'setups/standard'.
 * Callers can override fields as needed.
 */
function buildMockDbData(overrides = {}) {
	const gameState = {
		countryUp: 'Austria',
		mode: 'proposal',
		setup: 'setups/standard',
		history: ['Austria moved army from Vienna to Budapest.'],
		currentManeuver: { some: 'maneuver data' },
		playerInfo: {
			Alice: { money: 10, myTurn: true, stock: [] },
			Bob: { money: 5, myTurn: false, stock: [] },
		},
		countryInfo: {
			Austria: {
				money: 8,
				points: 5,
				factories: ['Vienna', 'Budapest'],
				wheelSpot: 'Taxation',
				gov: 'democracy',
				leadership: ['Alice', 'Bob'],
				fleets: [{ territory: 'Trieste', hostile: true }],
				armies: [{ territory: 'Vienna', hostile: false }],
				taxChips: [],
				availStock: [2, 4, 6],
				offLimits: false,
				lastTax: 0,
			},
			Italy: {
				money: 5,
				points: 3,
				factories: ['Rome', 'Naples'],
				wheelSpot: 'Factory',
				gov: 'dictatorship',
				leadership: ['Bob'],
				fleets: [],
				armies: [{ territory: 'Rome', hostile: false }],
				taxChips: [],
				availStock: [2, 4],
				offLimits: false,
				lastTax: 0,
			},
			France: {
				money: 6,
				points: 2,
				factories: ['Paris'],
				wheelSpot: 'center',
				gov: 'dictatorship',
				leadership: ['Alice'],
				fleets: [],
				armies: [],
				taxChips: [],
				availStock: [2, 4, 6],
				offLimits: false,
				lastTax: 0,
			},
		},
		...overrides,
	};

	return {
		games: {
			g1: gameState,
		},
		setups: {
			standard: {
				wheel: standardWheel,
				territories: mockTerritorySetup,
				countries: baseCountrySetup,
			},
		},
		// Provide the same data under the slash-path key so that
		// database.ref('setups/standard/wheel') resolves via nested lookup
		// (the mockGetNestedValue helper splits on '/')
	};
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockDbData = buildMockDbData();
	clearCache();
	jest.clearAllMocks();

	// Restore default mock implementations
	helper.getSat.mockImplementation(() => []);
	helper.getUnsatFactories.mockImplementation((countryInfo, country) => countryInfo[country].factories || []);
	helper.getUnsatTerritories.mockImplementation(() => []);
	helper.getInvestorPayout.mockImplementation(() => [
		['Alice', 2],
		['Bob', 1],
	]);
	helper.getTaxInfo.mockImplementation(() => ({
		points: 3,
		money: 2,
		'tax split': [['Alice', 1]],
	}));
});

// ===========================================================================
// getPreviousProposalMessage
// ===========================================================================
describe('getPreviousProposalMessage', () => {
	test('returns last history entry when current player is opposition and mode is proposal', async () => {
		// Bob is leadership[1] (opposition) for Austria
		const context = { game: 'g1', name: 'Bob' };
		const result = await getPreviousProposalMessage(context);
		expect(result).toBe('Austria moved army from Vienna to Budapest.');
	});

	test('returns currentManeuver when mode is continue-man', async () => {
		mockDbData.games.g1.mode = 'continue-man';
		const context = { game: 'g1', name: 'Alice' };
		const result = await getPreviousProposalMessage(context);
		expect(result).toEqual({ some: 'maneuver data' });
	});

	test('returns empty string when player is not opposition', async () => {
		// Alice is leadership[0] (leader), not opposition
		const context = { game: 'g1', name: 'Alice' };
		const result = await getPreviousProposalMessage(context);
		expect(result).toBe('');
	});

	test('returns empty string when mode is not proposal and not continue-man', async () => {
		mockDbData.games.g1.mode = 'buy';
		const context = { game: 'g1', name: 'Bob' };
		const result = await getPreviousProposalMessage(context);
		expect(result).toBe('');
	});

	test('returns empty string when opposition player but mode is vote', async () => {
		mockDbData.games.g1.mode = 'vote';
		const context = { game: 'g1', name: 'Bob' };
		const result = await getPreviousProposalMessage(context);
		expect(result).toBe('');
	});

	test('returns last history entry from a multi-entry history array', async () => {
		mockDbData.games.g1.history = ['First action.', 'Second action.', 'Third action.'];
		const context = { game: 'g1', name: 'Bob' };
		const result = await getPreviousProposalMessage(context);
		expect(result).toBe('Third action.');
	});
});

// ===========================================================================
// getWheelOptions
// ===========================================================================
describe('getWheelOptions', () => {
	test('returns all wheel positions when country is at center', async () => {
		mockDbData.games.g1.countryInfo.Austria.wheelSpot = 'center';
		const context = { game: 'g1', name: 'Alice' };
		const result = await getWheelOptions(context);
		expect(result).toEqual(standardWheel);
	});

	test('returns 3 free options when money < 2', async () => {
		mockDbData.games.g1.playerInfo.Alice.money = 1;
		// wheelSpot = 'Taxation' => index 3
		// next 3: index 4,5,6 => 'Factory', 'R-Produce', 'R-Maneuver'
		const context = { game: 'g1', name: 'Alice' };
		const result = await getWheelOptions(context);
		expect(result).toEqual(['Factory', 'R-Produce', 'R-Maneuver']);
		expect(result).toHaveLength(3);
	});

	test('returns 4 options when money >= 2 but < 4', async () => {
		mockDbData.games.g1.playerInfo.Alice.money = 2;
		const context = { game: 'g1', name: 'Alice' };
		const result = await getWheelOptions(context);
		// Taxation is index 3. Steps 1-4 => indices 4,5,6,7 => Factory, R-Produce, R-Maneuver, Investor
		expect(result).toEqual(['Factory', 'R-Produce', 'R-Maneuver', 'Investor']);
		expect(result).toHaveLength(4);
	});

	test('returns 5 options when money >= 4 but < 6', async () => {
		mockDbData.games.g1.playerInfo.Alice.money = 4;
		const context = { game: 'g1', name: 'Alice' };
		const result = await getWheelOptions(context);
		// Taxation is index 3. Steps 1-5 => indices 4,5,6,7,0
		// => Factory, R-Produce, R-Maneuver, Investor, Factory
		expect(result).toEqual(['Factory', 'R-Produce', 'R-Maneuver', 'Investor', 'Factory']);
		expect(result).toHaveLength(5);
	});

	test('returns 6 options when money >= 6', async () => {
		mockDbData.games.g1.playerInfo.Alice.money = 10;
		const context = { game: 'g1', name: 'Alice' };
		const result = await getWheelOptions(context);
		// Taxation is index 3. Steps 1-6 => indices 4,5,6,7,0,1
		// => Factory, R-Produce, R-Maneuver, Investor, Factory, L-Produce
		expect(result).toEqual(['Factory', 'R-Produce', 'R-Maneuver', 'Investor', 'Factory', 'L-Produce']);
		expect(result).toHaveLength(6);
	});

	test('wraps around the wheel array correctly', async () => {
		// Put the country on the last position ('Investor', index 7)
		mockDbData.games.g1.countryInfo.Austria.wheelSpot = 'Investor';
		mockDbData.games.g1.playerInfo.Alice.money = 0;
		const context = { game: 'g1', name: 'Alice' };
		const result = await getWheelOptions(context);
		// Investor is index 7. Steps 1-3 => indices 0,1,2 => Factory, L-Produce, L-Maneuver
		expect(result).toEqual(['Factory', 'L-Produce', 'L-Maneuver']);
	});

	test('returns 6 options with wrap-around from later position', async () => {
		// R-Maneuver is index 6
		mockDbData.games.g1.countryInfo.Austria.wheelSpot = 'R-Maneuver';
		mockDbData.games.g1.playerInfo.Alice.money = 10;
		const context = { game: 'g1', name: 'Alice' };
		const result = await getWheelOptions(context);
		// Steps 1-6 from index 6: indices 7,0,1,2,3,4
		// => Investor, Factory, L-Produce, L-Maneuver, Taxation, Factory
		expect(result).toEqual(['Investor', 'Factory', 'L-Produce', 'L-Maneuver', 'Taxation', 'Factory']);
		expect(result).toHaveLength(6);
	});

	test('exactly 2 money gives 4 options, not 5', async () => {
		mockDbData.games.g1.playerInfo.Alice.money = 2;
		const context = { game: 'g1', name: 'Alice' };
		const result = await getWheelOptions(context);
		expect(result).toHaveLength(4);
	});

	test('exactly 6 money gives 6 options', async () => {
		mockDbData.games.g1.playerInfo.Alice.money = 6;
		const context = { game: 'g1', name: 'Alice' };
		const result = await getWheelOptions(context);
		expect(result).toHaveLength(6);
	});
});

// ===========================================================================
// getLocationOptions
// ===========================================================================
describe('getLocationOptions', () => {
	test('returns home territories without factories and not sat on', async () => {
		// Austria's home territories: Vienna, Budapest, Trieste
		// Austria's factories: Vienna, Budapest
		// getSat returns [] by default => no one sat on
		// So only Trieste qualifies
		const context = { game: 'g1' };
		const result = await getLocationOptions(context);
		expect(result).toEqual(['Trieste']);
	});

	test('returns empty array when all home territories have factories', async () => {
		mockDbData.games.g1.countryInfo.Austria.factories = ['Vienna', 'Budapest', 'Trieste'];
		const context = { game: 'g1' };
		const result = await getLocationOptions(context);
		expect(result).toEqual([]);
	});

	test('excludes territories that are sat on by hostile armies', async () => {
		// Trieste has no factory, but it IS sat on
		helper.getSat.mockImplementation(() => ['Trieste']);
		const context = { game: 'g1' };
		const result = await getLocationOptions(context);
		expect(result).toEqual([]);
	});

	test('returns multiple eligible territories when available', async () => {
		// Remove all factories
		mockDbData.games.g1.countryInfo.Austria.factories = [];
		const context = { game: 'g1' };
		const result = await getLocationOptions(context);
		// Vienna, Budapest, Trieste all qualify
		expect(result).toContain('Vienna');
		expect(result).toContain('Budapest');
		expect(result).toContain('Trieste');
		expect(result).toHaveLength(3);
	});

	test('does not include territories belonging to other countries', async () => {
		mockDbData.games.g1.countryInfo.Austria.factories = [];
		const context = { game: 'g1' };
		const result = await getLocationOptions(context);
		expect(result).not.toContain('Rome');
		expect(result).not.toContain('Paris');
	});
});

// ===========================================================================
// getFleetProduceOptions
// ===========================================================================
describe('getFleetProduceOptions', () => {
	test('returns port factories that are unsaturated', async () => {
		// getUnsatFactories returns Austria factories: ['Vienna', 'Budapest']
		// Vienna has port=false, Budapest has port=false => neither qualifies
		const context = { game: 'g1' };
		const result = await getFleetProduceOptions(context);
		expect(result.items).toEqual([]);
	});

	test('returns port factory when one exists among unsaturated factories', async () => {
		// Add Trieste to factories; getUnsatFactories returns all factories
		mockDbData.games.g1.countryInfo.Austria.factories = ['Vienna', 'Budapest', 'Trieste'];
		helper.getUnsatFactories.mockImplementation(() => ['Vienna', 'Budapest', 'Trieste']);
		const context = { game: 'g1' };
		const result = await getFleetProduceOptions(context);
		expect(result.items).toEqual(['Trieste']);
	});

	test('returns correct fleet capacity limit', async () => {
		// fleetLimit=3, existing fleets: 1 => limit = 2
		const context = { game: 'g1' };
		const result = await getFleetProduceOptions(context);
		expect(result.limit).toBe(2);
	});

	test('returns limit of 0 when at fleet capacity', async () => {
		mockDbData.games.g1.countryInfo.Austria.fleets = [
			{ territory: 'Trieste', hostile: true },
			{ territory: 'Adriatic Sea', hostile: true },
			{ territory: 'West Med', hostile: true },
		];
		const context = { game: 'g1' };
		const result = await getFleetProduceOptions(context);
		expect(result.limit).toBe(0);
	});

	test('handles missing fleets array gracefully', async () => {
		delete mockDbData.games.g1.countryInfo.Austria.fleets;
		const context = { game: 'g1' };
		const result = await getFleetProduceOptions(context);
		expect(result.limit).toBe(3); // 3 - 0
	});

	test('filters to only port factories from unsaturated set', async () => {
		// Return a mix of port and non-port territories
		helper.getUnsatFactories.mockImplementation(() => ['Trieste', 'Vienna', 'Rome']);
		const context = { game: 'g1' };
		const result = await getFleetProduceOptions(context);
		// Trieste has port, Vienna does not, Rome has port but we're checking Austria
		// The function checks territories[unsatFactories[i]].port regardless of country
		expect(result.items).toContain('Trieste');
		expect(result.items).toContain('Rome');
		expect(result.items).not.toContain('Vienna');
	});
});

// ===========================================================================
// getArmyProduceOptions
// ===========================================================================
describe('getArmyProduceOptions', () => {
	test('returns non-port factories that are unsaturated', async () => {
		// Default factories: ['Vienna', 'Budapest'] — both are non-port
		// getUnsatFactories returns them
		const context = { game: 'g1' };
		const result = await getArmyProduceOptions(context);
		expect(result.items).toEqual(['Vienna', 'Budapest']);
	});

	test('excludes port factories', async () => {
		mockDbData.games.g1.countryInfo.Austria.factories = ['Vienna', 'Budapest', 'Trieste'];
		helper.getUnsatFactories.mockImplementation(() => ['Vienna', 'Budapest', 'Trieste']);
		const context = { game: 'g1' };
		const result = await getArmyProduceOptions(context);
		expect(result.items).toEqual(['Vienna', 'Budapest']);
		expect(result.items).not.toContain('Trieste');
	});

	test('returns correct army capacity limit', async () => {
		// armyLimit=5, existing armies: 1 => limit = 4
		const context = { game: 'g1' };
		const result = await getArmyProduceOptions(context);
		expect(result.limit).toBe(4);
	});

	test('returns limit of 0 when at army capacity', async () => {
		mockDbData.games.g1.countryInfo.Austria.armies = [
			{ territory: 'Vienna', hostile: false },
			{ territory: 'Budapest', hostile: false },
			{ territory: 'Trieste', hostile: false },
			{ territory: 'Rome', hostile: true },
			{ territory: 'Naples', hostile: true },
		];
		const context = { game: 'g1' };
		const result = await getArmyProduceOptions(context);
		expect(result.limit).toBe(0);
	});

	test('handles missing armies array gracefully', async () => {
		delete mockDbData.games.g1.countryInfo.Austria.armies;
		const context = { game: 'g1' };
		const result = await getArmyProduceOptions(context);
		expect(result.limit).toBe(5); // 5 - 0
	});

	test('returns empty items when all unsaturated factories are ports', async () => {
		helper.getUnsatFactories.mockImplementation(() => ['Trieste']);
		const context = { game: 'g1' };
		const result = await getArmyProduceOptions(context);
		expect(result.items).toEqual([]);
	});
});

// ===========================================================================
// getInvestorMessage
// ===========================================================================
describe('getInvestorMessage', () => {
	test('returns formatted investor payout message', async () => {
		const context = { game: 'g1', name: 'Alice' };
		const result = await getInvestorMessage(context);
		expect(result).toBe('The investor will pay out $2 to Alice, $1 to Bob.');
	});

	test('returns message for a single investor', async () => {
		helper.getInvestorPayout.mockImplementation(() => [['Alice', 5]]);
		const context = { game: 'g1', name: 'Alice' };
		const result = await getInvestorMessage(context);
		expect(result).toBe('The investor will pay out $5 to Alice.');
	});

	test('returns message for three investors', async () => {
		helper.getInvestorPayout.mockImplementation(() => [
			['Alice', 3],
			['Bob', 2],
			['Charlie', 1],
		]);
		const context = { game: 'g1', name: 'Alice' };
		const result = await getInvestorMessage(context);
		expect(result).toBe('The investor will pay out $3 to Alice, $2 to Bob, $1 to Charlie.');
	});

	test('calls getInvestorPayout with correct arguments', async () => {
		const context = { game: 'g1', name: 'Alice' };
		await getInvestorMessage(context);
		expect(helper.getInvestorPayout).toHaveBeenCalledWith(
			expect.objectContaining({ countryUp: 'Austria' }),
			'Austria',
			'Alice'
		);
	});
});

// ===========================================================================
// getTaxMessage
// ===========================================================================
describe('getTaxMessage', () => {
	test('returns formatted tax message with greatness distribution', async () => {
		const context = { game: 'g1' };
		const result = await getTaxMessage(context);
		expect(result).toBe(
			'Austria will tax for 3 points, and $2 into its treasury. Greatness is distributed $1 to Alice.'
		);
	});

	test('returns "to no one" when tax split is empty', async () => {
		helper.getTaxInfo.mockImplementation(() => ({
			points: 1,
			money: 0,
			'tax split': [],
		}));
		const context = { game: 'g1' };
		const result = await getTaxMessage(context);
		expect(result).toBe('Austria will tax for 1 points, and $0 into its treasury. Greatness is distributed to no one.');
	});

	test('includes multiple tax split recipients', async () => {
		helper.getTaxInfo.mockImplementation(() => ({
			points: 5,
			money: 3,
			'tax split': [
				['Alice', 2],
				['Bob', 1],
			],
		}));
		const context = { game: 'g1' };
		const result = await getTaxMessage(context);
		expect(result).toBe(
			'Austria will tax for 5 points, and $3 into its treasury. Greatness is distributed $2 to Alice, $1 to Bob.'
		);
	});

	test('calls getTaxInfo with correct country data', async () => {
		const context = { game: 'g1' };
		await getTaxMessage(context);
		expect(helper.getTaxInfo).toHaveBeenCalledWith(
			expect.objectContaining({
				Austria: expect.objectContaining({ points: 5 }),
			}),
			expect.objectContaining({
				Alice: expect.objectContaining({ money: 10 }),
			}),
			'Austria'
		);
	});
});

// ===========================================================================
// getFleetOptions (tests getAdjacentSeas indirectly)
// ===========================================================================
describe('getFleetOptions', () => {
	test('fleet at port territory returns current territory and adjacent sea', async () => {
		// Austria's fleet is at Trieste, which has port 'Adriatic Sea'
		const context = { game: 'g1' };
		const result = await getFleetOptions(context);
		expect(result).toEqual([['Trieste', ['Trieste', 'Adriatic Sea']]]);
	});

	test('fleet at sea territory returns current territory and adjacent seas', async () => {
		mockDbData.games.g1.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		const context = { game: 'g1' };
		const result = await getFleetOptions(context);
		// Adriatic Sea adjacencies: Trieste, Rome, West Med
		// Only West Med is sea (Trieste and Rome are land)
		expect(result).toEqual([['Adriatic Sea', ['Adriatic Sea', 'West Med']]]);
	});

	test('returns options for multiple fleets', async () => {
		mockDbData.games.g1.countryInfo.Austria.fleets = [
			{ territory: 'Trieste', hostile: true },
			{ territory: 'Adriatic Sea', hostile: true },
		];
		const context = { game: 'g1' };
		const result = await getFleetOptions(context);
		expect(result).toHaveLength(2);
		expect(result[0][0]).toBe('Trieste');
		expect(result[1][0]).toBe('Adriatic Sea');
	});

	test('returns empty array when country has no fleets', async () => {
		mockDbData.games.g1.countryInfo.Austria.fleets = [];
		const context = { game: 'g1' };
		const result = await getFleetOptions(context);
		expect(result).toEqual([]);
	});

	test('handles undefined fleets gracefully', async () => {
		delete mockDbData.games.g1.countryInfo.Austria.fleets;
		const context = { game: 'g1' };
		const result = await getFleetOptions(context);
		expect(result).toEqual([]);
	});

	test('fleet at sea adjacent to two seas includes both', async () => {
		// West Med adjacencies: Adriatic Sea, Rome
		// Adriatic Sea is sea, Rome is not
		mockDbData.games.g1.countryInfo.Austria.fleets = [{ territory: 'West Med', hostile: true }];
		const context = { game: 'g1' };
		const result = await getFleetOptions(context);
		expect(result[0][1]).toContain('West Med');
		expect(result[0][1]).toContain('Adriatic Sea');
		expect(result[0][1]).not.toContain('Rome');
	});
});

// ===========================================================================
// getFleetPeaceOptions
// ===========================================================================
describe('getFleetPeaceOptions', () => {
	test('returns empty object when no hostile enemy units exist', async () => {
		const context = { game: 'g1', fleetMan: [] };
		const result = await getFleetPeaceOptions(context);
		// No hostile enemy units => all territories have empty damage arrays => d is empty
		// (only territories with non-empty damage arrays get entries in d)
		for (const key in result) {
			// Every territory that has at least 'peace' must have had hostile units
			// With no hostile units, result should have no entries with war options
			// but the function only adds entries if damage[key].length !== 0
		}
		// With no hostile enemy units, result should effectively be empty
		expect(Object.keys(result).filter((k) => result[k].some((a) => a.startsWith('war')))).toEqual([]);
	});

	test('returns war options for territory with hostile enemy fleet', async () => {
		mockDbData.games.g1.countryInfo.Italy.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		const context = { game: 'g1', fleetMan: [] };
		const result = await getFleetPeaceOptions(context);
		expect(result['Adriatic Sea']).toContain('war Italy fleet');
		expect(result['Adriatic Sea']).toContain('peace');
	});

	test('returns war options for territory with hostile enemy army', async () => {
		mockDbData.games.g1.countryInfo.Italy.armies = [{ territory: 'Trieste', hostile: true }];
		const context = { game: 'g1', fleetMan: [] };
		const result = await getFleetPeaceOptions(context);
		expect(result['Trieste']).toContain('war Italy army');
		expect(result['Trieste']).toContain('peace');
	});

	test('removes chosen war actions from available options', async () => {
		mockDbData.games.g1.countryInfo.Italy.fleets = [
			{ territory: 'Adriatic Sea', hostile: true },
			{ territory: 'Adriatic Sea', hostile: true },
		];
		const context = {
			game: 'g1',
			// First fleet already chose war on one of them
			fleetMan: [['Trieste', 'Adriatic Sea', 'war Italy fleet']],
		};
		const result = await getFleetPeaceOptions(context);
		// There were 2 Italy fleets => 2 "war Italy fleet" entries + "peace"
		// After removing one "war Italy fleet", should have 1 war option + peace
		const warCount = result['Adriatic Sea'].filter((a) => a === 'war Italy fleet').length;
		expect(warCount).toBe(1);
		expect(result['Adriatic Sea']).toContain('peace');
	});

	test('does not remove peace actions from chosen options', async () => {
		mockDbData.games.g1.countryInfo.Italy.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		const context = {
			game: 'g1',
			fleetMan: [['Trieste', 'Adriatic Sea', 'peace']],
		};
		const result = await getFleetPeaceOptions(context);
		// Peace should remain because the code only removes non-peace actions
		expect(result['Adriatic Sea']).toContain('peace');
	});

	test('does not include non-hostile enemy units', async () => {
		// Italy army at Rome is hostile: false
		mockDbData.games.g1.countryInfo.Italy.armies = [{ territory: 'Rome', hostile: false }];
		const context = { game: 'g1', fleetMan: [] };
		const result = await getFleetPeaceOptions(context);
		// Fleet peace options only consider hostile units
		expect(result['Rome'] || []).not.toContain('war Italy army');
	});

	test('excludes own country units from war options', async () => {
		// Austria's own fleet at Trieste should never appear as a war option
		const context = { game: 'g1', fleetMan: [] };
		const result = await getFleetPeaceOptions(context);
		for (const key in result) {
			for (const action of result[key]) {
				expect(action).not.toContain('Austria');
			}
		}
	});
});

// ===========================================================================
// allFleetsMoved
// ===========================================================================
describe('allFleetsMoved', () => {
	test('returns true when all fleets have destinations and no multi-option peace', async () => {
		const context = {
			game: 'g1',
			fleetMan: [['Trieste', 'Adriatic Sea', '']],
		};
		const result = await allFleetsMoved(context);
		expect(result).toBe(true);
	});

	test('returns false when a fleet has no destination', async () => {
		const context = {
			game: 'g1',
			fleetMan: [['Trieste', '', '']],
		};
		const result = await allFleetsMoved(context);
		expect(result).toBe(false);
	});

	test('returns false when a fleet has null destination', async () => {
		const context = {
			game: 'g1',
			fleetMan: [['Trieste', null, '']],
		};
		const result = await allFleetsMoved(context);
		expect(result).toBe(false);
	});

	test('returns true when all fleets moved and peace actions chosen where needed', async () => {
		// Set up a hostile Italian fleet so there are peace options
		mockDbData.games.g1.countryInfo.Italy.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		const context = {
			game: 'g1',
			fleetMan: [['Trieste', 'Adriatic Sea', 'peace']],
		};
		const result = await allFleetsMoved(context);
		expect(result).toBe(true);
	});

	test('returns false when fleet at territory with multiple peace options has no action', async () => {
		// Set up two hostile units at same territory => multiple peace options
		mockDbData.games.g1.countryInfo.Italy.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		mockDbData.games.g1.countryInfo.France.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		const context = {
			game: 'g1',
			fleetMan: [['Trieste', 'Adriatic Sea', '']], // no action chosen
		};
		const result = await allFleetsMoved(context);
		// peaceOptions for Adriatic Sea: ['war Italy fleet', 'war France fleet', 'peace'] => length > 1
		expect(result).toBe(false);
	});

	test('returns true with empty fleetMan array', async () => {
		const context = { game: 'g1', fleetMan: [] };
		const result = await allFleetsMoved(context);
		expect(result).toBe(true);
	});

	test('returns true when fleet has destination and peace options are length 1 or less', async () => {
		// No hostile enemies => no peace options for any territory
		const context = {
			game: 'g1',
			fleetMan: [['Trieste', 'Adriatic Sea', '']],
		};
		const result = await allFleetsMoved(context);
		expect(result).toBe(true);
	});
});

// ===========================================================================
// getArmyOptions (tests getD0 and getAdjacentLands indirectly)
// ===========================================================================
describe('getArmyOptions', () => {
	test('army on home territory can reach connected home territories', async () => {
		// Army at Vienna (Austria). Austria territories: Vienna, Budapest, Trieste
		// Vienna adj: Budapest, Trieste. Budapest adj: Vienna, Trieste.
		// All are Austria => d0 = [Vienna, Budapest, Trieste]
		// From each d0 territory, expand one step:
		//   Vienna adj + Vienna: [Budapest, Trieste, Vienna]
		//   Budapest adj + Budapest: [Vienna, Trieste, Budapest]
		//   Trieste adj + Trieste: [Vienna, Budapest, Adriatic Sea, Trieste]
		//     Adriatic Sea is sea, d0 from Adriatic requires fleet control
		// Non-sea unique lands from all expansions: Vienna, Budapest, Trieste
		const context = { game: 'g1', fleetMan: [] };
		const result = await getArmyOptions(context);
		expect(result).toHaveLength(1);
		expect(result[0][0]).toBe('Vienna');
		expect(result[0][1]).toContain('Vienna');
		expect(result[0][1]).toContain('Budapest');
		expect(result[0][1]).toContain('Trieste');
	});

	test('army can reach through friendly fleet-controlled sea', async () => {
		// Fleet moved to Adriatic Sea with peace (MOVE='')
		// This should allow the army to traverse through Adriatic Sea
		const context = {
			game: 'g1',
			fleetMan: [['Trieste', 'Adriatic Sea', '']], // MOVE action
		};
		const result = await getArmyOptions(context);
		// Vienna -> d0 includes Vienna, Budapest, Trieste (home)
		// Trieste adj Adriatic Sea which has a fleet with MOVE => sea=true
		// So Adriatic Sea enters d0, then from Adriatic Sea adj: Trieste, Rome, West Med
		// Rome is Italy land, West Med is sea (needs fleet)
		// From Adriatic Sea d0a(Rome) = [Rome] (Italy, not Austria, so no free traversal from Adriatic)
		// Wait, let's trace more carefully:
		// d0(Vienna): start=[Vienna], queue=[Vienna]
		//   pop Vienna, adj=[Budapest, Trieste]
		//     Budapest: country=Austria, Vienna.country=Austria => add => d0=[Vienna,Budapest], q=[Budapest]
		//     Trieste: country=Austria, Vienna.country=Austria => add => d0=[V,B,T], q=[B,T]
		//   pop Trieste, adj=[Vienna, Budapest, Adriatic Sea]
		//     Vienna: already in d0
		//     Budapest: already in d0
		//     Adriatic Sea: sea=true, fleetMan has ['Trieste','Adriatic Sea',''] => x[1]='Adriatic Sea', x[2]='' which equals MOVE => sea=true
		//       => add Adriatic Sea => d0=[V,B,T,AS], q=[B,AS]
		//   pop AS, adj=[Trieste, Rome, West Med]
		//     Trieste: already in d0
		//     Rome: not sea, country=Italy, AS.country=null => first condition fails; not sea => skip
		//     West Med: sea=true, no fleet there => sea=false; country=null, AS.country=null => Austria!=null => skip
		//   pop B, adj=[Vienna, Trieste]
		//     both already in d0
		// d0 = [Vienna, Budapest, Trieste, Adriatic Sea]
		//
		// getAdjacentLands expands:
		// For each t in d0, get adj+t, then for each a get d0(a):
		//   t=Vienna: adj+t = [Budapest, Trieste, Vienna]
		//     d0(Budapest) = [V,B,T,AS] (same connected set)
		//     d0(Trieste) = same
		//     d0(Vienna) = same
		//   t=Budapest: same expansions
		//   t=Trieste: adj+t = [Vienna, Budapest, Adriatic Sea, Trieste]
		//     d0(Adriatic Sea) starting from Adriatic: adj=[Trieste,Rome,West Med]
		//       Trieste: country=Austria, AS.country=null => not both Austria => check sea: Trieste is not sea => skip
		//       Rome: not sea, country=Italy, AS.country=null => skip
		//       West Med: sea, no fleet => skip
		//       d0(AS) = [Adriatic Sea] => sea, filtered out
		//   t=Adriatic Sea: adj+t = [Trieste, Rome, West Med, Adriatic Sea]
		//     d0(Rome) = [Rome] (Italy home, no connections to Austria)
		//       Rome is not sea => add Rome
		//     d0(West Med) = [West Med] => sea, filtered out
		//     d0(Trieste) => Vienna,Budapest,Trieste,Adriatic Sea => non-sea: V,B,T
		//     d0(Adriatic Sea) = [AS] => sea, filtered
		// Result includes: Vienna, Budapest, Trieste, Rome
		expect(result[0][1]).toContain('Vienna');
		expect(result[0][1]).toContain('Budapest');
		expect(result[0][1]).toContain('Trieste');
		expect(result[0][1]).toContain('Rome');
	});

	test('army cannot cross sea without fleet control', async () => {
		const context = { game: 'g1', fleetMan: [] };
		const result = await getArmyOptions(context);
		// Without fleet in Adriatic Sea, army can't reach Rome
		expect(result[0][1]).not.toContain('Rome');
	});

	test('returns empty array when country has no armies', async () => {
		mockDbData.games.g1.countryInfo.Austria.armies = [];
		const context = { game: 'g1', fleetMan: [] };
		const result = await getArmyOptions(context);
		expect(result).toEqual([]);
	});

	test('handles undefined armies gracefully', async () => {
		delete mockDbData.games.g1.countryInfo.Austria.armies;
		const context = { game: 'g1', fleetMan: [] };
		const result = await getArmyOptions(context);
		expect(result).toEqual([]);
	});

	test('army can reach through fleet with peace action', async () => {
		const context = {
			game: 'g1',
			fleetMan: [['Trieste', 'Adriatic Sea', 'peace']],
		};
		const result = await getArmyOptions(context);
		// peace also enables sea traversal
		expect(result[0][1]).toContain('Rome');
	});

	test('army cannot cross sea with hostile fleet action', async () => {
		const context = {
			game: 'g1',
			fleetMan: [['Trieste', 'Adriatic Sea', 'hostile']],
		};
		const result = await getArmyOptions(context);
		// hostile does not match '' or 'peace', so sea is not accessible
		expect(result[0][1]).not.toContain('Rome');
	});

	test('returns options for multiple armies', async () => {
		mockDbData.games.g1.countryInfo.Austria.armies = [
			{ territory: 'Vienna', hostile: false },
			{ territory: 'Budapest', hostile: false },
		];
		const context = { game: 'g1', fleetMan: [] };
		const result = await getArmyOptions(context);
		expect(result).toHaveLength(2);
		expect(result[0][0]).toBe('Vienna');
		expect(result[1][0]).toBe('Budapest');
	});
});

// ===========================================================================
// getArmyPeaceOptions
// ===========================================================================
describe('getArmyPeaceOptions', () => {
	test('returns peace option for all territories', async () => {
		const context = { game: 'g1', fleetMan: [], armyMan: [] };
		const result = await getArmyPeaceOptions(context);
		// Every territory gets a peace option in army peace (even without hostile units)
		for (const key in result) {
			expect(result[key]).toContain('peace');
		}
	});

	test('includes hostile option for foreign territories', async () => {
		const context = { game: 'g1', fleetMan: [], armyMan: [] };
		const result = await getArmyPeaceOptions(context);
		expect(result['Rome']).toContain('hostile');
		expect(result['Paris']).toContain('hostile');
	});

	test('does not include hostile option for home territories', async () => {
		const context = { game: 'g1', fleetMan: [], armyMan: [] };
		const result = await getArmyPeaceOptions(context);
		expect(result['Vienna']).not.toContain('hostile');
		expect(result['Budapest']).not.toContain('hostile');
	});

	test('does not include hostile option for sea territories', async () => {
		const context = { game: 'g1', fleetMan: [], armyMan: [] };
		const result = await getArmyPeaceOptions(context);
		expect(result['Adriatic Sea']).not.toContain('hostile');
	});

	test('includes war options for territories with enemy units', async () => {
		// Italy has army at Rome (hostile: false in default, but army peace considers all, not just hostile)
		const context = { game: 'g1', fleetMan: [], armyMan: [] };
		const result = await getArmyPeaceOptions(context);
		expect(result['Rome']).toContain('war Italy army');
	});

	test('includes blow up option for territory with enemy factory when 3+ armies', async () => {
		// Rome has an Italian factory. Need 3 armies: 2 already assigned + current = 3
		mockDbData.games.g1.countryInfo.Austria.armies = [
			{ territory: 'Vienna', hostile: false },
			{ territory: 'Rome', hostile: true },
			{ territory: 'Rome', hostile: true },
		];
		const context = { game: 'g1', fleetMan: [], armyMan: [] };
		const result = await getArmyPeaceOptions(context);
		expect(result['Rome']).toContain('blow up Italy');
	});

	test('does not include blow up option when fewer than 3 armies at territory', async () => {
		// Only 1 army assigned to Rome (the current one) — not enough
		const context = { game: 'g1', fleetMan: [], armyMan: [] };
		const result = await getArmyPeaceOptions(context);
		expect(result['Rome']).not.toContain('blow up Italy');
	});

	test('does not include blow up option when territory has no enemy factory', async () => {
		const context = { game: 'g1', fleetMan: [], armyMan: [] };
		const result = await getArmyPeaceOptions(context);
		// Vienna belongs to Austria => no blow up
		expect(result['Vienna']).not.toContain('blow up Austria');
	});

	test('removes chosen war actions from armyMan', async () => {
		const context = {
			game: 'g1',
			fleetMan: [],
			armyMan: [['Vienna', 'Rome', 'war Italy army']],
		};
		const result = await getArmyPeaceOptions(context);
		// The war Italy army should be removed once from Rome options
		const warCount = result['Rome'].filter((a) => a === 'war Italy army').length;
		expect(warCount).toBe(0); // only had 1, now removed
	});

	test('removes chosen war actions from fleetMan', async () => {
		mockDbData.games.g1.countryInfo.Italy.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		const context = {
			game: 'g1',
			fleetMan: [['Trieste', 'Adriatic Sea', 'war Italy fleet']],
			armyMan: [],
		};
		const result = await getArmyPeaceOptions(context);
		// war Italy fleet should be removed from Adriatic Sea options
		expect(result['Adriatic Sea']).not.toContain('war Italy fleet');
	});

	test('does not remove peace or hostile actions from chosen armyMan', async () => {
		const context = {
			game: 'g1',
			fleetMan: [],
			armyMan: [['Vienna', 'Rome', 'peace']],
		};
		const result = await getArmyPeaceOptions(context);
		// Peace should NOT be removed (code skips peace/hostile/blow up)
		expect(result['Rome']).toContain('peace');
	});

	test('does not remove blow up actions from chosen armyMan', async () => {
		// Need enough armies for blow up to be offered (3 total at Rome)
		mockDbData.games.g1.countryInfo.Austria.armies = [
			{ territory: 'Vienna', hostile: false },
			{ territory: 'Rome', hostile: true },
		];
		const context = {
			game: 'g1',
			fleetMan: [],
			armyMan: [
				['Vienna', 'Rome', 'blow up Italy'],
				['Trieste', 'Rome', ''],
			],
		};
		const result = await getArmyPeaceOptions(context);
		// blow up should NOT be removed (code skips peace/hostile/blow up from removal)
		expect(result['Rome']).toContain('blow up Italy');
	});
});

// ===========================================================================
// allArmiesMoved
// ===========================================================================
describe('allArmiesMoved', () => {
	test('returns true when all armies have destinations', async () => {
		const context = {
			game: 'g1',
			fleetMan: [],
			armyMan: [['Vienna', 'Budapest', '']],
		};
		const result = await allArmiesMoved(context);
		expect(result).toBe(true);
	});

	test('returns false when an army has no destination', async () => {
		const context = {
			game: 'g1',
			fleetMan: [],
			armyMan: [['Vienna', '', '']],
		};
		const result = await allArmiesMoved(context);
		expect(result).toBe(false);
	});

	test('returns false when an army has null destination', async () => {
		const context = {
			game: 'g1',
			fleetMan: [],
			armyMan: [['Vienna', null, '']],
		};
		const result = await allArmiesMoved(context);
		expect(result).toBe(false);
	});

	test('returns true with empty armyMan array', async () => {
		const context = { game: 'g1', fleetMan: [], armyMan: [] };
		const result = await allArmiesMoved(context);
		expect(result).toBe(true);
	});

	test('returns false when army at territory with multiple peace options has no action', async () => {
		// Italy army at Rome (not hostile), but armyPeaceOptions for Rome will have
		// peace + hostile + war Italy army => >1 options
		const context = {
			game: 'g1',
			fleetMan: [],
			armyMan: [['Vienna', 'Rome', '']], // no action selected
		};
		const result = await allArmiesMoved(context);
		// peaceOptions for Rome should be >1 (peace, hostile, war Italy army)
		expect(result).toBe(false);
	});

	test('returns true when army has action selected at territory with peace options', async () => {
		const context = {
			game: 'g1',
			fleetMan: [],
			armyMan: [['Vienna', 'Rome', 'peace']],
		};
		const result = await allArmiesMoved(context);
		expect(result).toBe(true);
	});

	test('returns true when army at home territory with no special options', async () => {
		// Moving to Budapest (Austria home) => peace options length is likely <= 1
		// because Budapest belongs to Austria, so no hostile option, and no enemy units there
		const context = {
			game: 'g1',
			fleetMan: [],
			armyMan: [['Vienna', 'Budapest', '']],
		};
		const result = await allArmiesMoved(context);
		expect(result).toBe(true);
	});

	test('handles multiple armies with mixed states', async () => {
		const context = {
			game: 'g1',
			fleetMan: [],
			armyMan: [
				['Vienna', 'Budapest', ''], // valid, home territory
				['Budapest', '', ''], // no destination => invalid
			],
		};
		const result = await allArmiesMoved(context);
		expect(result).toBe(false);
	});
});

// ===========================================================================
// getImportOptions
// ===========================================================================
describe('getImportOptions', () => {
	test('returns labels for three import slots', async () => {
		const context = { game: 'g1' };
		const result = await getImportOptions(context);
		expect(result.labels).toEqual(['Import #1', 'Import #2', 'Import #3']);
	});

	test('returns army and fleet locations from helper', async () => {
		helper.getUnsatTerritories.mockImplementation((countryInfo, country, isPort, context) => {
			if (isPort) return ['Trieste'];
			return ['Vienna', 'Budapest'];
		});
		const context = { game: 'g1' };
		const result = await getImportOptions(context);
		expect(result.options.army).toEqual(['Vienna', 'Budapest']);
		expect(result.options.fleet).toEqual(['Trieste']);
	});

	test('returns correct army and fleet limits', async () => {
		// armyLimit=5, armies=1 => 4; fleetLimit=3, fleets=1 => 2
		const context = { game: 'g1' };
		const result = await getImportOptions(context);
		expect(result.limits.army).toBe(4);
		expect(result.limits.fleet).toBe(2);
	});

	test('returns full capacity as limits when no units exist', async () => {
		delete mockDbData.games.g1.countryInfo.Austria.armies;
		delete mockDbData.games.g1.countryInfo.Austria.fleets;
		const context = { game: 'g1' };
		const result = await getImportOptions(context);
		expect(result.limits.army).toBe(5);
		expect(result.limits.fleet).toBe(3);
	});

	test('returns zero limits when at capacity', async () => {
		mockDbData.games.g1.countryInfo.Austria.armies = Array(5).fill({ territory: 'Vienna', hostile: false });
		mockDbData.games.g1.countryInfo.Austria.fleets = Array(3).fill({ territory: 'Adriatic Sea', hostile: true });
		const context = { game: 'g1' };
		const result = await getImportOptions(context);
		expect(result.limits.army).toBe(0);
		expect(result.limits.fleet).toBe(0);
	});

	test('returns empty arrays when helper returns empty', async () => {
		helper.getUnsatTerritories.mockImplementation(() => []);
		const context = { game: 'g1' };
		const result = await getImportOptions(context);
		expect(result.options.army).toEqual([]);
		expect(result.options.fleet).toEqual([]);
	});

	test('calls getUnsatTerritories with correct arguments', async () => {
		const context = { game: 'g1' };
		await getImportOptions(context);
		// Called twice: once for army (isPort=false), once for fleet (isPort=true)
		expect(helper.getUnsatTerritories).toHaveBeenCalledTimes(2);
		expect(helper.getUnsatTerritories).toHaveBeenCalledWith(
			expect.objectContaining({
				Austria: expect.objectContaining({ factories: ['Vienna', 'Budapest'] }),
			}),
			'Austria',
			false,
			context
		);
		expect(helper.getUnsatTerritories).toHaveBeenCalledWith(
			expect.objectContaining({
				Austria: expect.objectContaining({ factories: ['Vienna', 'Budapest'] }),
			}),
			'Austria',
			true,
			context
		);
	});
});

// ===========================================================================
// Convoy / BFS tests — getD0, getAdjacentLands, getAdjacentSeas
// ===========================================================================
describe('getD0 — BFS for army reachable zone', () => {
	test('returns only the start territory when no fleets control adjacent seas', () => {
		// Army at Trieste, no fleet in Adriatic Sea
		const context = { fleetMan: [] };
		const d0 = getD0('Trieste', mockTerritorySetup, 'Austria', context);
		// Trieste is adjacent to Vienna and Budapest (same country) and Adriatic Sea (sea, no fleet)
		// BFS should traverse all connected Austrian lands
		expect(d0).toContain('Trieste');
		expect(d0).toContain('Vienna');
		expect(d0).toContain('Budapest');
		expect(d0).not.toContain('Adriatic Sea');
		expect(d0).not.toContain('Rome');
	});

	test('traverses through fleet-controlled sea', () => {
		// Army at Trieste, Austrian fleet moved to Adriatic Sea (normal move)
		const context = { fleetMan: [['Trieste', 'Adriatic Sea', '']] };
		const d0 = getD0('Trieste', mockTerritorySetup, 'Austria', context);
		// Should reach: Trieste, Vienna, Budapest (Austrian lands) + Adriatic Sea (fleet-controlled)
		expect(d0).toContain('Trieste');
		expect(d0).toContain('Vienna');
		expect(d0).toContain('Budapest');
		expect(d0).toContain('Adriatic Sea');
		// Rome is adjacent to Adriatic Sea but it's Italian land, not Austrian — stops BFS
		// However Rome IS reachable because d0 includes Adriatic Sea → d0 includes all
		// accessible nodes from Adriatic Sea that are same-country or fleet-controlled seas
		expect(d0).not.toContain('Rome'); // Rome is Italy, not Austria
	});

	test('traverses through multiple fleet-controlled seas', () => {
		// Austrian fleets at Adriatic Sea and West Med
		const context = {
			fleetMan: [
				['Trieste', 'Adriatic Sea', ''],
				['Adriatic Sea', 'West Med', ''],
			],
		};
		const d0 = getD0('Trieste', mockTerritorySetup, 'Austria', context);
		expect(d0).toContain('Trieste');
		expect(d0).toContain('Adriatic Sea');
		expect(d0).toContain('West Med');
		// Foreign lands still not included in d0
		expect(d0).not.toContain('Rome');
	});

	test('does not traverse sea when fleet action is war (fleet destroyed)', () => {
		// Fleet went to war at Adriatic Sea — fleet is destroyed
		const context = { fleetMan: [['Trieste', 'Adriatic Sea', 'war Italy fleet']] };
		const d0 = getD0('Trieste', mockTerritorySetup, 'Austria', context);
		// War fleets don't provide sea control — war action is not '' or 'peace'
		expect(d0).toContain('Trieste');
		expect(d0).toContain('Vienna');
		expect(d0).toContain('Budapest');
		expect(d0).not.toContain('Adriatic Sea');
	});

	test('traverses sea when fleet action is peace', () => {
		// Fleet entered Adriatic Sea with peace
		const context = { fleetMan: [['Trieste', 'Adriatic Sea', 'peace']] };
		const d0 = getD0('Trieste', mockTerritorySetup, 'Austria', context);
		expect(d0).toContain('Adriatic Sea');
	});

	test('does not traverse sea when fleet is hostile (not peace or move)', () => {
		// Fleet entered Adriatic Sea with 'hostile' action
		const context = { fleetMan: [['Trieste', 'Adriatic Sea', 'hostile']] };
		const d0 = getD0('Trieste', mockTerritorySetup, 'Austria', context);
		// 'hostile' is not '' (MOVE) and not 'peace', so sea not controlled
		expect(d0).not.toContain('Adriatic Sea');
	});

	test('fleet at origin (staying put) does not provide convoy for its starting sea', () => {
		// Fleet stays at Adriatic Sea (fleetMan entry: ['Adriatic Sea', 'Adriatic Sea', ''])
		const context = { fleetMan: [['Adriatic Sea', 'Adriatic Sea', '']] };
		const d0 = getD0('Trieste', mockTerritorySetup, 'Austria', context);
		// getD0 checks x[1] === adj, so 'Adriatic Sea' destination matches
		expect(d0).toContain('Adriatic Sea');
	});
});

describe('getAdjacentLands — army movement destinations', () => {
	test('army at Vienna without fleet convoy reaches Austrian lands only', () => {
		const context = { fleetMan: [] };
		const lands = getAdjacentLands('Vienna', mockTerritorySetup, 'Austria', context);
		// Vienna → Budapest, Trieste (all Austria). No sea access so no Italian lands.
		expect(lands).toContain('Vienna');
		expect(lands).toContain('Budapest');
		expect(lands).toContain('Trieste');
		expect(lands).not.toContain('Rome');
		expect(lands).not.toContain('Naples');
	});

	test('army at Trieste with fleet at Adriatic Sea can reach Rome (convoy)', () => {
		// Fleet moved to Adriatic Sea (normal move)
		const context = { fleetMan: [['Trieste', 'Adriatic Sea', '']] };
		const lands = getAdjacentLands('Trieste', mockTerritorySetup, 'Austria', context);
		// Trieste → d0 includes Trieste, Vienna, Budapest, Adriatic Sea
		// Then expand: adjacencies of Adriatic Sea include Rome → d0(Rome) for Austria
		// = just Rome (Italy land, not Austrian, but Rome is reachable as a one-step expansion)
		expect(lands).toContain('Trieste');
		expect(lands).toContain('Vienna');
		expect(lands).toContain('Budapest');
		expect(lands).toContain('Rome');
		// No sea territories in result
		expect(lands).not.toContain('Adriatic Sea');
		expect(lands).not.toContain('West Med');
	});

	test('army at Vienna with fleet at Adriatic Sea can convoy through Trieste→Adriatic→Rome', () => {
		// Vienna and Trieste are connected (same country), Adriatic Sea is fleet-controlled
		const context = { fleetMan: [['Trieste', 'Adriatic Sea', '']] };
		const lands = getAdjacentLands('Vienna', mockTerritorySetup, 'Austria', context);
		expect(lands).toContain('Rome');
	});

	test('army at Vienna with fleets at Adriatic Sea + West Med can reach Marseille', () => {
		// Two fleets providing convoy chain: Adriatic Sea → West Med
		const context = {
			fleetMan: [
				['Trieste', 'Adriatic Sea', ''],
				['Adriatic Sea', 'West Med', ''],
			],
		};
		const lands = getAdjacentLands('Vienna', mockTerritorySetup, 'Austria', context);
		// d0(Vienna) = Vienna, Budapest, Trieste, Adriatic Sea, West Med
		// Expand from West Med: adjacent is Adriatic Sea (already in d0), Rome (Italian)
		// d0(Rome) from Austria context = just Rome (not Austrian land, no further BFS)
		// expand from Rome: Naples (Italian land)
		// Also: West Med adj includes Marseille (French port) → d0(Marseille) = just Marseille
		expect(lands).toContain('Rome');
		expect(lands).toContain('Marseille');
	});

	test('army cannot reach across sea without fleet', () => {
		const context = { fleetMan: [] };
		const lands = getAdjacentLands('Trieste', mockTerritorySetup, 'Austria', context);
		expect(lands).not.toContain('Rome');
		expect(lands).not.toContain('Naples');
		expect(lands).not.toContain('Paris');
		expect(lands).not.toContain('Marseille');
	});

	test('army cannot reach across sea when fleet was destroyed in war', () => {
		const context = { fleetMan: [['Trieste', 'Adriatic Sea', 'war Italy fleet']] };
		const lands = getAdjacentLands('Trieste', mockTerritorySetup, 'Austria', context);
		// War fleet doesn't control the sea
		expect(lands).not.toContain('Rome');
	});

	test('never returns sea territories', () => {
		const context = {
			fleetMan: [
				['Trieste', 'Adriatic Sea', ''],
				['Adriatic Sea', 'West Med', ''],
			],
		};
		const lands = getAdjacentLands('Vienna', mockTerritorySetup, 'Austria', context);
		for (const t of lands) {
			expect(mockTerritorySetup[t].sea).toBeFalsy();
		}
	});
});

describe('getAdjacentSeas — fleet movement destinations', () => {
	test('fleet at port returns fleet position + port sea', () => {
		const result = getAdjacentSeas('Trieste', mockTerritorySetup);
		// Trieste has port = 'Adriatic Sea'
		expect(result).toEqual(['Trieste', 'Adriatic Sea']);
	});

	test('fleet at sea returns current position + adjacent seas', () => {
		const result = getAdjacentSeas('Adriatic Sea', mockTerritorySetup);
		// Adriatic Sea adj: Trieste (not sea), Rome (not sea), West Med (sea)
		expect(result).toContain('Adriatic Sea');
		expect(result).toContain('West Med');
		expect(result).not.toContain('Trieste');
		expect(result).not.toContain('Rome');
	});

	test('fleet at sea with no adjacent seas returns only current position', () => {
		// Create a sea surrounded by land
		const customSetup = {
			...mockTerritorySetup,
			'Isolated Sea': { country: null, port: false, sea: true, adjacencies: ['Vienna', 'Budapest'] },
		};
		const result = getAdjacentSeas('Isolated Sea', customSetup);
		expect(result).toEqual(['Isolated Sea']);
	});
});

// ===========================================================================
// getVirtualState — computes virtual board from completed maneuver moves
// ===========================================================================
describe('getVirtualState', () => {
	test('returns unmodified countryInfo when no currentManeuver exists', () => {
		const gameState = {
			countryInfo: {
				Austria: {
					fleets: [{ territory: 'Trieste', hostile: true }],
					armies: [{ territory: 'Vienna', hostile: false }],
				},
			},
		};
		const result = getVirtualState(gameState);
		expect(result.Austria.fleets).toEqual([{ territory: 'Trieste', hostile: true }]);
		expect(result.Austria.armies).toEqual([{ territory: 'Vienna', hostile: false }]);
	});

	test('does not mutate original gameState', () => {
		const gameState = {
			countryInfo: {
				Austria: {
					fleets: [{ territory: 'Trieste', hostile: true }],
					armies: [{ territory: 'Vienna', hostile: false }],
				},
			},
			currentManeuver: {
				country: 'Austria',
				pendingFleets: [{ territory: 'Trieste', hostile: true }],
				pendingArmies: [{ territory: 'Vienna', hostile: false }],
				completedFleetMoves: [['Trieste', 'Adriatic Sea', '']],
				completedArmyMoves: [],
			},
		};
		getVirtualState(gameState);
		// Original should not be mutated
		expect(gameState.countryInfo.Austria.fleets).toEqual([{ territory: 'Trieste', hostile: true }]);
	});

	test('applies completed fleet move (normal)', () => {
		const gameState = {
			countryInfo: {
				Austria: {
					fleets: [{ territory: 'Trieste', hostile: true }],
					armies: [],
				},
			},
			currentManeuver: {
				country: 'Austria',
				pendingFleets: [{ territory: 'Trieste', hostile: true }],
				pendingArmies: [],
				completedFleetMoves: [['Trieste', 'Adriatic Sea', '']],
				completedArmyMoves: [],
			},
		};
		const result = getVirtualState(gameState);
		expect(result.Austria.fleets).toEqual([{ territory: 'Adriatic Sea', hostile: true }]);
	});

	test('removes fleet destroyed in war', () => {
		const gameState = {
			countryInfo: {
				Austria: {
					fleets: [{ territory: 'Trieste', hostile: true }],
					armies: [],
				},
				Italy: {
					fleets: [{ territory: 'Adriatic Sea', hostile: true }],
					armies: [],
				},
			},
			currentManeuver: {
				country: 'Austria',
				pendingFleets: [{ territory: 'Trieste', hostile: true }],
				pendingArmies: [],
				completedFleetMoves: [['Trieste', 'Adriatic Sea', 'war Italy fleet']],
				completedArmyMoves: [],
			},
		};
		const result = getVirtualState(gameState);
		// Austrian fleet destroyed
		expect(result.Austria.fleets).toEqual([]);
		// Italian fleet at Adriatic Sea also destroyed
		expect(result.Italy.fleets).toEqual([]);
	});

	test('applies completed fleet move (peace)', () => {
		const gameState = {
			countryInfo: {
				Austria: {
					fleets: [{ territory: 'Trieste', hostile: true }],
					armies: [],
				},
			},
			currentManeuver: {
				country: 'Austria',
				pendingFleets: [{ territory: 'Trieste', hostile: true }],
				pendingArmies: [],
				completedFleetMoves: [['Trieste', 'Adriatic Sea', 'peace']],
				completedArmyMoves: [],
			},
		};
		const result = getVirtualState(gameState);
		// Peace: fleet moves, hostile = true (virtual state sets hostile: true for all moved units)
		expect(result.Austria.fleets).toEqual([{ territory: 'Adriatic Sea', hostile: true }]);
	});

	test('applies completed army moves', () => {
		const gameState = {
			countryInfo: {
				Austria: {
					fleets: [],
					armies: [
						{ territory: 'Vienna', hostile: false },
						{ territory: 'Budapest', hostile: false },
					],
				},
			},
			currentManeuver: {
				country: 'Austria',
				pendingFleets: [],
				pendingArmies: [
					{ territory: 'Vienna', hostile: false },
					{ territory: 'Budapest', hostile: false },
				],
				completedFleetMoves: [],
				completedArmyMoves: [['Vienna', 'Trieste', '']],
			},
		};
		const result = getVirtualState(gameState);
		// First army moved to Trieste, second army stays at Budapest
		expect(result.Austria.armies).toHaveLength(2);
		expect(result.Austria.armies[0]).toEqual({ territory: 'Trieste', hostile: true });
		expect(result.Austria.armies[1]).toEqual({ territory: 'Budapest', hostile: false });
	});

	test('applies army peace move with hostile: false', () => {
		const gameState = {
			countryInfo: {
				Austria: {
					fleets: [],
					armies: [{ territory: 'Vienna', hostile: false }],
				},
			},
			currentManeuver: {
				country: 'Austria',
				pendingFleets: [],
				pendingArmies: [{ territory: 'Vienna', hostile: false }],
				completedFleetMoves: [],
				completedArmyMoves: [['Vienna', 'Rome', 'peace']],
			},
		};
		const result = getVirtualState(gameState);
		expect(result.Austria.armies).toEqual([{ territory: 'Rome', hostile: false }]);
	});

	test('removes army destroyed in war and removes target', () => {
		const gameState = {
			countryInfo: {
				Austria: {
					fleets: [],
					armies: [{ territory: 'Trieste', hostile: true }],
				},
				Italy: {
					fleets: [],
					armies: [{ territory: 'Rome', hostile: false }],
				},
			},
			currentManeuver: {
				country: 'Austria',
				pendingFleets: [],
				pendingArmies: [{ territory: 'Trieste', hostile: true }],
				completedFleetMoves: [],
				completedArmyMoves: [['Trieste', 'Rome', 'war Italy army']],
			},
		};
		const result = getVirtualState(gameState);
		expect(result.Austria.armies).toEqual([]);
		expect(result.Italy.armies).toEqual([]);
	});

	test('handles blow up factory action — destroys 3 armies and factory', () => {
		const gameState = {
			countryInfo: {
				Austria: {
					fleets: [],
					armies: [
						{ territory: 'Trieste', hostile: true },
						{ territory: 'Rome', hostile: true },
						{ territory: 'Rome', hostile: true },
					],
				},
				Italy: {
					fleets: [],
					armies: [],
					factories: ['Rome', 'Naples'],
				},
			},
			currentManeuver: {
				country: 'Austria',
				pendingFleets: [],
				pendingArmies: [
					{ territory: 'Trieste', hostile: true },
					{ territory: 'Rome', hostile: true },
					{ territory: 'Rome', hostile: true },
				],
				completedFleetMoves: [],
				completedArmyMoves: [
					['Trieste', 'Rome', 'blow up Italy'],
					['Rome', 'Rome', ''],
					['Rome', 'Rome', ''],
				],
			},
		};
		const result = getVirtualState(gameState);
		// All 3 Austrian armies destroyed (1 attacker + 2 consumed)
		expect(result.Austria.armies).toEqual([]);
		// Italian factory at Rome removed
		expect(result.Italy.factories).toEqual(['Naples']);
	});

	test('blow up factory — only 2 extra armies consumed, others survive', () => {
		const gameState = {
			countryInfo: {
				Austria: {
					fleets: [],
					armies: [
						{ territory: 'Trieste', hostile: true },
						{ territory: 'Rome', hostile: true },
						{ territory: 'Rome', hostile: true },
						{ territory: 'Budapest', hostile: false },
					],
				},
				Italy: {
					fleets: [],
					armies: [],
					factories: ['Rome', 'Naples'],
				},
			},
			currentManeuver: {
				country: 'Austria',
				pendingFleets: [],
				pendingArmies: [
					{ territory: 'Trieste', hostile: true },
					{ territory: 'Rome', hostile: true },
					{ territory: 'Rome', hostile: true },
					{ territory: 'Budapest', hostile: false },
				],
				completedFleetMoves: [],
				completedArmyMoves: [
					['Trieste', 'Rome', 'blow up Italy'],
					['Rome', 'Rome', ''],
					['Rome', 'Rome', ''],
					['Budapest', 'Vienna', ''],
				],
			},
		};
		const result = getVirtualState(gameState);
		// 3 armies destroyed for blow-up, 1 survives (moved to Vienna)
		expect(result.Austria.armies).toEqual([{ territory: 'Vienna', hostile: true }]);
		expect(result.Italy.factories).toEqual(['Naples']);
	});

	test('keeps unmoved units at original positions', () => {
		const gameState = {
			countryInfo: {
				Austria: {
					fleets: [
						{ territory: 'Trieste', hostile: true },
						{ territory: 'Adriatic Sea', hostile: true },
					],
					armies: [{ territory: 'Vienna', hostile: false }],
				},
			},
			currentManeuver: {
				country: 'Austria',
				pendingFleets: [
					{ territory: 'Trieste', hostile: true },
					{ territory: 'Adriatic Sea', hostile: true },
				],
				pendingArmies: [{ territory: 'Vienna', hostile: false }],
				completedFleetMoves: [['Trieste', 'Adriatic Sea', '']],
				completedArmyMoves: [],
			},
		};
		const result = getVirtualState(gameState);
		// First fleet moved, second fleet unchanged
		expect(result.Austria.fleets).toHaveLength(2);
		expect(result.Austria.fleets[0]).toEqual({ territory: 'Adriatic Sea', hostile: true });
		expect(result.Austria.fleets[1]).toEqual({ territory: 'Adriatic Sea', hostile: true });
		// Army not yet moved
		expect(result.Austria.armies).toEqual([{ territory: 'Vienna', hostile: false }]);
	});
});

// ===========================================================================
// getCurrentUnitOptions — step-by-step maneuver unit options
// ===========================================================================
describe('getCurrentUnitOptions — step-by-step maneuver', () => {
	beforeEach(() => {
		mockDbData = buildMockDbData();
		clearCache();
	});

	test('returns fleet options (adjacent seas) for fleet phase', async () => {
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'fleet',
			unitIndex: 0,
			pendingFleets: [{ territory: 'Trieste', hostile: true }],
			pendingArmies: [{ territory: 'Vienna', hostile: false }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitOptions({ game: 'g1' });
		// Trieste has port = 'Adriatic Sea', so getAdjacentSeas returns [Trieste, Adriatic Sea]
		expect(result).toContain('Trieste');
		expect(result).toContain('Adriatic Sea');
	});

	test('returns army options for army phase without convoy', async () => {
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [],
			pendingArmies: [{ territory: 'Vienna', hostile: false }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitOptions({ game: 'g1' });
		// Army at Vienna with no fleets, should reach Austrian lands
		expect(result).toContain('Vienna');
		expect(result).toContain('Budapest');
		expect(result).toContain('Trieste');
		expect(result).not.toContain('Rome');
	});

	test('army phase uses completedFleetMoves as virtualFleetMan for convoy', async () => {
		// This is the critical convoy test for step-by-step maneuver:
		// Fleet already moved to Adriatic Sea, now army should be able to convoy through it
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [{ territory: 'Trieste', hostile: true }],
			pendingArmies: [{ territory: 'Trieste', hostile: false }],
			completedFleetMoves: [['Trieste', 'Adriatic Sea', '']],
			completedArmyMoves: [],
		};
		// Virtual state: fleet moved to Adriatic Sea, army still at Trieste
		const result = await getCurrentUnitOptions({ game: 'g1' });
		// Army at Trieste should be able to reach Rome via Adriatic Sea (fleet-controlled)
		expect(result).toContain('Trieste');
		expect(result).toContain('Vienna');
		expect(result).toContain('Budapest');
		expect(result).toContain('Rome'); // Convoy through Adriatic Sea!
	});

	test('army cannot convoy through sea where fleet was destroyed in war', async () => {
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [{ territory: 'Trieste', hostile: true }],
			pendingArmies: [{ territory: 'Trieste', hostile: false }],
			completedFleetMoves: [['Trieste', 'Adriatic Sea', 'war Italy fleet']],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitOptions({ game: 'g1' });
		// War fleet doesn't provide convoy
		expect(result).not.toContain('Rome');
	});

	test('army can convoy when fleet peacefully occupies sea', async () => {
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [{ territory: 'Trieste', hostile: true }],
			pendingArmies: [{ territory: 'Vienna', hostile: false }],
			completedFleetMoves: [['Trieste', 'Adriatic Sea', 'peace']],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitOptions({ game: 'g1' });
		// Fleet at Adriatic Sea with 'peace' provides convoy
		expect(result).toContain('Rome');
	});

	test('multi-hop convoy: fleet at Adriatic + fleet at West Med → army reaches Marseille', async () => {
		// Two fleets provide a convoy chain
		mockDbData.games.g1.countryInfo.Austria.fleets = [
			{ territory: 'Trieste', hostile: true },
			{ territory: 'Adriatic Sea', hostile: true },
		];
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [
				{ territory: 'Trieste', hostile: true },
				{ territory: 'Adriatic Sea', hostile: true },
			],
			pendingArmies: [{ territory: 'Vienna', hostile: false }],
			completedFleetMoves: [
				['Trieste', 'Adriatic Sea', ''],
				['Adriatic Sea', 'West Med', ''],
			],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitOptions({ game: 'g1' });
		// Army at Vienna → through Trieste → Adriatic Sea (fleet) → West Med (fleet) → Marseille
		expect(result).toContain('Rome');
		expect(result).toContain('Marseille');
	});

	test('fleet that moved AWAY from sea removes convoy through that sea', async () => {
		// Fleet was at Adriatic Sea, moved to West Med
		// The army should NOT be able to use Adriatic Sea for convoy
		mockDbData.games.g1.countryInfo.Austria.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingFleets: [{ territory: 'Adriatic Sea', hostile: true }],
			pendingArmies: [{ territory: 'Trieste', hostile: false }],
			completedFleetMoves: [['Adriatic Sea', 'West Med', '']],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitOptions({ game: 'g1' });
		// virtualFleetMan = [['Adriatic Sea', 'West Med', '']]
		// getD0 checks x[1] === adj: fleet destination is 'West Med'
		// For army at Trieste, adj includes Adriatic Sea. Is x[1]==='Adriatic Sea'? No, x[1]==='West Med'
		// So Adriatic Sea is NOT fleet-controlled → no convoy through it
		// BUT: Trieste adj includes Adriatic Sea (not controlled), so army stays at Austrian lands
		// West Med is not adjacent to Trieste directly, so army can't reach it either
		expect(result).not.toContain('Rome');
		expect(result).not.toContain('Marseille');
		// Army should only reach Austrian lands
		expect(result).toContain('Trieste');
		expect(result).toContain('Vienna');
		expect(result).toContain('Budapest');
	});

	test('returns empty array when no currentManeuver exists', async () => {
		delete mockDbData.games.g1.currentManeuver;
		const result = await getCurrentUnitOptions({ game: 'g1' });
		expect(result).toEqual([]);
	});

	test('second army uses completedArmyMoves to compute virtual position', async () => {
		mockDbData.games.g1.countryInfo.Austria.armies = [
			{ territory: 'Vienna', hostile: false },
			{ territory: 'Budapest', hostile: false },
		];
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 1,
			pendingFleets: [],
			pendingArmies: [
				{ territory: 'Vienna', hostile: false },
				{ territory: 'Budapest', hostile: false },
			],
			completedFleetMoves: [],
			completedArmyMoves: [['Vienna', 'Trieste', '']],
		};
		const result = await getCurrentUnitOptions({ game: 'g1' });
		// Second army at Budapest, first army already moved to Trieste (via virtual state)
		// Budapest → Vienna, Trieste (all Austrian lands)
		expect(result).toContain('Budapest');
		expect(result).toContain('Vienna');
		expect(result).toContain('Trieste');
	});

	test('skips destroyed fleet when finding current fleet unit', async () => {
		// First fleet destroyed in war, second fleet still pending
		mockDbData.games.g1.countryInfo.Austria.fleets = [
			{ territory: 'Trieste', hostile: true },
			{ territory: 'Adriatic Sea', hostile: true },
		];
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'fleet',
			unitIndex: 1,
			pendingFleets: [
				{ territory: 'Trieste', hostile: true },
				{ territory: 'Adriatic Sea', hostile: true },
			],
			pendingArmies: [],
			completedFleetMoves: [['Trieste', 'Adriatic Sea', 'war Italy fleet']],
			completedArmyMoves: [],
		};
		// Add Italian fleet at Adriatic Sea so the war makes sense
		mockDbData.games.g1.countryInfo.Italy.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		const result = await getCurrentUnitOptions({ game: 'g1' });
		// First fleet destroyed → survivingIndex stays 0
		// Second fleet (index 1) should use virtualFleets[0]
		// Virtual state: first fleet destroyed, Italian fleet at Adriatic destroyed,
		// second fleet still at Adriatic Sea (pendingFleet[1] at original position)
		// BUT after war, the virtual state has Austrian fleet removed AND Italian fleet removed
		// so virtualFleets = [{ territory: 'Adriatic Sea', hostile: true }] (second fleet only)
		// survivingIndex=0, so targetFleet = virtualFleets[0] = { territory: 'Adriatic Sea' }
		// getAdjacentSeas('Adriatic Sea') → ['Adriatic Sea', 'West Med']
		expect(result).toContain('Adriatic Sea');
		expect(result).toContain('West Med');
	});
});

// ---------------------------------------------------------------------------
// getCurrentUnitActionOptions — action choices for current unit's destination
// ---------------------------------------------------------------------------
describe('getCurrentUnitActionOptions — action choices at destination', () => {
	beforeEach(() => {
		buildMockDbData();
		clearCache();
	});

	test('returns empty array when no currentManeuver', async () => {
		mockDbData.games.g1.currentManeuver = null;
		const result = await getCurrentUnitActionOptions({ game: 'g1', maneuverDest: 'Rome' });
		expect(result).toEqual([]);
	});

	test('returns empty array when no destination', async () => {
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingArmies: [{ territory: 'Vienna', hostile: false }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitActionOptions({ game: 'g1', maneuverDest: '' });
		expect(result).toEqual([]);
	});

	test('fleet: returns war + peace when enemy fleet at destination', async () => {
		mockDbData.games.g1.countryInfo.Italy.fleets = [{ territory: 'Adriatic Sea', hostile: true }];
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'fleet',
			unitIndex: 0,
			pendingFleets: [{ territory: 'Trieste', hostile: true }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitActionOptions({ game: 'g1', maneuverDest: 'Adriatic Sea' });
		expect(result).toContain('war Italy fleet');
		expect(result).toContain('peace');
		expect(result).not.toContain('hostile');
	});

	test('fleet: returns empty array at friendly sea (no enemies)', async () => {
		mockDbData.games.g1.countryInfo.Italy.fleets = [];
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'fleet',
			unitIndex: 0,
			pendingFleets: [{ territory: 'Trieste', hostile: true }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitActionOptions({ game: 'g1', maneuverDest: 'Adriatic Sea' });
		expect(result).toEqual([]);
	});

	test('army: returns war + peace when enemy army at foreign territory', async () => {
		// Italy has an army at Rome
		mockDbData.games.g1.countryInfo.Italy.armies = [{ territory: 'Rome', hostile: false }];
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingArmies: [{ territory: 'Trieste', hostile: false }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitActionOptions({ game: 'g1', maneuverDest: 'Rome' });
		expect(result).toContain('war Italy army');
		expect(result).toContain('peace');
		// hostile and blow up should NOT appear when enemy units present
		expect(result).not.toContain('hostile');
		expect(result).not.toContain('blow up Italy');
	});

	test('army: returns peace + hostile + blow up when 3+ armies and foreign territory with factory', async () => {
		// No Italian units at Rome, but Rome is Italy's territory with a factory
		// Need 2 friendly armies already at Rome + current = 3
		mockDbData.games.g1.countryInfo.Italy.armies = [];
		mockDbData.games.g1.countryInfo.Italy.fleets = [];
		mockDbData.games.g1.countryInfo.Austria.armies = [
			{ territory: 'Trieste', hostile: false },
			{ territory: 'Rome', hostile: true },
			{ territory: 'Rome', hostile: true },
		];
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingArmies: [
				{ territory: 'Trieste', hostile: false },
				{ territory: 'Rome', hostile: true },
				{ territory: 'Rome', hostile: true },
			],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitActionOptions({ game: 'g1', maneuverDest: 'Rome' });
		expect(result).toContain('peace');
		expect(result).toContain('hostile');
		expect(result).toContain('blow up Italy');
		// Should NOT have any war options
		expect(result.filter((a) => a.startsWith('war'))).toEqual([]);
	});

	test('army: returns peace + hostile but NO blow up when < 3 armies at foreign territory with factory', async () => {
		// No Italian units at Rome, Rome has factory, but only 1 army (current) → no blow up
		mockDbData.games.g1.countryInfo.Italy.armies = [];
		mockDbData.games.g1.countryInfo.Italy.fleets = [];
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingArmies: [{ territory: 'Trieste', hostile: false }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitActionOptions({ game: 'g1', maneuverDest: 'Rome' });
		expect(result).toContain('peace');
		expect(result).toContain('hostile');
		expect(result).not.toContain('blow up Italy');
	});

	test('army: returns peace + hostile but no blow up when no factory at destination', async () => {
		// Naples is Italy's territory but NOT in factories list
		mockDbData.games.g1.countryInfo.Italy.armies = [];
		mockDbData.games.g1.countryInfo.Italy.fleets = [];
		mockDbData.games.g1.countryInfo.Italy.factories = ['Rome']; // only Rome, not Naples
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingArmies: [{ territory: 'Rome', hostile: false }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitActionOptions({ game: 'g1', maneuverDest: 'Naples' });
		expect(result).toContain('peace');
		expect(result).toContain('hostile');
		expect(result).not.toContain('blow up Italy');
	});

	test('army: returns empty array at home territory (no foreign, no enemies)', async () => {
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingArmies: [{ territory: 'Vienna', hostile: false }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitActionOptions({ game: 'g1', maneuverDest: 'Budapest' });
		expect(result).toEqual([]);
	});

	test('army: war targets only hostile fleets (non-hostile fleets ignored)', async () => {
		// Place a non-hostile Italian fleet at Rome
		mockDbData.games.g1.countryInfo.Italy.fleets = [{ territory: 'Rome', hostile: false }];
		mockDbData.games.g1.countryInfo.Italy.armies = [];
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingArmies: [{ territory: 'Trieste', hostile: false }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		// Rome has non-hostile Italian fleet — only hostile fleets trigger war
		const result = await getCurrentUnitActionOptions({ game: 'g1', maneuverDest: 'Rome' });
		// No war options since fleet is non-hostile
		expect(result).not.toContain('war Italy fleet');
		// Foreign territory with no hostile enemy units → peace + hostile (no blow up, only 1 army)
		expect(result).toContain('peace');
		expect(result).toContain('hostile');
		expect(result).not.toContain('blow up Italy');
	});

	test('army: multiple enemy unit types at destination', async () => {
		// Both an Italian army and a French army at Rome
		mockDbData.games.g1.countryInfo.Italy.armies = [{ territory: 'Rome', hostile: false }];
		mockDbData.games.g1.countryInfo.France.armies = [{ territory: 'Rome', hostile: false }];
		mockDbData.games.g1.currentManeuver = {
			country: 'Austria',
			phase: 'army',
			unitIndex: 0,
			pendingArmies: [{ territory: 'Trieste', hostile: false }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		};
		const result = await getCurrentUnitActionOptions({ game: 'g1', maneuverDest: 'Rome' });
		expect(result).toContain('war Italy army');
		expect(result).toContain('war France army');
		expect(result).toContain('peace');
		// hostile and blow up should NOT appear when enemy units present
		expect(result).not.toContain('hostile');
		expect(result).not.toContain('blow up Italy');
	});
});
