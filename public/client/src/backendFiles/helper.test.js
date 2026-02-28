// Mock DB data tree. Tests for async functions populate this before each call.
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

// Mock firebase.js before importing helper.js so Firebase never initializes
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
	fix: jest.fn(),
}));

import {
	getOwnedStock,
	getSat,
	getUnsatFactories,
	getInvestorPayout,
	getStockBelow,
	computeScore,
	computeCash,
	getPermSwiss,
	getWinner,
	getTaxSplit,
	getTaxInfo,
	stringifyFunctions,
	unstringifyFunctions,
	investorPassed,
} from './helper.js';
import { clearCache } from './stateCache.js';

// ---------------------------------------------------------------------------
// getOwnedStock
// ---------------------------------------------------------------------------
describe('getOwnedStock', () => {
	test('returns stock amounts for each leader', () => {
		const leadership = ['Alice', 'Bob'];
		const playerInfo = {
			Alice: {
				stock: [
					{ country: 'France', stock: 3 },
					{ country: 'Germany', stock: 2 },
					{ country: 'France', stock: 1 },
				],
			},
			Bob: {
				stock: [{ country: 'France', stock: 5 }],
			},
		};
		const result = getOwnedStock(leadership, playerInfo, 'France');
		expect(result).toEqual([
			['Alice', 4],
			['Bob', 5],
		]);
	});

	test('returns zero when a leader has no stock in the given country', () => {
		const leadership = ['Alice'];
		const playerInfo = {
			Alice: {
				stock: [{ country: 'Germany', stock: 2 }],
			},
		};
		const result = getOwnedStock(leadership, playerInfo, 'France');
		expect(result).toEqual([['Alice', 0]]);
	});

	test('returns zero when a leader has no stock at all', () => {
		const leadership = ['Alice'];
		const playerInfo = {
			Alice: { stock: [] },
		};
		const result = getOwnedStock(leadership, playerInfo, 'France');
		expect(result).toEqual([['Alice', 0]]);
	});

	test('handles a single leader with a single matching stock entry', () => {
		const leadership = ['Charlie'];
		const playerInfo = {
			Charlie: {
				stock: [{ country: 'Austria', stock: 7 }],
			},
		};
		const result = getOwnedStock(leadership, playerInfo, 'Austria');
		expect(result).toEqual([['Charlie', 7]]);
	});

	test('handles multiple leaders where some have no matching stock', () => {
		const leadership = ['Alice', 'Bob', 'Charlie'];
		const playerInfo = {
			Alice: { stock: [{ country: 'Italy', stock: 2 }] },
			Bob: { stock: [{ country: 'France', stock: 3 }] },
			Charlie: { stock: [] },
		};
		const result = getOwnedStock(leadership, playerInfo, 'Italy');
		expect(result).toEqual([
			['Alice', 2],
			['Bob', 0],
			['Charlie', 0],
		]);
	});
});

// ---------------------------------------------------------------------------
// getSat
// ---------------------------------------------------------------------------
describe('getSat', () => {
	test('returns empty array when no armies are hostile', () => {
		const countryInfo = {
			France: { armies: [{ territory: 'Paris', hostile: false }] },
			Germany: { armies: [{ territory: 'Berlin', hostile: false }] },
		};
		expect(getSat(countryInfo, 'France')).toEqual([]);
	});

	test('returns territories sat on by other countries hostile armies', () => {
		const countryInfo = {
			France: { armies: [{ territory: 'Paris', hostile: false }] },
			Germany: { armies: [{ territory: 'Munich', hostile: true }] },
			Austria: { armies: [{ territory: 'Vienna', hostile: true }] },
		};
		const result = getSat(countryInfo, 'France');
		expect(result).toContain('Munich');
		expect(result).toContain('Vienna');
		expect(result).toHaveLength(2);
	});

	test('ignores hostile armies belonging to the specified country itself', () => {
		const countryInfo = {
			France: { armies: [{ territory: 'Paris', hostile: true }] },
			Germany: { armies: [] },
		};
		// France's own hostile armies should not appear
		expect(getSat(countryInfo, 'France')).toEqual([]);
	});

	test('returns empty array when no other countries exist', () => {
		const countryInfo = {
			France: { armies: [{ territory: 'Paris', hostile: true }] },
		};
		expect(getSat(countryInfo, 'France')).toEqual([]);
	});

	test('handles countries with no armies array', () => {
		const countryInfo = {
			France: { armies: [] },
			Germany: { armies: [] },
		};
		expect(getSat(countryInfo, 'France')).toEqual([]);
	});

	test('returns duplicate territories when multiple hostile armies sit on same territory', () => {
		const countryInfo = {
			France: { armies: [] },
			Germany: {
				armies: [
					{ territory: 'Lyon', hostile: true },
					{ territory: 'Lyon', hostile: true },
				],
			},
		};
		const result = getSat(countryInfo, 'France');
		expect(result).toEqual(['Lyon', 'Lyon']);
	});
});

// ---------------------------------------------------------------------------
// getUnsatFactories
// ---------------------------------------------------------------------------
describe('getUnsatFactories', () => {
	test('returns all factories when none are sat on', () => {
		const countryInfo = {
			France: {
				factories: ['Paris', 'Lyon', 'Marseille'],
				armies: [],
			},
			Germany: { armies: [] },
		};
		const result = getUnsatFactories(countryInfo, 'France');
		expect(result).toEqual(['Paris', 'Lyon', 'Marseille']);
	});

	test('excludes factories that are sat on by hostile armies of other countries', () => {
		const countryInfo = {
			France: {
				factories: ['Paris', 'Lyon', 'Marseille'],
				armies: [],
			},
			Germany: {
				armies: [{ territory: 'Lyon', hostile: true }],
			},
		};
		const result = getUnsatFactories(countryInfo, 'France');
		expect(result).toEqual(['Paris', 'Marseille']);
	});

	test('returns empty array when all factories are sat on', () => {
		const countryInfo = {
			France: {
				factories: ['Paris', 'Lyon'],
				armies: [],
			},
			Germany: {
				armies: [
					{ territory: 'Paris', hostile: true },
					{ territory: 'Lyon', hostile: true },
				],
			},
		};
		const result = getUnsatFactories(countryInfo, 'France');
		expect(result).toEqual([]);
	});

	test('returns empty array when country has no factories', () => {
		const countryInfo = {
			France: {
				factories: [],
				armies: [],
			},
			Germany: { armies: [] },
		};
		const result = getUnsatFactories(countryInfo, 'France');
		expect(result).toEqual([]);
	});

	test('does not filter factories based on non-hostile armies', () => {
		const countryInfo = {
			France: {
				factories: ['Paris', 'Lyon'],
				armies: [],
			},
			Germany: {
				armies: [{ territory: 'Paris', hostile: false }],
			},
		};
		const result = getUnsatFactories(countryInfo, 'France');
		expect(result).toEqual(['Paris', 'Lyon']);
	});

	test('does not filter factories based on own hostile armies', () => {
		const countryInfo = {
			France: {
				factories: ['Paris', 'Lyon'],
				armies: [{ territory: 'Paris', hostile: true }],
			},
		};
		const result = getUnsatFactories(countryInfo, 'France');
		expect(result).toEqual(['Paris', 'Lyon']);
	});
});

