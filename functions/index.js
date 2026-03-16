const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const db = require('./db');
const email = require('./email');
const validation = require('./validation');

// Logic modules
const submitBuyLogic = require('./logic/submitBuy');
const submitProposalLogic = require('./logic/submitProposal');
const submitBidLogic = require('./logic/submitBid');
const submitManeuverLogic = require('./logic/submitManeuver');
const submitPeaceLogic = require('./logic/submitPeace');
const gameAdminLogic = require('./logic/gameAdmin');
const submitHelpers = require('./logic/submitHelpers');

admin.initializeApp();

/**
 * Reads the full setup object for a game (territories, wheel, stockCosts, countries).
 * @param {string} setupName - Setup name (e.g. "setups/standard")
 * @returns {Promise<Object>} Full setup object
 */
async function readFullSetup(setupName) {
	return await db.readSetup(setupName);
}

/**
 * Resolves the countries array from setup data.
 * @param {Object} setup - Full setup object
 * @returns {string[]} Ordered country names
 */
function resolveCountries(setup) {
	const countries = setup.countries;
	const t = [null, null, null, null, null, null];
	for (const key in countries) {
		t[countries[key].order - 1] = key;
	}
	return t;
}

/**
 * Resolves players in order from gameState.
 * @param {Object} gameState
 * @returns {string[]} Ordered player names
 */
function resolvePlayersInOrder(gameState) {
	const playerInfo = gameState.playerInfo;
	const t = [null, null, null, null, null, null];
	for (const key in playerInfo) {
		if (playerInfo[key].order) {
			t[playerInfo[key].order - 1] = key;
		} else {
			return Object.keys(playerInfo);
		}
	}
	return t;
}

/**
 * Server-side finalizeSubmit: rounds money, handles timer, archives old state,
 * writes new state, sends email notifications.
 */
async function serverFinalizeSubmit(gameState, gameID, oldState, submitterName) {
	// Round all money
	submitHelpers.roundMoney(gameState);

	// Handle timer
	const serverTime = admin.database.ServerValue.TIMESTAMP;
	// For timer calculations, use actual server time
	const now = Date.now();
	submitHelpers.handleTimer(gameState, oldState, now, submitterName);

	// Increment turnID
	gameState.turnID = gameState.turnID + 1;

	// Write to Firebase (archive old state + write new state)
	await db.writeGameState(gameID, oldState, gameState);

	// Send email notifications (best effort)
	email.sendTurnEmails(gameState).catch((err) => {
		console.error('Email send failed:', err.message);
	});

	return gameState;
}

// ── submitTurn ──────────────────────────────────────────────
// Handles: buy, vote, noCounter, proposal
exports.submitTurn = onCall(async (request) => {
	if (!request.auth) throw new HttpsError('unauthenticated', 'Not logged in');
	const { type, gameID, ...params } = request.data;

	const gameState = await db.readGameState(gameID);
	const oldState = JSON.parse(JSON.stringify(gameState));
	const setup = await readFullSetup(gameState.setup);
	const countries = resolveCountries(setup);

	switch (type) {
		case 'buy': {
			validation.validateBuy(gameState, setup, params);
			const playersInOrder = resolvePlayersInOrder(gameState);
			submitBuyLogic.submitBuyLogic(gameState, setup, params, countries, playersInOrder);
			break;
		}
		case 'vote':
			validation.validateVote(gameState, params);
			await submitProposalLogic.submitVoteLogic(gameState, params, setup, countries);
			break;
		case 'noCounter':
			validation.validateTurn(gameState, params.playerName);
			await submitProposalLogic.submitNoCounterLogic(gameState, params, setup, countries);
			break;
		case 'proposal': {
			validation.validateProposal(gameState, setup, params);
			// submitProposalLogic expects a context object with .name (matching stored proposal format)
			const context = { ...params, name: params.playerName };
			const result = await submitProposalLogic.submitProposalLogic(gameState, context, setup, countries);
			if (result.maneuverNeedsCompletion) {
				await submitManeuverLogic.completeManeuverLogic(
					gameState,
					setup,
					countries,
					(gs, ctx, s, c) => submitProposalLogic.executeProposalLogic(gs, ctx, s, c)
				);
			}
			break;
		}
		default:
			throw new HttpsError('invalid-argument', `Unknown action type: ${type}`);
	}

	const newState = await serverFinalizeSubmit(gameState, gameID, oldState, params.playerName);
	return { state: newState };
});

// ── submitBid ───────────────────────────────────────────────
// Handles: bid, bidBuy
exports.submitBid = onCall(async (request) => {
	if (!request.auth) throw new HttpsError('unauthenticated', 'Not logged in');
	const { type, gameID, ...params } = request.data;

	const gameState = await db.readGameState(gameID);
	const oldState = JSON.parse(JSON.stringify(gameState));
	const setup = await readFullSetup(gameState.setup);
	const countries = resolveCountries(setup);

	switch (type) {
		case 'bid':
			validation.validateBid(gameState, params);
			submitBidLogic.bidLogic(gameState, params, countries, setup.stockCosts);
			break;
		case 'bidBuy':
			validation.validateTurn(gameState, params.playerName);
			submitBidLogic.bidBuyLogic(gameState, setup, params, countries);
			break;
		default:
			throw new HttpsError('invalid-argument', `Unknown action type: ${type}`);
	}

	const newState = await serverFinalizeSubmit(gameState, gameID, oldState, params.playerName);
	return { state: newState };
});

