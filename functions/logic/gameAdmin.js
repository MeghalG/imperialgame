/**
 * gameAdmin.js — Server-side pure game logic for game admin operations,
 * extracted from submitAPI.js.
 *
 * All functions are pure: they take pre-read data as input and return the
 * mutated game state. No Firebase I/O.
 */

// ---------------------------------------------------------------------------
// New Game
// ---------------------------------------------------------------------------

/**
 * Creates a new game state from a template.
 *
 * Takes a pre-read template game state and populates it with the given players,
 * distributing starting money equally and initializing timer if timed.
 *
 * NOTE: Uses JSON.parse(JSON.stringify()) for deep cloning the template player
 * to avoid the shallow-spread bug where all players share the same nested
 * object references (e.g., stock arrays, country data).
 *
 * @param {Object} templateGameState - Pre-read template game state from Firebase
 *   (e.g., from 'template game' ref). Mutated in place and returned.
 * @param {Object} params - Game creation parameters
 * @param {string} params.newGameID - ID for the new game
 * @param {string[]} params.newGamePlayers - Array of player names (up to 6);
 *   empty/falsy entries are skipped
 * @param {number} serverTime - Server timestamp (replaces Date.now() + offset)
 * @returns {Object} The populated game state, ready to write to Firebase
 */
function newGameLogic(templateGameState, params, serverTime) {
	let gameState = templateGameState; // already read by caller
	let count = 0;
	for (let i in params.newGamePlayers) {
		if (params.newGamePlayers[i]) {
			count += 1;
		}
	}
	let startingMoney = parseFloat((61.0 / count).toFixed(2));

	let templatePlayer = gameState.playerInfo.player;
	templatePlayer.money = startingMoney;
	delete gameState.playerInfo.player;
	let timer = gameState.timer;
	if (timer.timed) {
		timer.lastMove = serverTime;
	}
	for (let i in params.newGamePlayers) {
		if (params.newGamePlayers[i]) {
			// BUG FIX: deep clone instead of shallow spread to avoid shared
			// nested object references (e.g., stock arrays) between players
			gameState.playerInfo[params.newGamePlayers[i]] = JSON.parse(JSON.stringify(templatePlayer));
			if (timer.timed) {
				gameState.playerInfo[params.newGamePlayers[i]].banked = timer.banked;
			}
		}
	}
	let p = params.newGamePlayers.filter(Boolean).join(', ');
	gameState.history = ['The game has begun with players ' + p + '.'];
	return gameState;
}

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

/**
 * Restores a previous game state for undo.
 *
 * Takes a pre-read history snapshot and updates the timer's lastMove to the
 * current server time. Clears sameTurn so the UI refreshes properly.
 *
 * @param {Object} historyState - The game state snapshot read from history
 *   (pre-read by caller). Mutated in place and returned.
 * @param {number} serverTime - Server timestamp for updating the timer
 * @returns {Object} The restored game state, ready to write to Firebase
 */
function undoLogic(historyState, serverTime) {
	let gameState = historyState;
	gameState.timer.lastMove = serverTime;
	gameState.sameTurn = false;
	return gameState;
}

module.exports = {
	newGameLogic,
	undoLogic,
};
