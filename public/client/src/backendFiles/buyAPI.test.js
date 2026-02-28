// ---------------------------------------------------------------------------
// buyAPI.test.js - Tests for getCountryOptions, getReturnStockOptions, getStockOptions
// ---------------------------------------------------------------------------

let mockDbData = {};

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
	getCountries: jest.fn(() => Promise.resolve(['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia'])),
}));

import { getCountryOptions, getReturnStockOptions, getStockOptions } from './buyAPI.js';
import * as helper from './helper.js';
import { clearCache } from './stateCache.js';

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

const STOCK_COSTS = { 0: 0, 1: 2, 2: 4, 3: 6, 4: 9, 5: 12 };

function buildMockDb(overrides = {}) {
	const base = {
		games: {
			testGame: {
				setup: 'setups/standard',
				playerInfo: {
					Alice: {
						money: 10,
						stock: [{ country: 'Austria', stock: 2 }],
					},
				},
				countryInfo: {
					Austria: { availStock: [1, 2, 3, 4, 5], offLimits: false },
					Italy: { availStock: [1, 2, 3, 4, 5], offLimits: false },
					France: { availStock: [1, 2, 3, 4, 5], offLimits: false },
					England: { availStock: [1, 2, 3, 4, 5], offLimits: false },
					Germany: { availStock: [1, 2, 3, 4, 5], offLimits: false },
					Russia: { availStock: [1, 2, 3, 4, 5], offLimits: false },
				},
			},
		},
		setups: {
			standard: {
				stockCosts: { ...STOCK_COSTS },
			},
		},
		'setups/standard': {
			stockCosts: { ...STOCK_COSTS },
		},
	};

	// Apply deep overrides for playerInfo
	if (overrides.playerInfo) {
		base.games.testGame.playerInfo = {
			...base.games.testGame.playerInfo,
			...overrides.playerInfo,
		};
	}

	// Apply deep overrides for countryInfo
	if (overrides.countryInfo) {
		for (const country of Object.keys(overrides.countryInfo)) {
			base.games.testGame.countryInfo[country] = {
				...base.games.testGame.countryInfo[country],
				...overrides.countryInfo[country],
			};
		}
	}

	return base;
}

