// ---------------------------------------------------------------------------
// turnAPI.test.js — Tests for all 6 exported functions in turnAPI.js
// ---------------------------------------------------------------------------

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
			on: jest.fn(),
			off: jest.fn(),
		})),
	},
}));

// ---- Mock helper.js -------------------------------------------------------
jest.mock('./helper.js', () => ({
	getStockBelow: jest.fn(() => Promise.resolve(3)),
	getWinner: jest.fn(() => 'Alice'),
}));

// ---- Imports (must come after jest.mock calls) ----------------------------
import { getTitle, getTurnTitle, getMode, getTurnID, undoable, getMyTurn } from './turnAPI.js';
import { clearCache } from './stateCache.js';
import * as helper from './helper.js';

// ---- Reset state before each test ----------------------------------------
beforeEach(() => {
	mockDbData = {};
	clearCache();
	jest.clearAllMocks();
});

// ===========================================================================
// getTitle
// ===========================================================================
describe('getTitle', () => {
	function buildGameState(mode, countryUp, playerInfo, countryInfo) {
		return {
			games: {
				g1: {
					mode,
					countryUp,
					playerInfo: playerInfo || { Alice: { myTurn: true } },
					countryInfo: countryInfo || {},
				},
			},
		};
	}

	const ctx = { game: 'g1', name: 'Alice' };

	test('bid mode: returns "{player} up with bidding on {country}."', async () => {
		mockDbData = buildGameState('bid', 'Austria');
		const result = await getTitle(ctx);
		expect(result).toBe('Alice up with bidding on Austria.');
	});

	test('buy-bid mode: calls helper.getStockBelow and returns "deciding on buying the {country} {stock}."', async () => {
		mockDbData = buildGameState('buy-bid', 'France', { Alice: { myTurn: true, bid: 5 } }, { France: { treasury: 10 } });
		helper.getStockBelow.mockResolvedValue(3);

		const result = await getTitle(ctx);

		expect(helper.getStockBelow).toHaveBeenCalledWith(5, { treasury: 10 }, ctx);
		expect(result).toBe('Alice up with deciding on buying the France 3.');
	});

	test('buy mode: returns "{player} up with a buy on {country} investor."', async () => {
		mockDbData = buildGameState('buy', 'Italy');
		const result = await getTitle(ctx);
		expect(result).toBe('Alice up with a buy on Italy investor.');
	});

	test('proposal mode with dictatorship: returns "{player} up with {country} as autocratic leader."', async () => {
		mockDbData = buildGameState(
			'proposal',
			'Germany',
			{ Alice: { myTurn: true } },
			{ Germany: { gov: 'dictatorship' } }
		);
		const result = await getTitle(ctx);
		expect(result).toBe('Alice up with Germany as autocratic leader.');
	});

	test('proposal mode with democracy: returns "{player} up with {country} as democratic leader."', async () => {
		mockDbData = buildGameState('proposal', 'England', { Alice: { myTurn: true } }, { England: { gov: 'democracy' } });
		const result = await getTitle(ctx);
		expect(result).toBe('Alice up with England as democratic leader.');
	});

	test('proposal-opp mode: returns "{player} up with {country} as democratic opposition."', async () => {
		mockDbData = buildGameState('proposal-opp', 'Russia');
		const result = await getTitle(ctx);
		expect(result).toBe('Alice up with Russia as democratic opposition.');
	});

	test('vote mode: returns "{player} up with votes."', async () => {
		mockDbData = buildGameState('vote', 'Austria');
		const result = await getTitle(ctx);
		expect(result).toBe('Alice up with votes.');
	});

	test('continue-man mode: returns "{player} up with continuing the {country} maneuver."', async () => {
		mockDbData = buildGameState('continue-man', 'France');
		const result = await getTitle(ctx);
		expect(result).toBe('Alice up with continuing the France maneuver.');
	});

	test('game-over mode: calls helper.getWinner and returns "{winner} has won."', async () => {
		helper.getWinner.mockReturnValue('Alice');
		mockDbData = buildGameState('game-over', 'Austria');
		const result = await getTitle(ctx);
		expect(helper.getWinner).toHaveBeenCalled();
		expect(result).toBe('Alice has won.');
	});

	test('game-over mode: returns correct winner name from helper', async () => {
		helper.getWinner.mockReturnValue('Bob');
		mockDbData = buildGameState('game-over', 'Austria', { Bob: { myTurn: true } });
		const result = await getTitle(ctx);
		expect(result).toBe('Bob has won.');
	});

	test('multiple players with myTurn true: joins names with comma', async () => {
		mockDbData = buildGameState('vote', 'Austria', {
			Alice: { myTurn: true },
			Bob: { myTurn: true },
			Charlie: { myTurn: true },
		});
		const result = await getTitle(ctx);
		expect(result).toBe('Alice, Bob, Charlie up with votes.');
	});

	test('multiple players but only some with myTurn true: only includes active players', async () => {
		mockDbData = buildGameState('bid', 'Italy', {
			Alice: { myTurn: true },
			Bob: { myTurn: false },
			Charlie: { myTurn: true },
		});
		const result = await getTitle(ctx);
		expect(result).toBe('Alice, Charlie up with bidding on Italy.');
	});

	test('no players with myTurn true: returns " up with ..." (empty player list)', async () => {
		mockDbData = buildGameState('bid', 'Austria', {
			Alice: { myTurn: false },
			Bob: { myTurn: false },
		});
		const result = await getTitle(ctx);
		expect(result).toBe(' up with bidding on Austria.');
	});

	test('default/unknown mode: returns player string with " up with " and no suffix', async () => {
		mockDbData = buildGameState('some-unknown-mode', 'Austria');
		const result = await getTitle(ctx);
		expect(result).toBe('Alice up with ');
	});
});