// ---------------------------------------------------------------------------
// computeScore
// ---------------------------------------------------------------------------
describe('computeScore', () => {
	test('computes score from stock value + money + scoreModifier', () => {
		const playerInfo = {
			stock: [
				{ country: 'France', stock: 3 },
				{ country: 'Germany', stock: 2 },
			],
			money: 10,
			scoreModifier: 5,
		};
		const countryInfos = {
			France: { points: 12 }, // floor(12/5) = 2, value per stock = 2
			Germany: { points: 23 }, // floor(23/5) = 4, value per stock = 4
		};
		// (2*3) + (4*2) + 10 + 5 = 6 + 8 + 10 + 5 = 29
		expect(computeScore(playerInfo, countryInfos)).toBe(29);
	});

	test('returns just money + scoreModifier when player has no stock', () => {
		const playerInfo = {
			stock: [],
			money: 15,
			scoreModifier: 3,
		};
		const countryInfos = {};
		expect(computeScore(playerInfo, countryInfos)).toBe(18);
	});

	test('handles zero points country (floor(0/5) = 0)', () => {
		const playerInfo = {
			stock: [{ country: 'France', stock: 5 }],
			money: 0,
			scoreModifier: 0,
		};
		const countryInfos = {
			France: { points: 0 },
		};
		expect(computeScore(playerInfo, countryInfos)).toBe(0);
	});

	test('handles points below 5 (floor returns 0)', () => {
		const playerInfo = {
			stock: [{ country: 'France', stock: 10 }],
			money: 7,
			scoreModifier: 0,
		};
		const countryInfos = {
			France: { points: 4 },
		};
		// floor(4/5) = 0, so stock contributes nothing
		expect(computeScore(playerInfo, countryInfos)).toBe(7);
	});

	test('handles negative scoreModifier', () => {
		const playerInfo = {
			stock: [{ country: 'France', stock: 1 }],
			money: 10,
			scoreModifier: -3,
		};
		const countryInfos = {
			France: { points: 10 }, // floor(10/5) = 2
		};
		// 2*1 + 10 + (-3) = 9
		expect(computeScore(playerInfo, countryInfos)).toBe(9);
	});

	test('floors points correctly at boundary (points = 5)', () => {
		const playerInfo = {
			stock: [{ country: 'France', stock: 2 }],
			money: 0,
			scoreModifier: 0,
		};
		const countryInfos = {
			France: { points: 5 },
		};
		// floor(5/5) = 1, 1*2 = 2
		expect(computeScore(playerInfo, countryInfos)).toBe(2);
	});

	test('floors points correctly at boundary (points = 24)', () => {
		const playerInfo = {
			stock: [{ country: 'France', stock: 1 }],
			money: 0,
			scoreModifier: 0,
		};
		const countryInfos = {
			France: { points: 24 },
		};
		// floor(24/5) = 4, 4*1 = 4
		expect(computeScore(playerInfo, countryInfos)).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// computeCash
// ---------------------------------------------------------------------------
describe('computeCash', () => {
	test('computes 2 per stock unit plus money', () => {
		const playerInfo = {
			stock: [
				{ country: 'France', stock: 3 },
				{ country: 'Germany', stock: 2 },
			],
			money: 10,
		};
		const countryInfos = {};
		// 2*3 + 2*2 + 10 = 6 + 4 + 10 = 20
		expect(computeCash(playerInfo, countryInfos)).toBe(20);
	});

	test('returns just money when player has no stock', () => {
		const playerInfo = {
			stock: [],
			money: 7,
		};
		expect(computeCash(playerInfo, {})).toBe(7);
	});

	test('returns 0 when player has no stock and no money', () => {
		const playerInfo = {
			stock: [],
			money: 0,
		};
		expect(computeCash(playerInfo, {})).toBe(0);
	});

	test('does not depend on country points (unlike computeScore)', () => {
		const playerInfo = {
			stock: [{ country: 'France', stock: 4 }],
			money: 5,
		};
		const countryInfos = {
			France: { points: 100 },
		};
		// 2*4 + 5 = 13, regardless of points
		expect(computeCash(playerInfo, countryInfos)).toBe(13);
	});
});

// ---------------------------------------------------------------------------
// getPermSwiss
// ---------------------------------------------------------------------------
describe('getPermSwiss', () => {
	test('returns all players when no countries have leadership', () => {
		const gameState = {
			playerInfo: {
				Alice: {},
				Bob: {},
				Charlie: {},
			},
			countryInfo: {},
		};
		expect(getPermSwiss(gameState)).toEqual(['Alice', 'Bob', 'Charlie']);
	});

	test('removes both leaders in a democracy', () => {
		const gameState = {
			playerInfo: {
				Alice: {},
				Bob: {},
				Charlie: {},
			},
			countryInfo: {
				France: {
					gov: 'democracy',
					leadership: ['Alice', 'Bob'],
				},
			},
		};
		expect(getPermSwiss(gameState)).toEqual(['Charlie']);
	});

	test('removes only the single leader in a dictatorship', () => {
		const gameState = {
			playerInfo: {
				Alice: {},
				Bob: {},
				Charlie: {},
			},
			countryInfo: {
				France: {
					gov: 'dictatorship',
					leadership: ['Alice'],
				},
			},
		};
		const result = getPermSwiss(gameState);
		expect(result).toContain('Bob');
		expect(result).toContain('Charlie');
		expect(result).not.toContain('Alice');
	});

	test('handles multiple countries removing different leaders', () => {
		const gameState = {
			playerInfo: {
				Alice: {},
				Bob: {},
				Charlie: {},
				Dave: {},
			},
			countryInfo: {
				France: {
					gov: 'democracy',
					leadership: ['Alice', 'Bob'],
				},
				Germany: {
					gov: 'dictatorship',
					leadership: ['Charlie'],
				},
			},
		};
		expect(getPermSwiss(gameState)).toEqual(['Dave']);
	});

	test('returns empty array when all players are in leadership', () => {
		const gameState = {
			playerInfo: {
				Alice: {},
				Bob: {},
			},
			countryInfo: {
				France: {
					gov: 'democracy',
					leadership: ['Alice', 'Bob'],
				},
			},
		};
		expect(getPermSwiss(gameState)).toEqual([]);
	});

	test('does not remove a player twice even if listed in multiple leaderships', () => {
		const gameState = {
			playerInfo: {
				Alice: {},
				Bob: {},
				Charlie: {},
			},
			countryInfo: {
				France: {
					gov: 'dictatorship',
					leadership: ['Alice'],
				},
				Germany: {
					gov: 'dictatorship',
					leadership: ['Alice'],
				},
			},
		};
		const result = getPermSwiss(gameState);
		// Alice removed by France, second removal for Alice is a no-op
		expect(result).toEqual(['Bob', 'Charlie']);
	});

	test('ignores countries with unrecognized gov types', () => {
		const gameState = {
			playerInfo: {
				Alice: {},
				Bob: {},
			},
			countryInfo: {
				France: {
					gov: 'anarchy',
					leadership: ['Alice'],
				},
			},
		};
		// 'anarchy' is neither 'democracy' nor 'dictatorship', so no one is removed
		expect(getPermSwiss(gameState)).toEqual(['Alice', 'Bob']);
	});
});

// ---------------------------------------------------------------------------
// getWinner
// ---------------------------------------------------------------------------
describe('getWinner', () => {
	test('returns the player with the highest score', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [], money: 10, scoreModifier: 0 },
				Bob: { stock: [], money: 20, scoreModifier: 0 },
				Charlie: { stock: [], money: 15, scoreModifier: 0 },
			},
			countryInfo: {},
		};
		expect(getWinner(gameState)).toBe('Bob');
	});

	test('considers stock value in determining winner', () => {
		const gameState = {
			playerInfo: {
				Alice: {
					stock: [{ country: 'France', stock: 5 }],
					money: 0,
					scoreModifier: 0,
				},
				Bob: {
					stock: [],
					money: 8,
					scoreModifier: 0,
				},
			},
			countryInfo: {
				France: { points: 10 }, // floor(10/5)=2, 2*5=10
			},
		};
		// Alice = 10, Bob = 8
		expect(getWinner(gameState)).toBe('Alice');
	});

	test('non-tied scores still resolve correctly with multiple countries', () => {
		const gameState = {
			playerInfo: {
				Alice: {
					stock: [{ country: 'France', stock: 5 }],
					money: 0,
					scoreModifier: 0,
				},
				Bob: {
					stock: [{ country: 'Germany', stock: 3 }],
					money: 4,
					scoreModifier: 0,
				},
			},
			countryInfo: {
				France: { points: 5 }, // floor(5/5)=1, 1*5=5
				Germany: { points: 5 }, // floor(5/5)=1, 1*3=3
			},
		};
		// Score: Alice = 1*5 + 0 = 5, Bob = 1*3 + 4 = 7 -> Bob wins by score
		expect(getWinner(gameState)).toBe('Bob');
	});

	test('breaks score tie by investment in strongest nation', () => {
		const gameState = {
			playerInfo: {
				Alice: {
					stock: [{ country: 'France', stock: 5 }],
					money: 5,
					scoreModifier: 0,
				},
				Bob: {
					stock: [{ country: 'France', stock: 2 }],
					money: 8,
					scoreModifier: 0,
				},
			},
			countryInfo: {
				France: { points: 5 }, // floor(5/5)=1; strongest nation
			},
		};
		// Score: Alice = 1*5 + 5 = 10, Bob = 1*2 + 8 = 10 -> tied
		// Strongest nation: France (5 points)
		// Investment in France: Alice = 5, Bob = 2 -> Alice wins
		expect(getWinner(gameState)).toBe('Alice');
	});

	test('score tie broken by investment in strongest nation, not cash', () => {
		const gameState = {
			playerInfo: {
				Alice: {
					stock: [{ country: 'France', stock: 4 }],
					money: 2,
					scoreModifier: 0,
				},
				Bob: {
					stock: [{ country: 'France', stock: 1 }],
					money: 8,
					scoreModifier: 0,
				},
			},
			countryInfo: {
				France: { points: 10 }, // floor(10/5)=2; strongest
			},
		};
		// Score: Alice = 2*4 + 2 = 10, Bob = 2*1 + 8 = 10 -> tied
		// Strongest nation: France (10 points)
		// Investment in France: Alice = 4, Bob = 1 -> Alice wins
		// (Bob has more cash $8 vs $2, but investment tiebreaker takes priority)
		expect(getWinner(gameState)).toBe('Alice');
	});

	test('only considers strongest nation for investment tiebreaker', () => {
		const gameState = {
			playerInfo: {
				Alice: {
					stock: [
						{ country: 'France', stock: 1 },
						{ country: 'Germany', stock: 9 },
					],
					money: 5,
					scoreModifier: 0,
				},
				Bob: {
					stock: [
						{ country: 'France', stock: 3 },
						{ country: 'Germany', stock: 1 },
					],
					money: 9,
					scoreModifier: 0,
				},
			},
			countryInfo: {
				France: { points: 15 }, // floor(15/5)=3; strongest
				Germany: { points: 5 }, // floor(5/5)=1; weaker
			},
		};
		// Score: Alice = 3*1 + 1*9 + 5 = 17, Bob = 3*3 + 1*1 + 9 = 19 -> Bob wins by score
		// Not tied, Bob wins outright
		expect(getWinner(gameState)).toBe('Bob');
	});

	test('cash on hand breaks tie when investment in strongest nation is equal', () => {
		const gameState = {
			playerInfo: {
				Alice: {
					stock: [{ country: 'France', stock: 3 }],
					money: 5,
					scoreModifier: 0,
				},
				Bob: {
					stock: [{ country: 'France', stock: 3 }],
					money: 2,
					scoreModifier: 3,
				},
			},
			countryInfo: {
				France: { points: 5 }, // floor(5/5)=1; strongest
			},
		};
		// Score: Alice = 1*3 + 5 = 8, Bob = 1*3 + 2 + 3 = 8 -> tied
		// Strongest nation: France
		// Investment in France: Alice = 3, Bob = 3 -> tied
		// Cash on hand: Alice = 5, Bob = 2 -> Alice wins
		expect(getWinner(gameState)).toBe('Alice');
	});

	test('first player wins when all tiebreakers are equal', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [], money: 10, scoreModifier: 0 },
				Bob: { stock: [], money: 10, scoreModifier: 0 },
			},
			countryInfo: {},
		};
		// Score: Alice = 10, Bob = 10 -> tied
		// No nations exist, so investment = 0 for both -> tied
		// Cash on hand: Alice = 10, Bob = 10 -> tied
		// First encountered player wins (Alice)
		expect(getWinner(gameState)).toBe('Alice');
	});

	test('returns empty string when no players exist', () => {
		const gameState = {
			playerInfo: {},
			countryInfo: {},
		};
		expect(getWinner(gameState)).toBe('');
	});

	test('returns the only player when there is exactly one', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [], money: 5, scoreModifier: 0 },
			},
			countryInfo: {},
		};
		expect(getWinner(gameState)).toBe('Alice');
	});

	test('accounts for scoreModifier in determining winner', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [], money: 5, scoreModifier: 10 },
				Bob: { stock: [], money: 14, scoreModifier: 0 },
			},
			countryInfo: {},
		};
		// Alice=15, Bob=14
		expect(getWinner(gameState)).toBe('Alice');
	});

	test('higher score wins when stocks differ', () => {
		const gameState = {
			playerInfo: {
				Alice: {
					stock: [{ country: 'France', stock: 2 }],
					money: 8,
					scoreModifier: 0,
				},
				Bob: {
					stock: [{ country: 'France', stock: 5 }],
					money: 5,
					scoreModifier: 0,
				},
			},
			countryInfo: {
				France: { points: 10 }, // floor(10/5)=2
			},
		};
		// Score: Alice = 2*2 + 8 = 12, Bob = 2*5 + 5 = 15 -> Bob wins
		expect(getWinner(gameState)).toBe('Bob');
	});

	test('tied scores with tied top nations: sum investment across all top nations', () => {
		const gameState = {
			playerInfo: {
				Alice: {
					stock: [
						{ country: 'France', stock: 2 },
						{ country: 'Germany', stock: 5 },
					],
					money: 3,
					scoreModifier: 0,
				},
				Bob: {
					stock: [
						{ country: 'France', stock: 4 },
						{ country: 'Germany', stock: 2 },
					],
					money: 4,
					scoreModifier: 0,
				},
			},
			countryInfo: {
				France: { points: 10 }, // floor(10/5)=2; tied for strongest
				Germany: { points: 10 }, // floor(10/5)=2; tied for strongest
			},
		};
		// Score: Alice = 2*2 + 2*5 + 3 = 17, Bob = 2*4 + 2*2 + 4 = 16 -> Alice wins by score
		expect(getWinner(gameState)).toBe('Alice');
	});

	test('tied scores with tied top nations: investment sum across top nations breaks tie', () => {
		const gameState = {
			playerInfo: {
				Alice: {
					stock: [
						{ country: 'France', stock: 1 },
						{ country: 'Germany', stock: 3 },
					],
					money: 6,
					scoreModifier: 0,
				},
				Bob: {
					stock: [
						{ country: 'France', stock: 3 },
						{ country: 'Germany', stock: 3 },
					],
					money: 2,
					scoreModifier: 0,
				},
			},
			countryInfo: {
				France: { points: 10 }, // floor(10/5)=2; tied for strongest
				Germany: { points: 10 }, // floor(10/5)=2; tied for strongest
			},
		};
		// Score: Alice = 2*1 + 2*3 + 6 = 14, Bob = 2*3 + 2*3 + 2 = 14 -> tied
		// Top nations: France and Germany (both 10 points)
		// Investment: Alice = 1 + 3 = 4, Bob = 3 + 3 = 6 -> Bob wins
		expect(getWinner(gameState)).toBe('Bob');
	});
});

