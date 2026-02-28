import { database } from './firebase.js';

/**
 * In-memory cache for the most recent game state, with promise deduplication.
 *
 * Eliminates redundant Firebase reads in two ways:
 *
 * 1. **Submitting player (cache hit):** finalizeSubmit() caches the state it writes.
 *    When the turnID listener fires, all display functions (mapAPI, turnAPI, etc.)
 *    call readGameState() which returns the cached state instantly — zero Firebase reads.
 *
 * 2. **Other players (cache miss → deduplicated read):** When 10+ mapAPI functions
 *    call readGameState() in parallel via Promise.all, the first call starts a Firebase
 *    read and stores the promise. All subsequent calls await the same promise — only
 *    1 Firebase read happens instead of 10+.
 *
 * Cache is keyed by gameID. Staleness is managed via invalidateIfStale(), which
 * components call when their turnID listener fires with a new value.
 */

let cachedGameID = null;
let cachedTurnID = null;
let cachedState = null;
let pendingRead = null;

/**
 * Store a gameState in the cache. Called by finalizeSubmit after writing to Firebase.
 *
 * @param {string} gameID - The Firebase game ID
 * @param {number} turnID - The turnID that will be set AFTER the write (the new turnID)
 * @param {Object} gameState - The full game state object (countryInfo, playerInfo, etc.)
 */
function setCachedState(gameID, turnID, gameState) {
	cachedGameID = gameID;
	cachedTurnID = turnID;
	cachedState = gameState;
	pendingRead = null;
}

/**
 * Clear cache if the turnID doesn't match. Called by turnID listeners before
 * fetching display data, so that stale cache from a previous turn is not served.
 *
 * For the submitting player: cachedTurnID matches newTurnID → cache stays (instant).
 * For other players: cachedTurnID is from previous turn → cache cleared → fresh read.
 *
 * @param {string} gameID - The Firebase game ID
 * @param {number} newTurnID - The turnID value from the turnID listener snapshot
 */
function invalidateIfStale(gameID, newTurnID) {
	if (cachedGameID !== gameID || cachedTurnID !== newTurnID) {
		cachedState = null;
		cachedTurnID = null;
		pendingRead = null;
	}
}

/**
 * Read the full game state, using cache if available, with promise deduplication.
 *
 * When multiple functions call this in parallel (via Promise.all), only one Firebase
 * read is performed. All callers share the same promise and receive the same result.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Object>} The full game state object
 */
function readGameState(context) {
	// Cache hit — return instantly
	if (cachedState && cachedGameID === context.game) {
		return Promise.resolve(cachedState);
	}
	// Deduplicate: if a read is already in flight for this game, share it
	if (pendingRead && cachedGameID === context.game) {
		return pendingRead;
	}
	// Cache miss — start a single Firebase read
	cachedGameID = context.game;
	pendingRead = database
		.ref('games/' + context.game)
		.once('value')
		.then((snap) => {
			let state = snap.val();
			if (state) {
				cachedTurnID = state.turnID;
				cachedState = state;
			}
			pendingRead = null;
			return state;
		});
	return pendingRead;
}

/**
 * Clear the cache entirely. Called when switching games or logging out.
 */
function clearCache() {
	cachedGameID = null;
	cachedTurnID = null;
	cachedState = null;
	pendingRead = null;
}

export { setCachedState, readGameState, invalidateIfStale, clearCache };