// ===========================================================================
// getTurnTitle
// ===========================================================================
describe('getTurnTitle', () => {
	test('player in game with myTurn true: returns "Take Your Turn."', async () => {
		mockDbData = {
			games: {
				g1: {
					playerInfo: {
						Alice: { myTurn: true },
						Bob: { myTurn: false },
					},
				},
			},
		};
		const result = await getTurnTitle({ game: 'g1', name: 'Alice' });
		expect(result).toBe('Take Your Turn.');
	});

	test('player in game with myTurn false: returns "Not Your Turn."', async () => {
		mockDbData = {
			games: {
				g1: {
					playerInfo: {
						Alice: { myTurn: false },
						Bob: { myTurn: true },
					},
				},
			},
		};
		const result = await getTurnTitle({ game: 'g1', name: 'Alice' });
		expect(result).toBe('Not Your Turn.');
	});

	test('player not in game: returns "Log in as a player to take your turn."', async () => {
		mockDbData = {
			games: {
				g1: {
					playerInfo: {
						Alice: { myTurn: true },
						Bob: { myTurn: false },
					},
				},
			},
		};
		const result = await getTurnTitle({ game: 'g1', name: 'Charlie' });
		expect(result).toBe('Log in as a player to take your turn.');
	});

	test('player with myTurn null: returns "Not Your Turn."', async () => {
		mockDbData = {
			games: {
				g1: {
					playerInfo: {
						Alice: { myTurn: null },
					},
				},
			},
		};
		const result = await getTurnTitle({ game: 'g1', name: 'Alice' });
		expect(result).toBe('Not Your Turn.');
	});
});

// ===========================================================================
// getMode
// ===========================================================================
describe('getMode', () => {
	test("player's turn: returns the current mode", async () => {
		mockDbData = {
			games: {
				g1: {
					mode: 'proposal',
					playerInfo: {
						Alice: { myTurn: true },
					},
				},
			},
		};
		const result = await getMode({ game: 'g1', name: 'Alice' });
		expect(result).toBe('proposal');
	});

	test("not player's turn: returns 'non-turn'", async () => {
		mockDbData = {
			games: {
				g1: {
					mode: 'proposal',
					playerInfo: {
						Alice: { myTurn: false },
					},
				},
			},
		};
		const result = await getMode({ game: 'g1', name: 'Alice' });
		expect(result).toBe('non-turn');
	});

	test("no player name in context: returns 'non-turn'", async () => {
		mockDbData = {
			games: {
				g1: {
					mode: 'bid',
					playerInfo: {
						Alice: { myTurn: true },
					},
				},
			},
		};
		const result = await getMode({ game: 'g1', name: '' });
		expect(result).toBe('non-turn');
	});

	test("null player name in context: returns 'non-turn'", async () => {
		mockDbData = {
			games: {
				g1: {
					mode: 'bid',
					playerInfo: {},
				},
			},
		};
		const result = await getMode({ game: 'g1', name: null });
		expect(result).toBe('non-turn');
	});

	test("undefined player name in context: returns 'non-turn'", async () => {
		mockDbData = {
			games: {
				g1: {
					mode: 'vote',
					playerInfo: {},
				},
			},
		};
		const result = await getMode({ game: 'g1', name: undefined });
		expect(result).toBe('non-turn');
	});

	test('returns each mode correctly when it is the players turn', async () => {
		const modes = ['bid', 'buy-bid', 'buy', 'proposal', 'proposal-opp', 'vote', 'continue-man', 'game-over'];
		for (const mode of modes) {
			clearCache(); // Clear cache so each iteration reads fresh mock data
			mockDbData = {
				games: {
					g1: {
						mode,
						playerInfo: {
							Alice: { myTurn: true },
						},
					},
				},
			};
			const result = await getMode({ game: 'g1', name: 'Alice' });
			expect(result).toBe(mode);
		}
	});
});

// ===========================================================================
// getTurnID
// ===========================================================================
describe('getTurnID', () => {
	test('returns the turnID from Firebase', async () => {
		mockDbData = {
			games: {
				g1: {
					turnID: 42,
				},
			},
		};
		const result = await getTurnID({ game: 'g1' });
		expect(result).toBe(42);
	});

	test('returns 0 when turnID is 0', async () => {
		mockDbData = {
			games: {
				g1: {
					turnID: 0,
				},
			},
		};
		const result = await getTurnID({ game: 'g1' });
		expect(result).toBe(0);
	});

	test('returns undefined when turnID does not exist', async () => {
		mockDbData = {
			games: {
				g1: {},
			},
		};
		const result = await getTurnID({ game: 'g1' });
		expect(result).toBeUndefined();
	});

	test('returns a large turnID value', async () => {
		mockDbData = {
			games: {
				g1: {
					turnID: 999,
				},
			},
		};
		const result = await getTurnID({ game: 'g1' });
		expect(result).toBe(999);
	});
});