// ---------------------------------------------------------------------------
// getTaxSplit
// ---------------------------------------------------------------------------
describe('getTaxSplit', () => {
	test('splits evenly when leadership owns equal stock', () => {
		const countryInfo = {
			France: { leadership: ['Alice', 'Bob'] },
		};
		const playerInfo = {
			Alice: { stock: [{ country: 'France', stock: 3 }] },
			Bob: { stock: [{ country: 'France', stock: 3 }] },
		};
		const result = getTaxSplit(6, countryInfo, playerInfo, 'France');
		// Equal ownership -> even split
		expect(result).toEqual([
			['Alice', 3],
			['Bob', 3],
		]);
	});

	test('splits proportionally with uneven stock ownership', () => {
		const countryInfo = {
			France: { leadership: ['Alice', 'Bob'] },
		};
		const playerInfo = {
			Alice: { stock: [{ country: 'France', stock: 2 }] },
			Bob: { stock: [{ country: 'France', stock: 1 }] },
		};
		// 3 total stock, 3 money to distribute
		// Alice has 2/3 ownership, Bob has 1/3
		const result = getTaxSplit(3, countryInfo, playerInfo, 'France');
		expect(result).toEqual([
			['Alice', 2],
			['Bob', 1],
		]);
	});

	test('gives all money to sole stockholder', () => {
		const countryInfo = {
			France: { leadership: ['Alice', 'Bob'] },
		};
		const playerInfo = {
			Alice: { stock: [{ country: 'France', stock: 5 }] },
			Bob: { stock: [] },
		};
		const result = getTaxSplit(4, countryInfo, playerInfo, 'France');
		// Only Alice owns stock, so she gets everything
		// Bob gets nothing and should not appear in output
		expect(result).toEqual([['Alice', 4]]);
	});

	test('returns empty array when money is 0', () => {
		const countryInfo = {
			France: { leadership: ['Alice'] },
		};
		const playerInfo = {
			Alice: { stock: [{ country: 'France', stock: 3 }] },
		};
		const result = getTaxSplit(0, countryInfo, playerInfo, 'France');
		expect(result).toEqual([]);
	});

	test('handles single leader with stock', () => {
		const countryInfo = {
			France: { leadership: ['Alice'] },
		};
		const playerInfo = {
			Alice: { stock: [{ country: 'France', stock: 2 }] },
		};
		const result = getTaxSplit(5, countryInfo, playerInfo, 'France');
		expect(result).toEqual([['Alice', 5]]);
	});

	test('distributes 1 money correctly between two holders', () => {
		const countryInfo = {
			France: { leadership: ['Alice', 'Bob'] },
		};
		const playerInfo = {
			Alice: { stock: [{ country: 'France', stock: 3 }] },
			Bob: { stock: [{ country: 'France', stock: 2 }] },
		};
		const result = getTaxSplit(1, countryInfo, playerInfo, 'France');
		// Alice has more stock, so she gets the 1 money
		expect(result).toEqual([['Alice', 1]]);
	});

	test('total distributed equals money input', () => {
		const countryInfo = {
			France: { leadership: ['Alice', 'Bob'] },
		};
		const playerInfo = {
			Alice: { stock: [{ country: 'France', stock: 7 }] },
			Bob: { stock: [{ country: 'France', stock: 3 }] },
		};
		const money = 10;
		const result = getTaxSplit(money, countryInfo, playerInfo, 'France');
		const totalDistributed = result.reduce((sum, entry) => sum + entry[1], 0);
		expect(totalDistributed).toBe(money);
	});
});

