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

// ---------------------------------------------------------------------------
// Subscription mechanism — lets React components react to cache changes.
// ---------------------------------------------------------------------------
let subscribers = [];
let isNotifying = false;

/**
 * Register a callback that fires whenever the cached state changes.
 * Returns an unsubscribe function.
 *
 * @param {Function} callback - Called with (gameState) on every cache change
 * @returns {Function} Unsubscribe function
 */
function subscribe(callback) {
	subscribers.push(callback);
	return () => {
		subscribers = subscribers.filter((cb) => cb !== callback);
	};
}

/**
 * Notify all subscribers with the current cached state.
 * Re-entrancy guard prevents nested calls (e.g. if a subscriber triggers a submit).
 * Per-subscriber try/catch ensures one failing subscriber doesn't block others.
 */
function notifySubscribers() {
	if (isNotifying) return;
	isNotifying = true;
	try {
		let state = cachedState;
		for (let i = 0; i < subscribers.length; i++) {
			try {
				subscribers[i](state);
			} catch (e) {
				console.error('stateCache subscriber error:', e);
			}
		}
	} finally {
		isNotifying = false;
	}
}

/**
 * Get the current cached state synchronously (for initial mount).
 * Returns null if no state is cached.
 */
function getCachedState() {
	return cachedState;
}

/**
 * Store a gameState in the cache. Called by finalizeSubmit after writing to Firebase.
 *
 * @param {string} gameID - The Firebase game ID
 * @param {number} turnID - The turnID that will be set AFTER the write (the new turnID)
 * @param {Object} gameState - The full game state object (countryInfo, playerInfo, etc.)
 */
function setCachedState(gameID, turnID, gameState) {
	let changed = cachedTurnID !== turnID || cachedGameID !== gameID;
	cachedGameID = gameID;
	cachedTurnID = turnID;
	cachedState = gameState;
	pendingRead = null;
	if (gameState && changed) {
		notifySubscribers();
	}
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
				let changed = cachedTurnID !== state.turnID;
				cachedTurnID = state.turnID;
				cachedState = state;
				if (changed) {
					notifySubscribers();
				}
			}
			pendingRead = null;
			return state;
		});
	return pendingRead;
}

/**
 * In-memory cache for static setup data (territories, wheel, countries, stockCosts).
 * Setup data never changes during a game, so it's cached permanently per path.
 * Keyed by Firebase path (e.g. "setups/standard/territories").
 */
let setupCache = {};
let pendingSetupReads = {};

/**
 * Read static setup data from Firebase, with permanent caching.
 * Setup data (territories, wheel, countries, stockCosts) never changes during a game,
 * so it only needs to be fetched once per path.
 *
 * @param {string} path - The Firebase path (e.g. "setups/standard/territories")
 * @returns {Promise<Object>} The setup data at that path
 */
function readSetup(path) {
	if (setupCache[path]) {
		return Promise.resolve(setupCache[path]);
	}
	if (pendingSetupReads[path]) {
		return pendingSetupReads[path];
	}
	pendingSetupReads[path] = database
		.ref(path)
		.once('value')
		.then((snap) => {
			let val = snap.val();
			if (val) {
				setupCache[path] = val;
			}
			delete pendingSetupReads[path];
			return val;
		});
	return pendingSetupReads[path];
}

/**
 * Clear the cache entirely. Called when switching games or logging out.
 */
function clearCache() {
	cachedGameID = null;
	cachedTurnID = null;
	cachedState = null;
	pendingRead = null;
	setupCache = {};
	pendingSetupReads = {};
	subscribers = [];
}

export { setCachedState, readGameState, invalidateIfStale, clearCache, readSetup, subscribe, getCachedState };
