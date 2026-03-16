const admin = require('firebase-admin');

/**
 * Reads the full game state from Firebase RTDB.
 * @param {string} gameID - The game ID
 * @returns {Promise<Object>} The game state object
 */
async function readGameState(gameID) {
	const snap = await admin.database().ref('games/' + gameID).once('value');
	const state = snap.val();
	if (!state) {
		const { HttpsError } = require('firebase-functions/v2/https');
		throw new HttpsError('not-found', `Game "${gameID}" not found`);
	}
	return state;
}

/**
 * Reads a setup configuration from Firebase RTDB.
 * @param {string} setupPath - The setup path (e.g. "setups/standard")
 * @returns {Promise<Object>} The setup object
 */
async function readSetup(setupPath) {
	const snap = await admin.database().ref(setupPath).once('value');
	return snap.val();
}

/**
 * Writes the new game state and archives the old state atomically.
 * @param {string} gameID - The game ID
 * @param {Object} oldState - The previous game state (archived to history)
 * @param {Object} newState - The new game state to write
 */
async function writeGameState(gameID, oldState, newState) {
	const updates = {};
	updates['game histories/' + gameID + '/' + oldState.turnID] = oldState;
	updates['games/' + gameID] = newState;
	await admin.database().ref().update(updates);
}

/**
 * Writes a brand new game state (no history archival needed).
 * @param {string} gameID - The game ID
 * @param {Object} gameState - The game state to write
 */
async function writeNewGame(gameID, gameState) {
	await admin.database().ref('games/' + gameID).set(gameState);
}

/**
 * Reads the game state using a transaction (for concurrent-safe operations).
 * Returns the current state and a commit function.
 * @param {string} gameID - The game ID
 * @param {Function} updateFn - Function that receives current state and returns new state (or undefined to abort)
 * @returns {Promise<Object>} The committed state
 */
async function transactGameState(gameID, updateFn) {
	const gameRef = admin.database().ref('games/' + gameID);
	const result = await gameRef.transaction(updateFn);
	if (!result.committed) {
		const { HttpsError } = require('firebase-functions/v2/https');
		throw new HttpsError('aborted', 'Transaction was aborted');
	}
	return result.snapshot.val();
}

/**
 * Reads a game state snapshot from history (for undo).
 * @param {string} gameID - The game ID
 * @param {number} turnID - The turn ID to read
 * @returns {Promise<Object>} The historical game state
 */
async function readHistoryState(gameID, turnID) {
	const snap = await admin.database().ref('game histories/' + gameID + '/' + turnID).once('value');
	return snap.val();
}

/**
 * Removes a history entry (used by undo).
 * @param {string} gameID - The game ID
 * @param {number} turnID - The turn ID to remove
 */
async function removeHistoryState(gameID, turnID) {
	await admin.database().ref('game histories/' + gameID + '/' + turnID).remove();
}

module.exports = {
	readGameState,
	readSetup,
	writeGameState,
	writeNewGame,
	transactGameState,
	readHistoryState,
	removeHistoryState,
};