// ---------------------------------------------------------------------------
// stringifyFunctions
// ---------------------------------------------------------------------------
describe('stringifyFunctions', () => {
	test('converts setter functions (keys starting with "set") to strings', () => {
		const fn = () => 42;
		const d = {
			setName: fn,
			name: 'Alice',
		};
		const result = stringifyFunctions(d);
		expect(typeof result.setName).toBe('string');
		expect(result.setName).toBe(fn.toString());
		expect(result.name).toBe('Alice');
	});

	test('converts resetter functions (keys starting with "reset") to strings', () => {
		const fn = () => {};
		const d = {
			resetValues: fn,
			value: 10,
		};
		const result = stringifyFunctions(d);
		expect(typeof result.resetValues).toBe('string');
		expect(result.value).toBe(10);
	});

	test('leaves non-set/reset keys unchanged even if they are functions', () => {
		const fn = () => 'hello';
		const d = {
			myFunction: fn,
			doSomething: fn,
		};
		const result = stringifyFunctions(d);
		// Keys don't start with "set" or "reset", so they are kept as-is
		expect(result.myFunction).toBe(fn);
		expect(result.doSomething).toBe(fn);
	});

	test('handles empty object', () => {
		expect(stringifyFunctions({})).toEqual({});
	});

	test('handles mix of set, reset, and regular keys', () => {
		const setFn = (x) => x + 1;
		const resetFn = () => 0;
		const d = {
			setScore: setFn,
			resetScore: resetFn,
			score: 42,
			player: 'Alice',
		};
		const result = stringifyFunctions(d);
		expect(typeof result.setScore).toBe('string');
		expect(typeof result.resetScore).toBe('string');
		expect(result.score).toBe(42);
		expect(result.player).toBe('Alice');
	});

	test('preserves non-function values of all types', () => {
		const d = {
			count: 0,
			flag: true,
			items: [1, 2, 3],
			nested: { a: 1 },
			nothing: null,
		};
		const result = stringifyFunctions(d);
		expect(result).toEqual(d);
	});

	test('handles keys that start with "set" but value is not a function', () => {
		const d = {
			settings: 'dark-mode',
			setup: { theme: 'dark' },
		};
		const result = stringifyFunctions(d);
		// "settings" starts with "set", so it calls .toString() on the string
		expect(result.settings).toBe('dark-mode');
		// "setup" starts with "set", so it calls .toString() on the object
		expect(typeof result.setup).toBe('string');
	});
});

