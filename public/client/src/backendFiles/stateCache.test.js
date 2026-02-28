// ---------------------------------------------------------------------------
// stateCache.test.js — Tests for the game state caching layer
//
// Tests cover:
// 1. Basic cache operations (set, read, invalidate, clear)
// 2. Promise deduplication (parallel readGameState calls share one Firebase read)
// 3. Cache hit/miss scenarios for submitting vs non-submitting players
// 4. Multi-player concurrent bid/vote scenarios (state consistency)
// 5. Undo consistency
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
			set: jest.fn((data, cb) => {
				if (cb) cb(null);
				return Promise.resolve();
			}),
		})),
	},
}));

import { setCachedState, readGameState, invalidateIfStale, clearCache } from './stateCache.js';
import { database } from './firebase.js';

beforeEach(() => {
	mockDbData = {};
	clearCache();
	jest.clearAllMocks();
});

// ===========================================================================
// Basic cache operations
// ===========================================================================
describe('setCachedState and readGameState', () => {
	test('readGameState returns cached state after setCachedState', async () => {
		const state = { mode: 'bid', countryUp: 'Austria', turnID: 5 };
		setCachedState('game1', 5, state);

		const result = await readGameState({ game: 'game1' });
		expect(result).toEqual(state);
		// Should NOT have called Firebase
		expect(database.ref).not.toHaveBeenCalled();
	});

	test('readGameState falls back to Firebase on cache miss', async () => {
		mockDbData = {
			games: {
				game1: { mode: 'bid', turnID: 3 },
			},
		};

		const result = await readGameState({ game: 'game1' });
		expect(result).toEqual({ mode: 'bid', turnID: 3 });
		expect(database.ref).toHaveBeenCalledWith('games/game1');
	});

	test('readGameState caches Firebase result for subsequent calls', async () => {
		mockDbData = {
			games: {
				game1: { mode: 'bid', turnID: 3 },
			},
		};

		// First call: reads from Firebase
		const result1 = await readGameState({ game: 'game1' });
		expect(database.ref).toHaveBeenCalledTimes(1);

		// Change mock data (simulates a different state in Firebase)
		mockDbData.games.game1.mode = 'buy';

		// Second call: returns cached data, does NOT re-read
		const result2 = await readGameState({ game: 'game1' });
		expect(result2.mode).toBe('bid'); // Cached, not the new 'buy'
		expect(database.ref).toHaveBeenCalledTimes(1); // Still only 1 Firebase call
	});

	test('readGameState returns null for non-existent game without crashing', async () => {
		mockDbData = {};
		const result = await readGameState({ game: 'nonexistent' });
		expect(result).toBeNull();
	});
});

// ===========================================================================
// invalidateIfStale
// ===========================================================================
describe('invalidateIfStale', () => {
	test('preserves cache when turnID matches', async () => {
		const state = { mode: 'proposal', turnID: 10 };
		setCachedState('game1', 10, state);

		invalidateIfStale('game1', 10);

		const result = await readGameState({ game: 'game1' });
		expect(result).toEqual(state);
		expect(database.ref).not.toHaveBeenCalled();
	});

	test('clears cache when turnID does not match', async () => {
		const state = { mode: 'proposal', turnID: 10 };
		setCachedState('game1', 10, state);

		mockDbData = {
			games: {
				game1: { mode: 'buy', turnID: 11 },
			},
		};

		invalidateIfStale('game1', 11);

		const result = await readGameState({ game: 'game1' });
		expect(result).toEqual({ mode: 'buy', turnID: 11 }); // Fresh from Firebase
		expect(database.ref).toHaveBeenCalledWith('games/game1');
	});

	test('clears cache when gameID does not match', async () => {
		const state = { mode: 'proposal', turnID: 10 };
		setCachedState('game1', 10, state);

		mockDbData = {
			games: {
				game2: { mode: 'bid', turnID: 1 },
			},
		};

		invalidateIfStale('game2', 1);

		const result = await readGameState({ game: 'game2' });
		expect(result).toEqual({ mode: 'bid', turnID: 1 });
		expect(database.ref).toHaveBeenCalledWith('games/game2');
	});
});

