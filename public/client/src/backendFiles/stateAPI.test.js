// ---------------------------------------------------------------------------
// stateAPI.test.js -- Tests for getCountryInfo and getPlayerInfo
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

// helper.js is imported by stateAPI.js — we mock computeCash to control its output
jest.mock('./helper.js', () => ({
	computeCash: jest.fn((playerInfo, countryInfo) => {
		// Real logic: sum(2 * stock.stock) + playerInfo.money
		let score = 0;
		if (playerInfo.stock) {
			for (let i in playerInfo.stock) {
				score += 2 * playerInfo.stock[i].stock;
			}
		}
		score += playerInfo.money || 0;
		return score;
	}),
}));

import { getCountryInfo, getPlayerInfo } from './stateAPI.js';
import { clearCache } from './stateCache.js';

beforeEach(() => {
	mockDbData = {};
	clearCache();
	jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getCountryInfo
// ---------------------------------------------------------------------------
describe('getCountryInfo', () => {
	test('returns country info object from Firebase', async () => {
		const countryData = {
			France: { money: 10, points: 3, leadership: ['Alice'] },
			Germany: { money: 8, points: 5, leadership: ['Bob'] },
		};
		mockDbData = {
			games: {
				game1: {
					countryInfo: countryData,
				},
			},
		};

		const result = await getCountryInfo({ game: 'game1' });
		expect(result).toEqual(countryData);
	});

	test('returns null when game does not exist', async () => {
		mockDbData = {};

		const result = await getCountryInfo({ game: 'nonexistent' });
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// getPlayerInfo
// ---------------------------------------------------------------------------
describe('getPlayerInfo', () => {
	test('returns player info with cashValue computed via helper.computeCash', async () => {
		mockDbData = {
			games: {
				game1: {
					playerInfo: {
						Alice: { money: 20, stock: [] },
						Bob: { money: 15, stock: [] },
					},
					countryInfo: {
						France: { points: 10 },
					},
				},
			},
		};

		const result = await getPlayerInfo({ game: 'game1' });
		expect(result.Alice.cashValue).toBeDefined();
		expect(result.Bob.cashValue).toBeDefined();
		// computeCash mock: sum(2*stock.stock) + money = 0 + 20 = 20
		expect(result.Alice.cashValue).toBe(20);
		expect(result.Bob.cashValue).toBe(15);
	});

	test('cashValue includes stock value ($2 per denomination)', async () => {
		mockDbData = {
			games: {
				game1: {
					playerInfo: {
						Alice: { money: 10, stock: [{ country: 'France', stock: 3 }] },
					},
					countryInfo: {
						France: { points: 10 },
					},
				},
			},
		};

		const result = await getPlayerInfo({ game: 'game1' });
		// computeCash mock: 2*3 + 10 = 16
		expect(result.Alice.cashValue).toBe(16);
	});

	test('player with no stock gets cashValue equal to money', async () => {
		mockDbData = {
			games: {
				game1: {
					playerInfo: {
						Alice: { money: 50, stock: [] },
					},
					countryInfo: {},
				},
			},
		};

		const result = await getPlayerInfo({ game: 'game1' });
		expect(result.Alice.cashValue).toBe(50);
	});

	test('multiple stocks add to cashValue', async () => {
		mockDbData = {
			games: {
				game1: {
					playerInfo: {
						Alice: {
							money: 5,
							stock: [
								{ country: 'France', stock: 3 },
								{ country: 'Germany', stock: 4 },
							],
						},
					},
					countryInfo: {
						France: { points: 10 },
						Germany: { points: 15 },
					},
				},
			},
		};

		const result = await getPlayerInfo({ game: 'game1' });
		// computeCash mock: 2*3 + 2*4 + 5 = 6 + 8 + 5 = 19
		expect(result.Alice.cashValue).toBe(19);
	});

	test('all players get cashValue property', async () => {
		mockDbData = {
			games: {
				game1: {
					playerInfo: {
						Alice: { money: 10, stock: [] },
						Bob: { money: 20, stock: [] },
						Charlie: { money: 30, stock: [] },
					},
					countryInfo: {},
				},
			},
		};

		const result = await getPlayerInfo({ game: 'game1' });
		const players = Object.keys(result);
		expect(players).toHaveLength(3);
		for (const player of players) {
			expect(result[player]).toHaveProperty('cashValue');
		}
		expect(result.Alice.cashValue).toBe(10);
		expect(result.Bob.cashValue).toBe(20);
		expect(result.Charlie.cashValue).toBe(30);
	});

	test('preserves original fields alongside cashValue', async () => {
		mockDbData = {
			games: {
				game1: {
					playerInfo: {
						Alice: { money: 10, stock: [{ country: 'France', stock: 3 }], bid: 5 },
					},
					countryInfo: {
						France: { points: 10 },
					},
				},
			},
		};

		const result = await getPlayerInfo({ game: 'game1' });
		expect(result.Alice.money).toBe(10);
		expect(result.Alice.bid).toBe(5);
		expect(result.Alice.stock).toEqual([{ country: 'France', stock: 3 }]);
		expect(result.Alice.cashValue).toBe(16);
	});
});