// ---------------------------------------------------------------------------
// unstringifyFunctions
// ---------------------------------------------------------------------------
describe('unstringifyFunctions', () => {
	test('roundtrips with stringifyFunctions for set-prefixed keys', () => {
		const fn = () => 42;
		const input = { setFoo: fn, bar: 'hello' };
		const stringified = stringifyFunctions(input);
		const restored = unstringifyFunctions(stringified);
		expect(typeof restored.setFoo).toBe('function');
		expect(restored.bar).toBe('hello');
	});

	test('roundtrips with stringifyFunctions for reset-prefixed keys', () => {
		const fn = () => 0;
		const input = { resetBaz: fn, count: 5 };
		const stringified = stringifyFunctions(input);
		const restored = unstringifyFunctions(stringified);
		expect(typeof restored.resetBaz).toBe('function');
		expect(restored.count).toBe(5);
	});

	test('leaves non-set/reset keys as-is', () => {
		const input = { name: 'Alice', score: 42 };
		const result = unstringifyFunctions(input);
		expect(result).toEqual({ name: 'Alice', score: 42 });
	});

	test('handles empty object', () => {
		expect(unstringifyFunctions({})).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// getInvestorPayout
// ---------------------------------------------------------------------------
describe('getInvestorPayout', () => {
	test('pays each leader their full stock denomination when treasury covers it', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [{ country: 'France', stock: 3 }] },
				Bob: { stock: [{ country: 'France', stock: 2 }] },
			},
			countryInfo: {
				France: {
					leadership: ['Alice', 'Bob'],
					money: 10,
				},
			},
		};
		const result = getInvestorPayout(gameState, 'France', 'Alice');
		// Total payout = 3 + 2 = 5, treasury = 10, no shortfall
		expect(result).toEqual([
			['Alice', 3],
			['Bob', 2],
		]);
	});

	test('deducts shortfall from the current player when treasury is insufficient', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [{ country: 'France', stock: 5 }] },
				Bob: { stock: [{ country: 'France', stock: 4 }] },
			},
			countryInfo: {
				France: {
					leadership: ['Alice', 'Bob'],
					money: 6,
				},
			},
		};
		// Total payout = 5 + 4 = 9, treasury = 6, shortfall = 3
		// Alice is the current player, so shortfall is deducted from her payout
		const result = getInvestorPayout(gameState, 'France', 'Alice');
		expect(result).toEqual([
			['Alice', 2], // 5 - 3 = 2
			['Bob', 4],
		]);
	});

	test('deducts shortfall from opposition when opposition is the current player', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [{ country: 'France', stock: 5 }] },
				Bob: { stock: [{ country: 'France', stock: 4 }] },
			},
			countryInfo: {
				France: {
					leadership: ['Alice', 'Bob'],
					money: 6,
				},
			},
		};
		// Total payout = 9, treasury = 6, shortfall = 3
		// Bob is the current player, so shortfall deducted from Bob
		const result = getInvestorPayout(gameState, 'France', 'Bob');
		expect(result).toEqual([
			['Alice', 5],
			['Bob', 1], // 4 - 3 = 1
		]);
	});

	test('handles single leader with sufficient treasury', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [{ country: 'Germany', stock: 4 }] },
			},
			countryInfo: {
				Germany: {
					leadership: ['Alice'],
					money: 10,
				},
			},
		};
		const result = getInvestorPayout(gameState, 'Germany', 'Alice');
		expect(result).toEqual([['Alice', 4]]);
	});

	test('handles single leader with shortfall', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [{ country: 'Germany', stock: 8 }] },
			},
			countryInfo: {
				Germany: {
					leadership: ['Alice'],
					money: 3,
				},
			},
		};
		// Total payout = 8, treasury = 3, shortfall = 5
		// Alice absorbs the shortfall: 8 - 5 = 3
		const result = getInvestorPayout(gameState, 'Germany', 'Alice');
		expect(result).toEqual([['Alice', 3]]);
	});

	test('returns zero payout for leaders with no stock in the country', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [{ country: 'Germany', stock: 3 }] },
				Bob: { stock: [] },
			},
			countryInfo: {
				France: {
					leadership: ['Alice', 'Bob'],
					money: 10,
				},
			},
		};
		// Alice has stock in Germany, not France; Bob has no stock at all
		const result = getInvestorPayout(gameState, 'France', 'Alice');
		expect(result).toEqual([
			['Alice', 0],
			['Bob', 0],
		]);
	});

	test('handles multiple stock entries for the same country', () => {
		const gameState = {
			playerInfo: {
				Alice: {
					stock: [
						{ country: 'France', stock: 2 },
						{ country: 'France', stock: 3 },
					],
				},
				Bob: { stock: [{ country: 'France', stock: 1 }] },
			},
			countryInfo: {
				France: {
					leadership: ['Alice', 'Bob'],
					money: 20,
				},
			},
		};
		// Alice's total = 2 + 3 = 5, Bob = 1, total = 6, treasury = 20 -> no shortfall
		const result = getInvestorPayout(gameState, 'France', 'Alice');
		expect(result).toEqual([
			['Alice', 5],
			['Bob', 1],
		]);
	});

	test('treasury exactly equals total payout (no shortfall)', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [{ country: 'France', stock: 3 }] },
				Bob: { stock: [{ country: 'France', stock: 2 }] },
			},
			countryInfo: {
				France: {
					leadership: ['Alice', 'Bob'],
					money: 5,
				},
			},
		};
		// Total = 5, treasury = 5, exact match
		const result = getInvestorPayout(gameState, 'France', 'Alice');
		expect(result).toEqual([
			['Alice', 3],
			['Bob', 2],
		]);
	});

	test('treasury is zero causes full shortfall on current player', () => {
		const gameState = {
			playerInfo: {
				Alice: { stock: [{ country: 'France', stock: 3 }] },
				Bob: { stock: [{ country: 'France', stock: 2 }] },
			},
			countryInfo: {
				France: {
					leadership: ['Alice', 'Bob'],
					money: 0,
				},
			},
		};
		// Total = 5, treasury = 0, shortfall = 5
		// Alice absorbs the shortfall: 3 - 5 = -2
		const result = getInvestorPayout(gameState, 'France', 'Alice');
		expect(result).toEqual([
			['Alice', -2],
			['Bob', 2],
		]);
	});
});