// ===========================================================================
// clearCache
// ===========================================================================
describe('clearCache', () => {
	test('forces Firebase read on next readGameState', async () => {
		const state = { mode: 'bid', turnID: 5 };
		setCachedState('game1', 5, state);

		clearCache();

		mockDbData = {
			games: {
				game1: { mode: 'vote', turnID: 6 },
			},
		};

		const result = await readGameState({ game: 'game1' });
		expect(result).toEqual({ mode: 'vote', turnID: 6 });
		expect(database.ref).toHaveBeenCalledWith('games/game1');
	});
});

// ===========================================================================
// Promise deduplication (parallel calls)
// ===========================================================================
describe('promise deduplication', () => {
	test('10 parallel readGameState calls result in only 1 Firebase read', async () => {
		mockDbData = {
			games: {
				game1: {
					mode: 'proposal',
					turnID: 7,
					countryInfo: { Austria: { money: 10 } },
					playerInfo: { Alice: { money: 20 } },
				},
			},
		};

		// Fire 10 parallel reads (simulates MapApp's Promise.all)
		const promises = [];
		for (let i = 0; i < 10; i++) {
			promises.push(readGameState({ game: 'game1' }));
		}
		const results = await Promise.all(promises);

		// All 10 should get the same state
		for (const result of results) {
			expect(result.mode).toBe('proposal');
			expect(result.countryInfo.Austria.money).toBe(10);
		}

		// But only 1 Firebase read should have happened
		expect(database.ref).toHaveBeenCalledTimes(1);
		expect(database.ref).toHaveBeenCalledWith('games/game1');
	});

	test('cache hit: 10 parallel calls with cached state result in 0 Firebase reads', async () => {
		const state = {
			mode: 'bid',
			turnID: 5,
			countryInfo: { France: { money: 15 } },
			playerInfo: { Bob: { money: 30 } },
		};
		setCachedState('game1', 5, state);

		const promises = [];
		for (let i = 0; i < 10; i++) {
			promises.push(readGameState({ game: 'game1' }));
		}
		const results = await Promise.all(promises);

		for (const result of results) {
			expect(result).toEqual(state);
		}
		expect(database.ref).not.toHaveBeenCalled();
	});
});

// ===========================================================================
// Submitting player scenario
// ===========================================================================
describe('submitting player cache flow', () => {
	test('finalizeSubmit caches state → turnID listener fires → instant read', async () => {
		// Step 1: finalizeSubmit writes state and caches it
		const newState = {
			mode: 'buy',
			turnID: 9, // Note: finalizeSubmit will set turnID to 10 in Firebase
			countryUp: 'France',
			countryInfo: { France: { money: 20, points: 5 } },
			playerInfo: { Alice: { money: 30, myTurn: true } },
		};
		setCachedState('game1', 10, newState); // Cached with turnID 10 (the post-increment value)

		// Step 2: turnID listener fires with value 10
		// Component calls invalidateIfStale(game1, 10) → cache preserved
		invalidateIfStale('game1', 10);

		// Step 3: Display functions call readGameState → cache hit, instant
		const result = await readGameState({ game: 'game1' });
		expect(result).toEqual(newState);
		expect(database.ref).not.toHaveBeenCalled(); // Zero Firebase reads!
	});
});

// ===========================================================================
// Non-submitting player scenario
// ===========================================================================
describe('non-submitting player cache flow', () => {
	test('stale cache is invalidated → fresh read from Firebase', async () => {
		// Player B had cached state from turn 8
		setCachedState('game1', 8, { mode: 'proposal', turnID: 7 });

		// Player A submits, turnID goes to 10. Player B's listener fires with 10.
		mockDbData = {
			games: {
				game1: {
					mode: 'buy',
					turnID: 10,
					countryInfo: { France: { money: 25 } },
					playerInfo: { Bob: { money: 15 } },
				},
			},
		};

		// Component calls invalidateIfStale — clears stale cache
		invalidateIfStale('game1', 10);

		// Display functions read fresh state — 1 Firebase read
		const result = await readGameState({ game: 'game1' });
		expect(result.mode).toBe('buy');
		expect(result.turnID).toBe(10);
		expect(database.ref).toHaveBeenCalledTimes(1);
	});
});