beforeEach(() => {
	mockDbData = buildMockDb();
	clearCache();
	jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getCountryOptions
// ---------------------------------------------------------------------------
describe('getCountryOptions', () => {
	const context = { game: 'testGame', name: 'Alice' };

	test('returns countries where player can afford stock outright', async () => {
		// Alice has 10 money. Costs: 1=>2, 2=>4, 3=>6, 4=>9. She can buy stocks 1-4 outright.
		// All countries have availStock [1..5] and offLimits: false, so all 6 countries + Punt Buy.
		const result = await getCountryOptions(context);
		expect(result).toEqual(['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia', 'Punt Buy']);
	});

	test('always includes Punt Buy as the last option', async () => {
		const result = await getCountryOptions(context);
		expect(result[result.length - 1]).toBe('Punt Buy');
	});

	test('excludes countries marked offLimits', async () => {
		mockDbData = buildMockDb({
			countryInfo: {
				Austria: { offLimits: true },
				France: { offLimits: true },
			},
		});
		const result = await getCountryOptions(context);
		expect(result).not.toContain('Austria');
		expect(result).not.toContain('France');
		expect(result).toContain('Italy');
		expect(result).toContain('Punt Buy');
	});

	test('includes country if player can afford stock only by returning existing stock', async () => {
		// Alice has 2 money. Cannot buy any stock outright for Austria (cheapest=2, can afford 1 at cost 2).
		// Wait - she CAN afford stock 1 at cost 2 with 2 money. Let's give her 1 money instead.
		// With 1 money: cannot buy stock 1 (cost 2) outright. But she owns stock 2 in Austria.
		// Returning stock 2 gives refund of 4, so money=1+4=5. Can buy stock 3 (cost 6)? No, 5<6.
		// Can buy stock 4? 5<9. Can buy stock 5? 5<12. Hmm, only stock > 2, so stock 3,4,5.
		// With 5 money, only stock 3 at cost 6 fails. Actually none work.
		// Let's use 3 money. Returning stock 2 gives refund 4, total 7. Stock 3 costs 6, 7>=6. Yes!
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: {
					money: 3,
					stock: [{ country: 'Austria', stock: 2 }],
				},
			},
		});
		// With 3 money outright: can afford stock 1 (cost 2). So Austria is included outright.
		// For the "only by returning" test, need money < cost of cheapest available stock.
		// Let's make money=1 and owned stock=3 in Austria.
		// Returning stock 3: refund=6, total=7. Stock > 3: stock 4 (cost 9, 7<9 no), stock 5 (cost 12, no).
		// Still not affordable. Let's use owned stock=2, money=1. Return stock 2: refund=4, total=5.
		// Stock > 2: stock 3 (cost 6, 5<6 no). Nope.
		// Let's use money=3, owned stock=2. Return stock 2: refund=4, total=7. Stock 3 costs 6, 7>=6, yes.
		// But with money=3 outright, stock 1 costs 2, 3>=2. So Austria is included outright.
		// To test "only by returning", we need: can't afford any stock outright, but CAN afford by returning.
		// Only available stock in Austria is [4,5]. Money=1. Can't buy 4 (cost 9) or 5 (cost 12) outright.
		// Alice owns stock 3 in Austria. Return stock 3: refund=6, total=7. Stock>3: stock 4 (cost 9, 7<9 no), stock 5 (12,no). Fail.
		// Alice owns stock 3, money=4. Return: refund 6, total 10. Stock 4 cost 9, 10>=9 yes! Stock 5 cost 12, 10<12 no.
		// Outright: money=4, stock 4 cost 9, 4<9 no. Stock 5 cost 12, 4<12 no. Can't afford outright.
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: {
					money: 4,
					stock: [{ country: 'Austria', stock: 3 }],
				},
			},
			countryInfo: {
				Austria: { availStock: [4, 5], offLimits: false },
				Italy: { availStock: [4, 5], offLimits: false },
				France: { availStock: [4, 5], offLimits: false },
				England: { availStock: [4, 5], offLimits: false },
				Germany: { availStock: [4, 5], offLimits: false },
				Russia: { availStock: [4, 5], offLimits: false },
			},
		});

		const result = await getCountryOptions(context);
		// Austria: can't afford outright (money=4, cheapest avail is 4 at cost 9).
		// But owns stock 3 in Austria: return 3, refund 6, total 10 >= cost of stock 4 (9). Included.
		// Other countries: can't afford outright, and Alice has no stock to return. Excluded.
		expect(result).toContain('Austria');
		expect(result).not.toContain('Italy');
		expect(result).toContain('Punt Buy');
		expect(result).toEqual(['Austria', 'Punt Buy']);
	});

	test('excludes countries where player has no affordable stock even with return', async () => {
		// Alice has 0 money and owns stock 1 in Austria. Available stock is [4,5].
		// Return stock 1: refund=2, total=2. Stock>1: stock 4 (cost 9, 2<9 no), stock 5 (12, no). Can't afford.
		// Outright: money=0, stock 4 cost 9, no. Not affordable at all.
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: {
					money: 0,
					stock: [{ country: 'Austria', stock: 1 }],
				},
			},
			countryInfo: {
				Austria: { availStock: [4, 5], offLimits: false },
				Italy: { availStock: [4, 5], offLimits: false },
				France: { availStock: [4, 5], offLimits: false },
				England: { availStock: [4, 5], offLimits: false },
				Germany: { availStock: [4, 5], offLimits: false },
				Russia: { availStock: [4, 5], offLimits: false },
			},
		});

		const result = await getCountryOptions(context);
		expect(result).toEqual(['Punt Buy']);
	});

	test('handles empty availStock for a country', async () => {
		mockDbData = buildMockDb({
			countryInfo: {
				Austria: { availStock: null, offLimits: false },
				Italy: { availStock: [], offLimits: false },
			},
		});

		const result = await getCountryOptions(context);
		// Austria: availStock is falsy, so treated as []. No stock available, can't buy.
		// Italy: availStock is [], no stock available.
		// France-Russia: all have [1..5], Alice has 10 money, can afford.
		expect(result).not.toContain('Austria');
		expect(result).not.toContain('Italy');
		expect(result).toContain('France');
		expect(result).toContain('Punt Buy');
	});

	test('returns only Punt Buy when all countries are off-limits', async () => {
		mockDbData = buildMockDb({
			countryInfo: {
				Austria: { offLimits: true },
				Italy: { offLimits: true },
				France: { offLimits: true },
				England: { offLimits: true },
				Germany: { offLimits: true },
				Russia: { offLimits: true },
			},
		});

		const result = await getCountryOptions(context);
		expect(result).toEqual(['Punt Buy']);
	});

	test('handles player with no stock', async () => {
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: { money: 0, stock: [] },
			},
			countryInfo: {
				Austria: { availStock: [4, 5], offLimits: false },
				Italy: { availStock: [4, 5], offLimits: false },
				France: { availStock: [4, 5], offLimits: false },
				England: { availStock: [4, 5], offLimits: false },
				Germany: { availStock: [4, 5], offLimits: false },
				Russia: { availStock: [4, 5], offLimits: false },
			},
		});

		// money=0, no stock to return, can't afford stock 4 (cost 9) or 5 (cost 12)
		const result = await getCountryOptions(context);
		expect(result).toEqual(['Punt Buy']);
	});

	test('uses helper.getCountries to determine which countries to check', async () => {
		helper.getCountries.mockResolvedValueOnce(['Austria', 'Italy']);

		const result = await getCountryOptions(context);
		// Only Austria and Italy are checked, both affordable with money=10
		expect(result).toEqual(['Austria', 'Italy', 'Punt Buy']);
		expect(helper.getCountries).toHaveBeenCalledWith(context);
	});

	test('includes country when player can afford cheapest stock exactly', async () => {
		// Stock 1 costs 2, Alice has exactly 2 money
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: { money: 2, stock: [] },
			},
		});

		const result = await getCountryOptions(context);
		// money=2 >= cost of stock 1 (2), so all countries are included
		expect(result).toContain('Austria');
		expect(result).toContain('Punt Buy');
	});
});