// ===========================================================================
// undoable
// ===========================================================================
describe('undoable', () => {
	test('undo player matches context.name: returns the name', async () => {
		mockDbData = {
			games: {
				g1: {
					undo: 'Alice',
				},
			},
		};
		const result = await undoable({ game: 'g1', name: 'Alice' });
		expect(result).toBe('Alice');
	});

	test('undo player does not match context.name: returns false', async () => {
		mockDbData = {
			games: {
				g1: {
					undo: 'Bob',
				},
			},
		};
		const result = await undoable({ game: 'g1', name: 'Alice' });
		expect(result).toBe(false);
	});

	test('undo is null: returns false', async () => {
		mockDbData = {
			games: {
				g1: {
					undo: null,
				},
			},
		};
		const result = await undoable({ game: 'g1', name: 'Alice' });
		expect(result).toBe(false);
	});

	test('undo field does not exist in Firebase: returns false', async () => {
		mockDbData = {
			games: {
				g1: {},
			},
		};
		const result = await undoable({ game: 'g1', name: 'Alice' });
		expect(result).toBe(false);
	});

	test('context.name is empty string: returns false even if undo is empty string', async () => {
		mockDbData = {
			games: {
				g1: {
					undo: '',
				},
			},
		};
		const result = await undoable({ game: 'g1', name: '' });
		// '' === '' is true, but '' && '' is '', which is falsy
		expect(result).toBeFalsy();
	});

	test('context.name is null: returns false', async () => {
		mockDbData = {
			games: {
				g1: {
					undo: null,
				},
			},
		};
		const result = await undoable({ game: 'g1', name: null });
		expect(result).toBeFalsy();
	});
});

// ===========================================================================
// getMyTurn
// ===========================================================================
describe('getMyTurn', () => {
	test('player exists with myTurn true: returns true', async () => {
		mockDbData = {
			games: {
				g1: {
					playerInfo: {
						Alice: { myTurn: true },
						Bob: { myTurn: false },
					},
				},
			},
		};
		const result = await getMyTurn({ game: 'g1', name: 'Alice' });
		expect(result).toBe(true);
	});

	test('player exists with myTurn false: returns false', async () => {
		mockDbData = {
			games: {
				g1: {
					playerInfo: {
						Alice: { myTurn: false },
						Bob: { myTurn: true },
					},
				},
			},
		};
		const result = await getMyTurn({ game: 'g1', name: 'Alice' });
		expect(result).toBe(false);
	});

	test('player exists with myTurn undefined: returns undefined', async () => {
		mockDbData = {
			games: {
				g1: {
					playerInfo: {
						Alice: { score: 5 },
					},
				},
			},
		};
		const result = await getMyTurn({ game: 'g1', name: 'Alice' });
		expect(result).toBeUndefined();
	});

	test('no name in context: returns false without calling Firebase', async () => {
		mockDbData = {
			games: {
				g1: {
					playerInfo: {
						Alice: { myTurn: true },
					},
				},
			},
		};
		const { database } = require('./firebase.js');
		database.ref.mockClear();

		const result = await getMyTurn({ game: 'g1', name: '' });
		expect(result).toBe(false);
		expect(database.ref).not.toHaveBeenCalled();
	});

	test('null name in context: returns false without calling Firebase', async () => {
		const { database } = require('./firebase.js');
		database.ref.mockClear();

		const result = await getMyTurn({ game: 'g1', name: null });
		expect(result).toBe(false);
		expect(database.ref).not.toHaveBeenCalled();
	});

	test('no game in context: returns false without calling Firebase', async () => {
		const { database } = require('./firebase.js');
		database.ref.mockClear();

		const result = await getMyTurn({ game: '', name: 'Alice' });
		expect(result).toBe(false);
		expect(database.ref).not.toHaveBeenCalled();
	});

	test('null game in context: returns false without calling Firebase', async () => {
		const { database } = require('./firebase.js');
		database.ref.mockClear();

		const result = await getMyTurn({ game: null, name: 'Alice' });
		expect(result).toBe(false);
		expect(database.ref).not.toHaveBeenCalled();
	});

	test('player not in game: returns undefined (via empty object fallback)', async () => {
		mockDbData = {
			games: {
				g1: {
					playerInfo: {
						Bob: { myTurn: true },
						Charlie: { myTurn: false },
					},
				},
			},
		};
		const result = await getMyTurn({ game: 'g1', name: 'Alice' });
		expect(result).toBeUndefined();
	});

	test('both name and game missing: returns false', async () => {
		const result = await getMyTurn({ game: '', name: '' });
		expect(result).toBe(false);
	});
});