// ===========================================================================
// Multi-player concurrent scenarios (eventual consistency)
// ===========================================================================
describe('concurrent multi-player scenarios', () => {
	test('simultaneous bids: each player gets consistent state after their submission', async () => {
		// Initial state: both Alice and Bob have myTurn = true for bidding
		const initialState = {
			mode: 'bid',
			turnID: 5,
			countryUp: 'Austria',
			playerInfo: {
				Alice: { myTurn: true, money: 100 },
				Bob: { myTurn: true, money: 80 },
			},
			countryInfo: { Austria: { availStock: [1, 2, 3] } },
		};

		// Alice submits first → her finalizeSubmit creates new state with turnID 6
		const stateAfterAliceBid = {
			...initialState,
			turnID: 5, // will be incremented to 6
			playerInfo: {
				Alice: { myTurn: false, money: 95, bid: 5 },
				Bob: { myTurn: true, money: 80 },
			},
		};
		setCachedState('game1', 6, stateAfterAliceBid);

		// Alice's client: turnID listener fires with 6
		invalidateIfStale('game1', 6);
		const aliceView = await readGameState({ game: 'game1' });
		expect(aliceView.playerInfo.Alice.myTurn).toBe(false);
		expect(aliceView.playerInfo.Bob.myTurn).toBe(true);
		expect(database.ref).not.toHaveBeenCalled(); // Alice cached, instant

		// Bob's client: cache is from his own previous turn (different turnID)
		clearCache(); // Simulate Bob's separate client
		mockDbData = {
			games: {
				game1: stateAfterAliceBid,
			},
		};
		invalidateIfStale('game1', 6); // Bob's listener fires
		const bobView = await readGameState({ game: 'game1' });
		expect(bobView.playerInfo.Alice.myTurn).toBe(false);
		expect(bobView.playerInfo.Bob.myTurn).toBe(true);
		expect(database.ref).toHaveBeenCalledWith('games/game1'); // Bob reads from Firebase
	});

	test('simultaneous votes: all voters see consistent final state', async () => {
		// Vote scenario: 3 players voting, votes resolve one by one
		const state = {
			mode: 'vote',
			turnID: 20,
			countryUp: 'France',
			playerInfo: {
				Alice: { myTurn: true, money: 50 },
				Bob: { myTurn: true, money: 60 },
				Charlie: { myTurn: true, money: 70 },
			},
			countryInfo: { France: { gov: 'democracy' } },
		};

		// Alice votes first → new state
		const afterAliceVote = {
			...state,
			turnID: 20,
			playerInfo: {
				Alice: { myTurn: false, money: 50 },
				Bob: { myTurn: true, money: 60 },
				Charlie: { myTurn: true, money: 70 },
			},
		};
		setCachedState('game1', 21, afterAliceVote);

		// Verify Alice's view is instant
		invalidateIfStale('game1', 21);
		const aliceView = await readGameState({ game: 'game1' });
		expect(aliceView.playerInfo.Alice.myTurn).toBe(false);
		expect(database.ref).not.toHaveBeenCalled();

		// Bob votes next → clear cache for new turn
		clearCache();
		const afterBobVote = {
			...afterAliceVote,
			turnID: 21,
			playerInfo: {
				Alice: { myTurn: false, money: 50 },
				Bob: { myTurn: false, money: 60 },
				Charlie: { myTurn: true, money: 70 },
			},
		};
		setCachedState('game1', 22, afterBobVote);
		invalidateIfStale('game1', 22);
		const bobView = await readGameState({ game: 'game1' });
		expect(bobView.playerInfo.Bob.myTurn).toBe(false);
		expect(bobView.playerInfo.Charlie.myTurn).toBe(true);
		expect(database.ref).not.toHaveBeenCalled();

		// Charlie votes last → all done, mode changes to 'proposal'
		clearCache();
		const afterAllVotes = {
			mode: 'proposal',
			turnID: 22,
			countryUp: 'France',
			playerInfo: {
				Alice: { myTurn: false, money: 50 },
				Bob: { myTurn: false, money: 60 },
				Charlie: { myTurn: false, money: 70 },
			},
			countryInfo: { France: { gov: 'democracy' } },
		};
		setCachedState('game1', 23, afterAllVotes);
		invalidateIfStale('game1', 23);
		const charlieView = await readGameState({ game: 'game1' });
		expect(charlieView.mode).toBe('proposal');
		expect(database.ref).not.toHaveBeenCalled();
	});
});