// ---------------------------------------------------------------------------
// getReturnStockOptions
// ---------------------------------------------------------------------------
describe('getReturnStockOptions', () => {
	test('returns empty array for Punt Buy', async () => {
		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Punt Buy' };
		const result = await getReturnStockOptions(context);
		expect(result).toEqual([]);
	});

	test('returns None + owned stock denominations when player can buy with or without return', async () => {
		// Alice has 10 money, owns stock 2 in Austria. Available: [1,2,3,4,5].
		// Without return: money=10, stock 1 (cost 2, yes), stock 2 (4, yes), stock 3 (6, yes), stock 4 (9, yes).
		// So 'None' is included.
		// With returning stock 2: refund=4, total=14. Stocks > 2: stock 3 (6, yes), 4 (9, yes), 5 (12, yes). Included.
		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria' };
		const result = await getReturnStockOptions(context);
		expect(result).toContain('None');
		expect(result).toContain(2);
		expect(result).toEqual(['None', 2]);
	});

	test('returns only owned stock denominations when player can only afford with return', async () => {
		// Alice has 4 money, owns stock 3 in Austria. Available: [4, 5].
		// Without return: money=4, stock 4 (cost 9, 4<9 no), stock 5 (cost 12, no). No -> no 'None'.
		// With returning stock 3: refund=6, total=10. Stocks > 3: stock 4 (cost 9, 10>=9 yes), stock 5 (12, no). Included.
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: {
					money: 4,
					stock: [{ country: 'Austria', stock: 3 }],
				},
			},
			countryInfo: {
				Austria: { availStock: [4, 5], offLimits: false },
			},
		});

		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria' };
		const result = await getReturnStockOptions(context);
		expect(result).not.toContain('None');
		expect(result).toEqual([3]);
	});

	test('returns empty array when None is the only option (can afford without return, no owned stock)', async () => {
		// Alice has 10 money, no stock owned. Available: [1,2,3,4,5].
		// Without return: can afford, so 'None' is pushed. But no owned stock for Austria.
		// opts = ['None'], length=1 and opts[0]==='None', so opts becomes [].
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: { money: 10, stock: [] },
			},
		});

		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria' };
		const result = await getReturnStockOptions(context);
		expect(result).toEqual([]);
	});

	test('only includes owned stock for the selected country', async () => {
		// Alice owns stock 2 in Austria and stock 3 in Italy. Buying for Austria.
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: {
					money: 10,
					stock: [
						{ country: 'Austria', stock: 2 },
						{ country: 'Italy', stock: 3 },
					],
				},
			},
		});

		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria' };
		const result = await getReturnStockOptions(context);
		// 'None' is included (can afford outright), and only stock 2 (Austria) is included, not stock 3 (Italy).
		expect(result).toContain('None');
		expect(result).toContain(2);
		expect(result).not.toContain(3);
		expect(result).toEqual(['None', 2]);
	});

	test('includes multiple owned stocks for same country', async () => {
		// Alice owns stock 1 and stock 3 in Austria.
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: {
					money: 10,
					stock: [
						{ country: 'Austria', stock: 1 },
						{ country: 'Austria', stock: 3 },
					],
				},
			},
		});

		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria' };
		const result = await getReturnStockOptions(context);
		// Can afford outright (money=10), so 'None' is first.
		// Returning stock 1: refund=2, total=12. Stocks > 1: 2 (4, yes), 3 (6, yes), 4 (9, yes), 5 (12, yes). Included.
		// Returning stock 3: refund=6, total=16. Stocks > 3: 4 (9, yes), 5 (12, yes). Included.
		expect(result).toEqual(['None', 1, 3]);
	});

	test('excludes owned stock if returning it still cannot afford any higher stock', async () => {
		// Alice has 0 money, owns stock 1 in Austria. Available: [4, 5].
		// Without return: 0 money, stock 4 cost 9, no.
		// With returning stock 1: refund=2, total=2. Stocks > 1: stock 4 (9, 2<9 no), stock 5 (12, no). Can't afford.
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: {
					money: 0,
					stock: [{ country: 'Austria', stock: 1 }],
				},
			},
			countryInfo: {
				Austria: { availStock: [4, 5], offLimits: false },
			},
		});

		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria' };
		const result = await getReturnStockOptions(context);
		expect(result).toEqual([]);
	});

	test('returns empty array when no stock is available', async () => {
		mockDbData = buildMockDb({
			countryInfo: {
				Austria: { availStock: [], offLimits: false },
			},
		});

		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria' };
		const result = await getReturnStockOptions(context);
		expect(result).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// getStockOptions
// ---------------------------------------------------------------------------
describe('getStockOptions', () => {
	test('returns empty array for Punt Buy', async () => {
		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Punt Buy', returnStock: 'None' };
		const result = await getStockOptions(context);
		expect(result).toEqual([]);
	});

	test('returns affordable stock denominations without return (returnStock = None)', async () => {
		// Alice has 10 money. Costs: 1=>2, 2=>4, 3=>6, 4=>9, 5=>12.
		// returnStock = 'None' -> returned = 0, refund = costs[0] = 0, money stays 10.
		// Stock 1 (cost 2, 10>=2, >0 yes), stock 2 (4, yes), stock 3 (6, yes), stock 4 (9, yes), stock 5 (12, 10<12 no).
		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: 'None' };
		const result = await getStockOptions(context);
		expect(result).toEqual([1, 2, 3, 4]);
	});

	test('returns affordable stock denominations with return credit', async () => {
		// Alice has 10 money. Returning stock 2: refund = costs[2] = 4, total = 14.
		// Must be > 2: stock 3 (cost 6, 14>=6 yes), stock 4 (9, yes), stock 5 (12, yes).
		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: 2 };
		const result = await getStockOptions(context);
		expect(result).toEqual([3, 4, 5]);
	});

	test('handles returnStock = empty string same as None', async () => {
		const contextNone = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: 'None' };
		const contextEmpty = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: '' };

		const resultNone = await getStockOptions(contextNone);
		const resultEmpty = await getStockOptions(contextEmpty);
		expect(resultEmpty).toEqual(resultNone);
	});

	test('handles null availStock', async () => {
		mockDbData = buildMockDb({
			countryInfo: {
				Austria: { availStock: null, offLimits: false },
			},
		});

		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: 'None' };
		const result = await getStockOptions(context);
		expect(result).toEqual([]);
	});

	test('handles empty availStock array', async () => {
		mockDbData = buildMockDb({
			countryInfo: {
				Austria: { availStock: [], offLimits: false },
			},
		});

		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: 'None' };
		const result = await getStockOptions(context);
		expect(result).toEqual([]);
	});

	test('returns only stocks with denomination greater than returned stock', async () => {
		// Returning stock 3. Only stocks > 3 should be returned: stock 4, 5.
		// Alice has 10 money + refund of costs[3]=6 = 16. Stock 4 (cost 9, 16>=9 yes), stock 5 (12, yes).
		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: 3 };
		const result = await getStockOptions(context);
		expect(result).toEqual([4, 5]);
		// Verify no stock <= 3 is included
		for (const stock of result) {
			expect(stock).toBeGreaterThan(3);
		}
	});

	test('returns empty when player cannot afford any stock', async () => {
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: { money: 0, stock: [] },
			},
			countryInfo: {
				Austria: { availStock: [4, 5], offLimits: false },
			},
		});

		// money=0, returnStock='None' -> returned=0, refund=0.
		// stock 4 cost 9, 0<9 no. stock 5 cost 12, 0<12 no.
		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: 'None' };
		const result = await getStockOptions(context);
		expect(result).toEqual([]);
	});

	test('returns stock when player can afford exactly', async () => {
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: { money: 9, stock: [] },
			},
		});

		// money=9, returnStock='None'. Stock 4 costs 9, 9>=9 yes. Stock 5 costs 12, 9<12 no.
		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: 'None' };
		const result = await getStockOptions(context);
		expect(result).toContain(4);
		expect(result).not.toContain(5);
	});

	test('return credit enables purchase of higher denomination stocks', async () => {
		mockDbData = buildMockDb({
			playerInfo: {
				Alice: { money: 3, stock: [] },
			},
		});

		// Without return: money=3. Stock 1 (2, yes), stock 2 (4, no).
		const contextNoReturn = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: 'None' };
		const resultNoReturn = await getStockOptions(contextNoReturn);
		expect(resultNoReturn).toEqual([1]);

		// With returning stock 2: refund=4, total=7. Stocks > 2: stock 3 (6, 7>=6 yes), stock 4 (9, no), stock 5 (12, no).
		const contextReturn = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: 2 };
		const resultReturn = await getStockOptions(contextReturn);
		expect(resultReturn).toEqual([3]);
	});

	test('returning highest stock still requires buying a higher one (no options if max is returned)', async () => {
		// Returning stock 5 (the highest). Stocks > 5: none exist.
		// refund = costs[5] = 12, total = 10+12 = 22. But no stock > 5 exists.
		const context = { game: 'testGame', name: 'Alice', buyCountry: 'Austria', returnStock: 5 };
		const result = await getStockOptions(context);
		expect(result).toEqual([]);
	});
});
