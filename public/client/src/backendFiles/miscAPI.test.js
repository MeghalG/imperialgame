// ---------------------------------------------------------------------------
// miscAPI.test.js -- Tests for getGameIDs, getMoney, getCountry, getBid,
//                    getStock, getVoteOptions, getGameState
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
	getStockBelow: jest.fn(() => Promise.resolve(3)),
}));

import { getGameIDs, getMoney, getCountry, getBid, getStock, getVoteOptions, getGameState } from './miscAPI.js';
import * as helper from './helper.js';
import { clearCache } from './stateCache.js';

beforeEach(() => {
	mockDbData = {};
	clearCache();
	jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getGameIDs
// ---------------------------------------------------------------------------
describe('getGameIDs', () => {
	test('returns array of game IDs when games exist', async () => {
		mockDbData = {
			games: {
				game1: { countryUp: 'France' },
				game2: { countryUp: 'Germany' },
				game3: { countryUp: 'Austria' },
			},
		};

		const result = await getGameIDs();
		expect(result).toEqual(['game1', 'game2', 'game3']);
	});

	test('returns empty array when no games exist (null from Firebase)', async () => {
		// When there are no games, Firebase returns null for the path
		mockDbData = {};

		const result = await getGameIDs();
		expect(result).toEqual([]);
	});

	test('returns keys of the games object', async () => {
		mockDbData = {
			games: {
				myGame: { mode: 'bid' },
				anotherGame: { mode: 'buy' },
			},
		};

		const result = await getGameIDs();
		expect(result).toContain('myGame');
		expect(result).toContain('anotherGame');
		expect(result).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// getMoney
// ---------------------------------------------------------------------------
describe('getMoney', () => {
	test("returns player's money from Firebase", async () => {
		mockDbData = {
			games: {
				game1: {
					playerInfo: {
						Alice: { money: 42 },
					},
				},
			},
		};

		const result = await getMoney({ game: 'game1', name: 'Alice' });
		expect(result).toBe(42);
	});

	test('throws when player does not exist', async () => {
		mockDbData = {
			games: {
				game1: {
					playerInfo: {},
				},
			},
		};

		await expect(getMoney({ game: 'game1', name: 'Ghost' })).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// getCountry
// ---------------------------------------------------------------------------
describe('getCountry', () => {
	test('returns the countryUp value', async () => {
		mockDbData = {
			games: {
				game1: {
					countryUp: 'Austria',
				},
			},
		};

		const result = await getCountry({ game: 'game1' });
		expect(result).toBe('Austria');
	});

	test('returns undefined when countryUp is not set', async () => {
		mockDbData = {
			games: {
				game1: {},
			},
		};

		const result = await getCountry({ game: 'game1' });
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// getBid
// ---------------------------------------------------------------------------
describe('getBid', () => {
	test("returns player's bid value", async () => {
		mockDbData = {
			games: {
				game1: {
					playerInfo: {
						Bob: { bid: 15 },
					},
				},
			},
		};

		const result = await getBid({ game: 'game1', name: 'Bob' });
		expect(result).toBe(15);
	});

	test('returns undefined when player has no bid', async () => {
		mockDbData = {
			games: {
				game1: {
					playerInfo: {
						Bob: {},
					},
				},
			},
		};

		const result = await getBid({ game: 'game1', name: 'Bob' });
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// getStock
// ---------------------------------------------------------------------------
describe('getStock', () => {
	test('returns object with country and value (stock denomination from helper.getStockBelow)', async () => {
		mockDbData = {
			games: {
				game1: {
					countryInfo: {
						France: { money: 10, points: 3 },
					},
					countryUp: 'France',
					playerInfo: {
						Alice: { bid: 12 },
					},
				},
			},
		};

		const result = await getStock({ game: 'game1', name: 'Alice' });
		expect(result).toEqual({ country: 'France', value: 3 });
	});

	test('calls helper.getStockBelow with correct arguments', async () => {
		const franceInfo = { money: 10, points: 5 };
		const context = { game: 'game1', name: 'Alice' };
		mockDbData = {
			games: {
				game1: {
					countryInfo: {
						France: franceInfo,
					},
					countryUp: 'France',
					playerInfo: {
						Alice: { bid: 20 },
					},
				},
			},
		};

		await getStock(context);

		expect(helper.getStockBelow).toHaveBeenCalledTimes(1);
		// Arguments: bid, countryInfo[country], context
		expect(helper.getStockBelow).toHaveBeenCalledWith(20, franceInfo, context);
	});
});

// ---------------------------------------------------------------------------
// getVoteOptions
// ---------------------------------------------------------------------------
describe('getVoteOptions', () => {
	test('returns array with two proposal strings', async () => {
		mockDbData = {
			games: {
				game1: {
					voting: {
						'proposal 1': { proposal: 'Produce in France' },
						'proposal 2': { proposal: 'Maneuver in Germany' },
					},
				},
			},
		};

		const result = await getVoteOptions({ game: 'game1' });
		expect(result).toEqual(['Produce in France', 'Maneuver in Germany']);
	});

	test('reads from gameState.voting', async () => {
		mockDbData = {
			games: {
				game1: {
					voting: {
						'proposal 1': { proposal: 'Tax Austria' },
						'proposal 2': { proposal: 'Import Italy' },
					},
					// Other game state fields should not affect the result
					countryUp: 'Austria',
					mode: 'vote',
				},
			},
		};

		const result = await getVoteOptions({ game: 'game1' });
		expect(result).toHaveLength(2);
		expect(result[0]).toBe('Tax Austria');
		expect(result[1]).toBe('Import Italy');
	});
});

// ---------------------------------------------------------------------------
// getGameState
// ---------------------------------------------------------------------------
describe('getGameState', () => {
	test('returns the complete game state object', async () => {
		const fullState = {
			countryUp: 'France',
			mode: 'proposal',
			turnID: 5,
			countryInfo: {
				France: { money: 10 },
				Germany: { money: 8 },
			},
			playerInfo: {
				Alice: { money: 20 },
				Bob: { money: 15 },
			},
			voting: {
				'proposal 1': { proposal: 'Produce' },
				'proposal 2': { proposal: 'Maneuver' },
			},
		};
		mockDbData = {
			games: {
				game1: fullState,
			},
		};

		const result = await getGameState({ game: 'game1' });
		expect(result).toEqual(fullState);
	});

	test('returns null when game does not exist', async () => {
		mockDbData = {};

		const result = await getGameState({ game: 'nonexistent' });
		expect(result).toBeNull();
	});
});
