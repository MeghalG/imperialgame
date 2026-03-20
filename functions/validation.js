const { HttpsError } = require('firebase-functions/v2/https');
const { MODES } = require('./shared/gameConstants');

/**
 * Verify the game is in the expected mode.
 * @param {Object} gameState
 * @param {string} expectedMode
 */
function validateMode(gameState, expectedMode) {
	if (gameState.mode !== expectedMode) {
		throw new HttpsError('failed-precondition', `Expected mode ${expectedMode}, got ${gameState.mode}`);
	}
}

/**
 * Verify it's this player's turn.
 * @param {Object} gameState
 * @param {string} playerName
 */
function validateTurn(gameState, playerName) {
	if (!gameState.playerInfo[playerName]) {
		throw new HttpsError('failed-precondition', `Player "${playerName}" not in this game`);
	}
	if (!gameState.playerInfo[playerName].myTurn) {
		throw new HttpsError('failed-precondition', `It is not ${playerName}'s turn`);
	}
}

/**
 * Validate a stock buy action.
 * @param {Object} gameState
 * @param {Object} setup - Full setup object (contains stockCosts)
 * @param {Object} params - { playerName, buyCountry, buyStock }
 */
function validateBuy(gameState, setup, params) {
	const { playerName, buyCountry, buyStock } = params;
	validateTurn(gameState, playerName);
	// Punt buy is always valid
	if (buyCountry === 'Punt Buy') return;
	// Check country exists
	if (!gameState.countryInfo[buyCountry]) {
		throw new HttpsError('failed-precondition', `Country "${buyCountry}" does not exist`);
	}
	// Check stock exists in available pool
	const avail = gameState.countryInfo[buyCountry].availStock || [];
	if (!avail.includes(buyStock)) {
		throw new HttpsError('failed-precondition', `Stock ${buyStock} not available for ${buyCountry}`);
	}
	// Check player can afford it
	const stockCosts = setup.stockCosts || {};
	const price = stockCosts[buyStock] || 0;
	if (gameState.playerInfo[playerName].money < price) {
		throw new HttpsError(
			'failed-precondition',
			`Cannot afford stock (need $${price}, have $${gameState.playerInfo[playerName].money})`
		);
	}
}

/**
 * Validate a bid.
 * @param {Object} gameState
 * @param {Object} params - { playerName, bidAmount }
 */
function validateBid(gameState, params) {
	const { playerName, bidAmount } = params;
	validateTurn(gameState, playerName);
	if (bidAmount < 0) {
		throw new HttpsError('failed-precondition', 'Bid cannot be negative');
	}
	if (bidAmount > gameState.playerInfo[playerName].money) {
		throw new HttpsError(
			'failed-precondition',
			`Bid exceeds available money ($${gameState.playerInfo[playerName].money})`
		);
	}
}

/**
 * Validate a proposal (wheel position).
 * @param {Object} gameState
 * @param {Object} setup - Full setup object (contains wheel)
 * @param {Object} params - { playerName, wheelSpot }
 */
function validateProposal(gameState, setup, params) {
	const { playerName, wheelSpot } = params;
	validateTurn(gameState, playerName);
	const wheel = setup.wheel;
	if (!wheel || !wheel.includes(wheelSpot)) {
		throw new HttpsError('failed-precondition', `Invalid wheel position: ${wheelSpot}`);
	}
}

/**
 * Validate a maneuver move.
 * @param {Object} gameState
 * @param {Object} setup - Full setup object (contains territories)
 * @param {Object} params - { playerName, destination }
 */
function validateManeuver(gameState, setup, params) {
	const { playerName, destination } = params;
	validateTurn(gameState, playerName);
	const cm = gameState.currentManeuver;
	if (!cm) {
		throw new HttpsError('failed-precondition', 'No active maneuver');
	}
	if (cm.player !== playerName) {
		throw new HttpsError('failed-precondition', `Only ${cm.player} can control this maneuver`);
	}
	const territorySetup = setup.territories || {};
	// Armies can't move to sea
	if (cm.phase === 'army' && territorySetup[destination] && territorySetup[destination].sea) {
		throw new HttpsError('failed-precondition', `Armies cannot move to sea territory "${destination}"`);
	}
}

/**
 * Validate a vote action.
 * @param {Object} gameState
 * @param {Object} params - { playerName, vote }
 */
function validateVote(gameState, params) {
	const { playerName, vote } = params;
	validateTurn(gameState, playerName);
	if (vote !== 1 && vote !== 2) {
		throw new HttpsError('failed-precondition', `Invalid vote: ${vote}. Must be 1 or 2`);
	}
}

/**
 * Validate a peace vote action.
 * @param {Object} gameState
 * @param {Object} params - { playerName, vote }
 */
function validatePeaceVote(gameState, params) {
	const { playerName, vote } = params;
	validateTurn(gameState, playerName);
	if (vote !== 'accept' && vote !== 'reject') {
		throw new HttpsError('failed-precondition', `Invalid peace vote: ${vote}. Must be 'accept' or 'reject'`);
	}
}

/**
 * Validate a new game request.
 * @param {Object} params - { newGameID, newGamePlayers }
 */
function validateNewGame(params) {
	const { newGameID, newGamePlayers } = params;
	if (!newGameID || typeof newGameID !== 'string') {
		throw new HttpsError('failed-precondition', 'Invalid game ID');
	}
	if (!Array.isArray(newGamePlayers) || newGamePlayers.filter(Boolean).length < 2) {
		throw new HttpsError('failed-precondition', 'Need at least 2 players');
	}
}

module.exports = {
	validateMode,
	validateTurn,
	validateBuy,
	validateBid,
	validateProposal,
	validateManeuver,
	validateVote,
	validatePeaceVote,
	validateNewGame,
};