// ---------------------------------------------------------------------------
// getStockBelow
// ---------------------------------------------------------------------------
describe('getStockBelow', () => {
	// Standard stock costs: index 0=$0, 1=$2, 2=$4, 3=$6, 4=$9, 5=$12
	const STOCK_COSTS = [0, 2, 4, 6, 9, 12];

	beforeEach(() => {
		mockDbData = {};
		clearCache();
		jest.clearAllMocks();
	});

	function setupMockDb(availStock) {
		mockDbData = {
			games: {
				testGame: {
					setup: 'setups/standard',
				},
			},
			setups: {
				standard: {
					stockCosts: STOCK_COSTS,
				},
			},
		};
	}

	test('returns the highest stock index affordable at the given price', async () => {
		setupMockDb();
		const context = { game: 'testGame' };
		const countryInfo = { availStock: [1, 2, 3, 4, 5] };
		// price=6 -> stockCosts[3]=6 is affordable, stockCosts[4]=9 is not
		const result = await getStockBelow(6, countryInfo, context);
		expect(result).toBe(3);
	});

	test('returns 0 when price is below the cheapest stock cost', async () => {
		setupMockDb();
		const context = { game: 'testGame' };
		const countryInfo = { availStock: [1, 2, 3, 4, 5] };
		// price=1 < stockCosts[1]=2
		const result = await getStockBelow(1, countryInfo, context);
		expect(result).toBe(0);
	});

	test('returns highest available stock when price covers all costs', async () => {
		setupMockDb();
		const context = { game: 'testGame' };
		const countryInfo = { availStock: [1, 2, 3, 4, 5] };
		// price=100 covers everything, highest available stock = 5
		const result = await getStockBelow(100, countryInfo, context);
		expect(result).toBe(5);
	});

	test('skips unavailable stock and walks down to a lower available one', async () => {
		// Stock 4 and 5 are not available; best affordable at price=10 would be 4 (cost=9)
		// but 4 is not available, so walk down to 3
		setupMockDb();
		const context = { game: 'testGame' };
		const countryInfo = { availStock: [1, 2, 3] };
		// price=10 -> stockCosts[4]=9 is affordable, but 4 not in availStock
		// walks down to 3 which is available
		const result = await getStockBelow(10, countryInfo, context);
		expect(result).toBe(3);
	});

	test('returns exact price boundary match', async () => {
		setupMockDb();
		const context = { game: 'testGame' };
		const countryInfo = { availStock: [1, 2, 3, 4, 5] };
		// price=9 -> stockCosts[4]=9 is exactly affordable
		const result = await getStockBelow(9, countryInfo, context);
		expect(result).toBe(4);
	});

	test('returns stock 1 when only stock 1 is available and affordable', async () => {
		setupMockDb();
		const context = { game: 'testGame' };
		const countryInfo = { availStock: [1] };
		// price=5, stockCosts[1]=2 is affordable, stocks 2+ not available
		const result = await getStockBelow(5, countryInfo, context);
		expect(result).toBe(1);
	});

	test('handles price exactly at cheapest stock cost', async () => {
		setupMockDb();
		const context = { game: 'testGame' };
		const countryInfo = { availStock: [1, 2, 3, 4, 5] };
		// price=2 -> stockCosts[1]=2 is exactly affordable
		const result = await getStockBelow(2, countryInfo, context);
		expect(result).toBe(1);
	});

	test('walks down past multiple unavailable stocks', async () => {
		// Only stock 1 and 2 available, price covers up to stock 5
		setupMockDb();
		const context = { game: 'testGame' };
		const countryInfo = { availStock: [1, 2] };
		// price=12 -> stockCosts[5]=12 is affordable, but 5,4,3 not available
		// walks down to 2 which is available
		const result = await getStockBelow(12, countryInfo, context);
		expect(result).toBe(2);
	});

	test('returns price just below next tier', async () => {
		setupMockDb();
		const context = { game: 'testGame' };
		const countryInfo = { availStock: [1, 2, 3, 4, 5] };
		// price=8 -> stockCosts[3]=6 is affordable, stockCosts[4]=9 is not
		const result = await getStockBelow(8, countryInfo, context);
		expect(result).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// investorPassed
// ---------------------------------------------------------------------------
describe('investorPassed', () => {
	// Standard wheel layout (8 positions):
	// 0: Factory, 1: L-Produce, 2: L-Maneuver, 3: Taxation,
	// 4: R-Produce, 5: Investor, 6: Import, 7: R-Maneuver
	const WHEEL = ['Factory', 'L-Produce', 'L-Maneuver', 'Taxation', 'R-Produce', 'Investor', 'Import', 'R-Maneuver'];

	const ctx = { game: 'g1' };

	function setMockWheel(wheel) {
		mockDbData = {
			games: {
				g1: {
					setup: 'setups/standard',
				},
			},
			setups: {
				standard: {
					wheel: wheel || WHEEL,
				},
			},
		};
	}

	beforeEach(() => {
		mockDbData = {};
		clearCache();
	});

	// -- "center" starting position -----------------------------------------

	test('returns true when starting from center and landing on Investor', async () => {
		setMockWheel();
		const result = await investorPassed('center', 'Investor', ctx);
		expect(result).toBe(true);
	});

	test('returns false when starting from center and landing on any non-Investor spot', async () => {
		for (const spot of WHEEL) {
			if (spot === 'Investor') continue;
			setMockWheel();
			clearCache();
			const result = await investorPassed('center', spot, ctx);
			expect(result).toBe(false);
		}
	});

	// -- Landing exactly on Investor ----------------------------------------

	test('returns true when moving clockwise and landing exactly on Investor', async () => {
		// From R-Produce (index 4) to Investor (index 5): 1 step forward
		setMockWheel();
		const result = await investorPassed('R-Produce', 'Investor', ctx);
		expect(result).toBe(true);
	});

	test('returns true when landing on Investor from several spots away', async () => {
		// From Factory (index 0) to Investor (index 5): 5 steps forward
		setMockWheel();
		const result = await investorPassed('Factory', 'Investor', ctx);
		expect(result).toBe(true);
	});

	test('returns true when wrapping around the wheel to land on Investor', async () => {
		// From R-Maneuver (index 7) to Investor (index 5): 6 steps clockwise
		setMockWheel();
		const result = await investorPassed('R-Maneuver', 'Investor', ctx);
		expect(result).toBe(true);
	});

	// -- Passing through Investor (landing past it) -------------------------

	test('returns true when move passes through Investor without landing on it', async () => {
		// From R-Produce (index 4) to Import (index 6): passes Investor (index 5)
		setMockWheel();
		const result = await investorPassed('R-Produce', 'Import', ctx);
		expect(result).toBe(true);
	});

	test('returns true when move from Factory to Import passes Investor', async () => {
		// From Factory (index 0) to Import (index 6): 6 steps, passes Investor at step 5
		setMockWheel();
		const result = await investorPassed('Factory', 'Import', ctx);
		expect(result).toBe(true);
	});

	test('returns true when move from Factory to R-Maneuver passes Investor', async () => {
		// From Factory (index 0) to R-Maneuver (index 7): 7 steps, passes Investor at step 5
		setMockWheel();
		const result = await investorPassed('Factory', 'R-Maneuver', ctx);
		expect(result).toBe(true);
	});

	test('returns true when move from Taxation to Import passes Investor', async () => {
		// From Taxation (index 3) to Import (index 6): 3 steps, passes Investor at step 2
		setMockWheel();
		const result = await investorPassed('Taxation', 'Import', ctx);
		expect(result).toBe(true);
	});

	// -- NOT passing Investor -----------------------------------------------

	test('returns false when move stays before Investor on the wheel', async () => {
		// From Factory (index 0) to Taxation (index 3): 3 steps, Investor is at step 5
		setMockWheel();
		const result = await investorPassed('Factory', 'Taxation', ctx);
		expect(result).toBe(false);
	});

	test('returns false when move is 1 step before Investor', async () => {
		// From Factory (index 0) to R-Produce (index 4): 4 steps, Investor is at step 5
		setMockWheel();
		const result = await investorPassed('Factory', 'R-Produce', ctx);
		expect(result).toBe(false);
	});

	test('returns false when moving just past Investor position to a spot before next Investor', async () => {
		// From Import (index 6) to Factory (index 0): 2 steps clockwise, Investor is 7 steps away
		setMockWheel();
		const result = await investorPassed('Import', 'Factory', ctx);
		expect(result).toBe(false);
	});

	test('returns false when wrapping around without reaching Investor', async () => {
		// From Import (index 6) to R-Produce (index 4): 6 steps clockwise
		// Investor (index 5) is 7 steps away from Import. 6 < 7 -> false
		setMockWheel();
		const result = await investorPassed('Import', 'R-Produce', ctx);
		expect(result).toBe(false);
	});

	test('returns false when moving from Import to L-Maneuver without passing Investor', async () => {
		// From Import (index 6) to L-Maneuver (index 2): 4 steps, Investor is 7 steps away
		setMockWheel();
		const result = await investorPassed('Import', 'L-Maneuver', ctx);
		expect(result).toBe(false);
	});

	// -- Starting on Investor -----------------------------------------------

	test('returns false when starting on Investor (inv === o)', async () => {
		// From Investor (index 5) to Import (index 6): moving 1 step
		// The condition requires inv !== o, so this is false
		setMockWheel();
		const result = await investorPassed('Investor', 'Import', ctx);
		expect(result).toBe(false);
	});

	test('returns false when starting on Investor and wrapping around', async () => {
		// From Investor (index 5) to R-Produce (index 4): 7 steps clockwise
		// inv === o, so false regardless
		setMockWheel();
		const result = await investorPassed('Investor', 'R-Produce', ctx);
		expect(result).toBe(false);
	});

	// -- Short moves (1-step) -----------------------------------------------

	test('returns false for single-step move that does not reach Investor', async () => {
		// From Factory (index 0) to L-Produce (index 1): 1 step, Investor at step 5
		setMockWheel();
		const result = await investorPassed('Factory', 'L-Produce', ctx);
		expect(result).toBe(false);
	});

	test('returns true for single-step move that lands on Investor', async () => {
		// From R-Produce (index 4) to Investor (index 5): exactly 1 step
		setMockWheel();
		const result = await investorPassed('R-Produce', 'Investor', ctx);
		expect(result).toBe(true);
	});

	// -- Comprehensive traversal: every starting position -------------------

	test('from L-Produce: passing Investor requires reaching index 5+', async () => {
		setMockWheel();
		// L-Produce (1) to R-Produce (4): 3 steps, Investor at 4 steps -> false
		expect(await investorPassed('L-Produce', 'R-Produce', ctx)).toBe(false);
		clearCache();
		setMockWheel();
		// L-Produce (1) to Investor (5): 4 steps = exactly Investor -> true
		expect(await investorPassed('L-Produce', 'Investor', ctx)).toBe(true);
		clearCache();
		setMockWheel();
		// L-Produce (1) to Import (6): 5 steps, passes Investor -> true
		expect(await investorPassed('L-Produce', 'Import', ctx)).toBe(true);
	});

	test('from L-Maneuver: passing Investor requires reaching index 5+', async () => {
		setMockWheel();
		// L-Maneuver (2) to Taxation (3): 1 step, Investor at 3 steps -> false
		expect(await investorPassed('L-Maneuver', 'Taxation', ctx)).toBe(false);
		clearCache();
		setMockWheel();
		// L-Maneuver (2) to Investor (5): 3 steps = exactly Investor -> true
		expect(await investorPassed('L-Maneuver', 'Investor', ctx)).toBe(true);
		clearCache();
		setMockWheel();
		// L-Maneuver (2) to R-Maneuver (7): 5 steps, passes Investor -> true
		expect(await investorPassed('L-Maneuver', 'R-Maneuver', ctx)).toBe(true);
	});

	test('from Taxation: passing Investor requires reaching index 5+', async () => {
		setMockWheel();
		// Taxation (3) to R-Produce (4): 1 step, Investor at 2 steps -> false
		expect(await investorPassed('Taxation', 'R-Produce', ctx)).toBe(false);
		clearCache();
		setMockWheel();
		// Taxation (3) to Investor (5): 2 steps = exactly Investor -> true
		expect(await investorPassed('Taxation', 'Investor', ctx)).toBe(true);
		clearCache();
		setMockWheel();
		// Taxation (3) to R-Maneuver (7): 4 steps, passes Investor -> true
		expect(await investorPassed('Taxation', 'R-Maneuver', ctx)).toBe(true);
	});

	test('from R-Maneuver: wraps around, Investor is 6 steps clockwise', async () => {
		setMockWheel();
		// R-Maneuver (7) to L-Produce (1): 2 steps, Investor at 6 steps -> false
		expect(await investorPassed('R-Maneuver', 'L-Produce', ctx)).toBe(false);
		clearCache();
		setMockWheel();
		// R-Maneuver (7) to R-Produce (4): 5 steps, Investor at 6 steps -> false
		expect(await investorPassed('R-Maneuver', 'R-Produce', ctx)).toBe(false);
		clearCache();
		setMockWheel();
		// R-Maneuver (7) to Investor (5): 6 steps = exactly Investor -> true
		expect(await investorPassed('R-Maneuver', 'Investor', ctx)).toBe(true);
		clearCache();
		setMockWheel();
		// R-Maneuver (7) to Import (6): 7 steps, passes Investor -> true
		expect(await investorPassed('R-Maneuver', 'Import', ctx)).toBe(true);
	});

	test('from Import: wraps around, Investor is 7 steps clockwise', async () => {
		setMockWheel();
		// Import (6) to R-Maneuver (7): 1 step, Investor at 7 steps -> false
		expect(await investorPassed('Import', 'R-Maneuver', ctx)).toBe(false);
		clearCache();
		setMockWheel();
		// Import (6) to Taxation (3): 5 steps, Investor at 7 steps -> false
		expect(await investorPassed('Import', 'Taxation', ctx)).toBe(false);
		clearCache();
		setMockWheel();
		// Import (6) to Investor (5): 7 steps = exactly Investor (full wrap) -> true
		expect(await investorPassed('Import', 'Investor', ctx)).toBe(true);
	});

	// -- Different wheel configuration (non-standard) -----------------------

	test('works with a different wheel where Investor is at a different position', async () => {
		// Custom 4-position wheel: Investor at index 1
		const customWheel = ['Factory', 'Investor', 'Taxation', 'Import'];
		setMockWheel(customWheel);
		// From Factory (0) to Taxation (2): 2 steps, Investor at 1 step -> passes
		expect(await investorPassed('Factory', 'Taxation', ctx)).toBe(true);
		clearCache();
		setMockWheel(customWheel);
		// From Taxation (2) to Factory (0): 2 steps, Investor at 3 steps -> does not pass
		expect(await investorPassed('Taxation', 'Factory', ctx)).toBe(false);
		clearCache();
		setMockWheel(customWheel);
		// From Import (3) to Investor (1): 2 steps = exactly Investor -> true
		expect(await investorPassed('Import', 'Investor', ctx)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getTaxInfo
// ---------------------------------------------------------------------------
describe('getTaxInfo', () => {
	// Helper to build a minimal countryInfo for a single country under test.
	// Defaults: 0 money, no units, no taxChips, no factories, lastTax = 0.
	function makeCountryInfo(overrides = {}) {
		const country = {
			money: 0,
			fleets: [],
			armies: [],
			taxChips: [],
			factories: [],
			lastTax: 0,
			leadership: ['Alice'],
			...overrides,
		};
		return { TestCountry: country };
	}

	test('basic tax calculation: taxChips + 2 * unsaturated factories', async () => {
		// 3 taxChips + 2 factories (unsaturated) => raw points = 3 + 2*2 = 7
		// No units => money = 7 - 0 = 7
		// points returned = max(7 - 5, 0) = 2
		const countryInfo = makeCountryInfo({
			money: 20,
			taxChips: ['A', 'B', 'C'],
			factories: ['Paris', 'Lyon'],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(2);
		// playerMoney = min(max(7 - 0, 0), 20 + 7) = min(7, 27) = 7
		// money = 7 - 7 = 0
		expect(result.money).toBe(0);
	});

	test('treasury deficit: country cannot afford to pay full unit costs', async () => {
		// 2 taxChips + 1 factory => raw points = 2 + 2*1 = 4
		// 5 armies => money = 4 - 5 = -1, but treasury only has 0
		// so money = 0 - 0 = 0 (clamped so treasury doesn't go negative)
		const countryInfo = makeCountryInfo({
			money: 0,
			taxChips: ['A', 'B'],
			factories: ['Paris'],
			armies: [
				{ territory: 'X1', hostile: false },
				{ territory: 'X2', hostile: false },
				{ territory: 'X3', hostile: false },
				{ territory: 'X4', hostile: false },
				{ territory: 'X5', hostile: false },
			],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		// points = max(4 - 5, 0) = 0 (below the floor)
		expect(result.points).toBe(0);
		// money capped: countryMoney(0) + money(-1) < 0, so money = 0 - 0 = 0
		expect(result.money).toBe(0);
	});

	test('treasury deficit with some money: partial payment', async () => {
		// 1 taxChip + 0 factories => raw points = 1
		// 4 units => money = 1 - 4 = -3, treasury has 2
		// countryMoney(2) + money(-3) = -1 < 0, so money = -2 (drains treasury to 0)
		const countryInfo = makeCountryInfo({
			money: 2,
			taxChips: ['A'],
			factories: [],
			armies: [
				{ territory: 'X1', hostile: false },
				{ territory: 'X2', hostile: false },
			],
			fleets: [{ territory: 'S1' }, { territory: 'S2' }],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(0); // max(1 - 5, 0) = 0
		// money = -2 (drains treasury completely)
		// playerMoney = min(max(1 - 0, 0), 2 + (-2)) = min(1, 0) = 0
		// ans.money = -2 - 0 = -2
		expect(result.money).toBe(-2);
	});

	test('floor at 5: raw points below 5 yield 0 victory points', async () => {
		// 2 taxChips + 1 factory => raw points = 2 + 2 = 4
		// points returned = max(4 - 5, 0) = 0
		const countryInfo = makeCountryInfo({
			money: 10,
			taxChips: ['A', 'B'],
			factories: ['Paris'],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(0);
	});

	test('floor at 5: exactly 5 raw points yields 0 victory points', async () => {
		// 5 taxChips + 0 factories => raw points = 5
		// points returned = max(5 - 5, 0) = 0
		const countryInfo = makeCountryInfo({
			money: 10,
			taxChips: ['A', 'B', 'C', 'D', 'E'],
			factories: [],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(0);
	});

	test('floor at 5: 6 raw points yields 1 victory point', async () => {
		// 6 taxChips => raw points = 6
		// points returned = max(6 - 5, 0) = 1
		const countryInfo = makeCountryInfo({
			money: 10,
			taxChips: ['A', 'B', 'C', 'D', 'E', 'F'],
			factories: [],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(1);
	});

	test('MAX_TAX_POINTS cap of 15: raw points capped at 15', async () => {
		// 10 taxChips + 4 factories => raw = 10 + 8 = 18, capped to 15
		// points returned = max(15 - 5, 0) = 10
		const countryInfo = makeCountryInfo({
			money: 30,
			taxChips: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
			factories: ['F1', 'F2', 'F3', 'F4'],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(10);
	});

	test('MAX_TAX_POINTS cap: exactly 15 raw points is not further capped', async () => {
		// 5 taxChips + 5 factories => raw = 5 + 10 = 15, exactly at cap
		// points returned = max(15 - 5, 0) = 10
		const countryInfo = makeCountryInfo({
			money: 30,
			taxChips: ['A', 'B', 'C', 'D', 'E'],
			factories: ['F1', 'F2', 'F3', 'F4', 'F5'],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(10);
	});

	test('edge case: zero taxChips and zero factories', async () => {
		// raw points = 0 + 0 = 0
		// points returned = max(0 - 5, 0) = 0
		// money = 0 - 0 units = 0
		const countryInfo = makeCountryInfo({
			money: 10,
			taxChips: [],
			factories: [],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(0);
		// playerMoney = min(max(0 - 0, 0), 10 + 0) = 0
		// ans.money = 0 - 0 = 0
		expect(result.money).toBe(0);
	});

	test('edge case: all factories saturated by hostile enemy armies', async () => {
		// 3 taxChips, 2 factories both sat on by Germany's hostile armies
		// unsatFactories = 0
		// raw points = 3 + 2*0 = 3
		// points returned = max(3 - 5, 0) = 0
		const countryInfo = {
			TestCountry: {
				money: 10,
				fleets: [],
				armies: [],
				taxChips: ['A', 'B', 'C'],
				factories: ['Paris', 'Lyon'],
				lastTax: 0,
				leadership: ['Alice'],
			},
			Germany: {
				armies: [
					{ territory: 'Paris', hostile: true },
					{ territory: 'Lyon', hostile: true },
				],
			},
		};
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(0);
	});

	test('edge case: some factories saturated, some not', async () => {
		// 2 taxChips, 3 factories but 1 is sat on
		// unsatFactories = 2
		// raw points = 2 + 2*2 = 6
		// points returned = max(6 - 5, 0) = 1
		const countryInfo = {
			TestCountry: {
				money: 10,
				fleets: [],
				armies: [],
				taxChips: ['A', 'B'],
				factories: ['Paris', 'Lyon', 'Marseille'],
				lastTax: 0,
				leadership: ['Alice'],
			},
			Germany: {
				armies: [{ territory: 'Lyon', hostile: true }],
			},
		};
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(1);
	});

	test('multiple unsaturated factories contribute 2 points each', async () => {
		// 0 taxChips + 4 factories (all unsaturated) => raw points = 0 + 2*4 = 8
		// points returned = max(8 - 5, 0) = 3
		const countryInfo = makeCountryInfo({
			money: 20,
			taxChips: [],
			factories: ['F1', 'F2', 'F3', 'F4'],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(3);
	});

	test('money accounts for unit maintenance costs', async () => {
		// 4 taxChips + 1 factory => raw points = 4 + 2 = 6
		// 3 units (2 armies + 1 fleet) => money = 6 - 3 = 3
		const countryInfo = makeCountryInfo({
			money: 10,
			taxChips: ['A', 'B', 'C', 'D'],
			factories: ['Paris'],
			armies: [
				{ territory: 'X1', hostile: false },
				{ territory: 'X2', hostile: false },
			],
			fleets: [{ territory: 'S1' }],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(1); // max(6 - 5, 0) = 1
		// playerMoney = min(max(6 - 0, 0), 10 + 3) = min(6, 13) = 6
		// ans.money = 3 - 6 = -3
		expect(result.money).toBe(-3);
	});

	test('lastTax threshold limits player payout (greatness)', async () => {
		// 4 taxChips + 2 factories => raw points = 4 + 4 = 8
		// money = 8 - 0 = 8
		// lastTax = 6, so playerMoney = min(max(8 - 6, 0), 10 + 8) = min(2, 18) = 2
		// ans.money = 8 - 2 = 6 (treasury keeps 6)
		const countryInfo = makeCountryInfo({
			money: 10,
			taxChips: ['A', 'B', 'C', 'D'],
			factories: ['Paris', 'Lyon'],
			lastTax: 6,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(3); // max(8 - 5, 0) = 3
		expect(result.money).toBe(6);
	});

	test('lastTax equal to raw points means zero player payout', async () => {
		// 3 taxChips + 1 factory => raw points = 3 + 2 = 5
		// lastTax = 5, so playerMoney = min(max(5 - 5, 0), ...) = 0
		// money = 5 - 0 = 5 (no units)
		// ans.money = 5 - 0 = 5
		const countryInfo = makeCountryInfo({
			money: 10,
			taxChips: ['A', 'B', 'C'],
			factories: ['Paris'],
			lastTax: 5,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(0); // max(5 - 5, 0) = 0
		expect(result.money).toBe(5);
	});

	test('lastTax above raw points means zero player payout', async () => {
		// 3 taxChips + 0 factories => raw points = 3
		// lastTax = 10 (much higher), so playerMoney = min(max(3 - 10, 0), ...) = 0
		const countryInfo = makeCountryInfo({
			money: 10,
			taxChips: ['A', 'B', 'C'],
			factories: [],
			lastTax: 10,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(0);
		// money = 3 - 0 units = 3
		// playerMoney = 0
		// ans.money = 3 - 0 = 3
		expect(result.money).toBe(3);
	});

	test('tax split is computed when playerInfo is provided', async () => {
		// 5 taxChips + 1 factory => raw points = 5 + 2 = 7
		// 0 units => money = 7
		// lastTax = 0, so playerMoney = min(max(7 - 0, 0), 10 + 7) = 7
		// tax split should distribute 7 between Alice (stock 3) and Bob (stock 4)
		const countryInfo = {
			TestCountry: {
				money: 10,
				fleets: [],
				armies: [],
				taxChips: ['A', 'B', 'C', 'D', 'E'],
				factories: ['Paris'],
				lastTax: 0,
				leadership: ['Alice', 'Bob'],
			},
		};
		const playerInfo = {
			Alice: { stock: [{ country: 'TestCountry', stock: 3 }] },
			Bob: { stock: [{ country: 'TestCountry', stock: 4 }] },
		};
		const result = await getTaxInfo(countryInfo, playerInfo, 'TestCountry');
		expect(result.points).toBe(2); // max(7 - 5, 0) = 2
		expect(result['tax split']).toBeDefined();
		// Total distributed should equal playerMoney (7)
		const totalDistributed = result['tax split'].reduce((sum, entry) => sum + entry[1], 0);
		expect(totalDistributed).toBe(7);
	});

	test('tax split is not computed when playerInfo is null', async () => {
		const countryInfo = makeCountryInfo({
			money: 10,
			taxChips: ['A', 'B', 'C'],
			factories: ['Paris'],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result['tax split']).toBeUndefined();
	});

	test('missing taxChips and fleets/armies fields default to empty', async () => {
		// getTaxInfo uses (countryInfo[country].taxChips || []) etc.
		const countryInfo = {
			TestCountry: {
				money: 5,
				factories: ['F1'],
				lastTax: 0,
				leadership: ['Alice'],
			},
		};
		// raw points = 0 + 2*1 = 2, no units
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(0); // max(2 - 5, 0) = 0
		// money = 2 - 0 = 2
		// playerMoney = min(max(2 - 0, 0), 5 + 2) = 2
		// ans.money = 2 - 2 = 0
		expect(result.money).toBe(0);
	});

	test('player payout capped by available treasury after unit costs', async () => {
		// 8 taxChips + 0 factories => raw points = 8
		// 6 units => money = 8 - 6 = 2
		// countryMoney = 1, so treasury after = 1 + 2 = 3
		// lastTax = 0, playerMoney = min(max(8 - 0, 0), 1 + 2) = min(8, 3) = 3
		// ans.money = 2 - 3 = -1
		const countryInfo = makeCountryInfo({
			money: 1,
			taxChips: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
			factories: [],
			armies: [
				{ territory: 'X1', hostile: false },
				{ territory: 'X2', hostile: false },
				{ territory: 'X3', hostile: false },
			],
			fleets: [{ territory: 'S1' }, { territory: 'S2' }, { territory: 'S3' }],
			lastTax: 0,
		});
		const result = await getTaxInfo(countryInfo, null, 'TestCountry');
		expect(result.points).toBe(3); // max(8 - 5, 0) = 3
		expect(result.money).toBe(-1);
	});
});