// ── submitManeuver ──────────────────────────────────────────
// Handles: maneuver, batchManeuver
exports.submitManeuver = onCall(async (request) => {
	if (!request.auth) throw new HttpsError('unauthenticated', 'Not logged in');
	const { type, gameID, ...params } = request.data;

	const gameState = await db.readGameState(gameID);
	const oldState = JSON.parse(JSON.stringify(gameState));
	const setup = await readFullSetup(gameState.setup);
	const countries = resolveCountries(setup);

	const executeProposalFn = (gs, ctx, s, c) =>
		submitProposalLogic.executeProposalLogic(gs, ctx, s, c);

	switch (type) {
		case 'maneuver': {
			validation.validateManeuver(gameState, setup, params);
			const result = submitManeuverLogic.submitManeuverLogic(gameState, setup, params);
			if (result.needsCompletion) {
				await submitManeuverLogic.completeManeuverLogic(
					gameState, setup, countries, executeProposalFn
				);
			}
			break;
		}
		case 'batchManeuver':
			await submitManeuverLogic.submitBatchManeuverLogic(
				gameState, setup, params, executeProposalFn, countries
			);
			break;
		default:
			throw new HttpsError('invalid-argument', `Unknown action type: ${type}`);
	}

	const newState = await serverFinalizeSubmit(gameState, gameID, oldState, params.playerName);
	return { state: newState };
});

// ── submitPeace ─────────────────────────────────────────────
// Handles: peaceVote, dictatorPeaceVote
exports.submitPeace = onCall(async (request) => {
	if (!request.auth) throw new HttpsError('unauthenticated', 'Not logged in');
	const { type, gameID, ...params } = request.data;

	const gameState = await db.readGameState(gameID);
	const oldState = JSON.parse(JSON.stringify(gameState));
	const setup = await readFullSetup(gameState.setup);
	const countries = resolveCountries(setup);

	const completeManeuverFn = async (gs, s, c) => {
		await submitManeuverLogic.completeManeuverLogic(
			gs,
			s,
			c,
			(g, ctx, se, co) => submitProposalLogic.executeProposalLogic(g, ctx, se, co)
		);
	};

	switch (type) {
		case 'peaceVote':
			validation.validatePeaceVote(gameState, params);
			await submitPeaceLogic.submitPeaceVoteLogic(gameState, params, completeManeuverFn, setup, countries);
			break;
		case 'dictatorPeaceVote':
			validation.validateTurn(gameState, params.playerName);
			await submitPeaceLogic.submitDictatorPeaceVoteLogic(gameState, params, completeManeuverFn, setup, countries);
			break;
		default:
			throw new HttpsError('invalid-argument', `Unknown action type: ${type}`);
	}

	const newState = await serverFinalizeSubmit(gameState, gameID, oldState, params.playerName);
	return { state: newState };
});

// ── gameAdmin ───────────────────────────────────────────────
// Handles: newGame, undo
exports.gameAdmin = onCall(async (request) => {
	if (!request.auth) throw new HttpsError('unauthenticated', 'Not logged in');
	const { type, ...params } = request.data;

	switch (type) {
		case 'newGame': {
			validation.validateNewGame(params);
			const template = await db.readSetup('template game');
			const serverTime = Date.now();
			const gameState = gameAdminLogic.newGameLogic(template, params, serverTime);
			await db.writeNewGame(params.newGameID, gameState);
			// Increment turnID
			await admin
				.database()
				.ref('games/' + params.newGameID + '/turnID')
				.set(gameState.turnID + 1);
			return { state: gameState };
		}
		case 'undo': {
			const { gameID, playerName } = params;
			// Use transaction for undo to prevent collision
			const result = await db.transactGameState(gameID, (currentState) => {
				if (!currentState) return currentState;
				if (currentState.undo !== playerName) {
					return undefined; // Abort — someone else submitted
				}
				return currentState; // Proceed
			});

			// Now restore from history
			const oldTurnID = result.turnID - 1;
			const historyState = await db.readHistoryState(gameID, oldTurnID);
			if (!historyState) {
				throw new HttpsError('not-found', 'No history state to restore');
			}
			const restoredState = gameAdminLogic.undoLogic(historyState, Date.now());
			await db.removeHistoryState(gameID, oldTurnID);
			await admin.database().ref('games/' + gameID).set(restoredState);
			return { state: restoredState };
		}
		default:
			throw new HttpsError('invalid-argument', `Unknown action type: ${type}`);
	}
});