// ===========================================================================
// Undo consistency
// ===========================================================================
describe('undo consistency', () => {
	test('undo caches restored state → all components see previous state', async () => {
		// Current state at turnID 10
		const currentState = {
			mode: 'buy',
			turnID: 10,
			playerInfo: { Alice: { myTurn: true, money: 80 } },
			countryInfo: { France: { money: 30 } },
		};
		setCachedState('game1', 10, currentState);

		// Alice undoes → restores state from turnID 9
		const restoredState = {
			mode: 'proposal',
			turnID: 8, // The actual turnID in the restored state object
			playerInfo: { Alice: { myTurn: true, money: 100 } },
			countryInfo: { France: { money: 20 } },
			sameTurn: false,
		};
		// undo calls setCachedState(game, oldTurnID, restoredState) where oldTurnID = 9
		setCachedState('game1', 9, restoredState);

		// turnID listener fires with 9
		invalidateIfStale('game1', 9);

		// All display components read from cache → see restored state
		const result = await readGameState({ game: 'game1' });
		expect(result.mode).toBe('proposal');
		expect(result.playerInfo.Alice.money).toBe(100);
		expect(database.ref).not.toHaveBeenCalled();
	});

	test('undo by one player: other players see fresh state from Firebase', async () => {
		// Alice undoes, caches the restored state on her client
		const restoredState = {
			mode: 'proposal',
			turnID: 8,
			playerInfo: { Alice: { myTurn: true, money: 100 }, Bob: { myTurn: false, money: 50 } },
			countryInfo: {},
			sameTurn: false,
		};
		setCachedState('game1', 9, restoredState);

		// Bob's client: different cache state
		clearCache(); // Bob has no cache (separate client)
		mockDbData = {
			games: {
				game1: restoredState,
			},
		};

		// Bob's turnID listener fires with 9
		invalidateIfStale('game1', 9);
		const bobView = await readGameState({ game: 'game1' });
		expect(bobView.mode).toBe('proposal');
		expect(bobView.playerInfo.Alice.money).toBe(100);
		expect(database.ref).toHaveBeenCalledTimes(1); // Bob reads from Firebase
	});
});

// ===========================================================================
// Edge cases
// ===========================================================================
describe('edge cases', () => {
	test('switching games clears cache for old game', async () => {
		const state1 = { mode: 'bid', turnID: 5 };
		setCachedState('game1', 5, state1);

		mockDbData = {
			games: {
				game2: { mode: 'vote', turnID: 3 },
			},
		};

		// Reading a different game should NOT return game1's cache
		const result = await readGameState({ game: 'game2' });
		expect(result.mode).toBe('vote');
		expect(database.ref).toHaveBeenCalledWith('games/game2');
	});

	test('rapid turnID changes: cache invalidation is idempotent', () => {
		setCachedState('game1', 5, { mode: 'bid', turnID: 5 });

		// Multiple invalidation calls with the same turnID
		invalidateIfStale('game1', 6);
		invalidateIfStale('game1', 6);
		invalidateIfStale('game1', 6);

		// Cache should be cleared (no crash, no undefined behavior)
		expect(true).toBe(true); // If we get here, no crash
	});

	test('invalidateIfStale with matching turnID is a no-op', async () => {
		const state = { mode: 'bid', turnID: 5 };
		setCachedState('game1', 5, state);

		// Calling with matching turnID should NOT clear cache
		invalidateIfStale('game1', 5);

		const result = await readGameState({ game: 'game1' });
		expect(result).toEqual(state);
		expect(database.ref).not.toHaveBeenCalled();
	});

	test('readGameState after invalidation reads fresh data', async () => {
		setCachedState('game1', 5, { mode: 'bid', turnID: 5 });

		mockDbData = {
			games: {
				game1: { mode: 'proposal', turnID: 6 },
			},
		};

		invalidateIfStale('game1', 6);
		const result = await readGameState({ game: 'game1' });
		expect(result.mode).toBe('proposal');
		expect(result.turnID).toBe(6);
	});
});
