/**
 * submitPeace.js — Server-side pure game logic for peace vote handling,
 * extracted from submitAPI.js.
 *
 * All functions are pure: they take a gameState (and supporting data) as input
 * and mutate gameState in place. No Firebase I/O.
 */

const { MODES, MANEUVER_ACTIONS } = require('../shared/gameConstants');

// ---------------------------------------------------------------------------
// Dictator Peace Vote
// ---------------------------------------------------------------------------

/**
 * Handles a dictator accepting or rejecting a peace offer during maneuvers.
 *
 * Called when the target country is a dictatorship and a unit wants to enter
 * peacefully. The dictator (single controlling player) decides immediately.
 *
 * Mutates gameState in place:
 * - Resolves pendingPeace into a completed move tuple (peace, war, or hostile)
 * - Advances unitIndex and checks phase transitions (fleet -> army)
 * - If all units have moved, calls completeManeuverFn to finalize
 * - Otherwise returns control to the maneuvering player
 *
 * @param {Object} gameState - Current game state (mutated in place)
 * @param {Object} params - Submission parameters
 * @param {string} params.playerName - Name of the dictator voting
 * @param {boolean} params.accept - true to accept peace, false to reject
 * @param {Function} completeManeuverFn - Called as completeManeuverFn(gameState, setup, countries)
 *   when all units have finished moving. Passed in to avoid circular dependencies.
 * @param {Object} setup - Setup configuration for the game
 * @param {string[]} countries - Array of country names
 * @returns {Object} gameState (same reference, mutated)
 */
async function submitDictatorPeaceVoteLogic(gameState, params, completeManeuverFn, setup, countries) {
	let cm = gameState.currentManeuver;
	if (!cm || !cm.pendingPeace) return gameState;

	gameState.sameTurn = true;

	let peace = cm.pendingPeace;
	let tuple;
	if (params.accept) {
		tuple = [peace.origin, peace.destination, MANEUVER_ACTIONS.PEACE];
		gameState.history.push(
			params.playerName + ' accepts the peace offer from ' + cm.country + ' at ' + peace.destination + '.'
		);
	} else {
		// Rejected: find an enemy unit at the destination to make it a war
		let targetCountry = peace.targetCountry;
		let virtualFleets = gameState.countryInfo[targetCountry].fleets || [];
		let virtualArmies = gameState.countryInfo[targetCountry].armies || [];
		let foundUnit = null;
		for (let f of virtualFleets) {
			if (f.territory === peace.destination) {
				foundUnit = targetCountry + ' fleet';
				break;
			}
		}
		if (!foundUnit) {
			for (let a of virtualArmies) {
				if (a.territory === peace.destination) {
					foundUnit = targetCountry + ' army';
					break;
				}
			}
		}
		if (foundUnit) {
			tuple = [peace.origin, peace.destination, 'war ' + foundUnit];
		} else {
			// No enemy unit found; treat as hostile entry instead
			tuple = [peace.origin, peace.destination, MANEUVER_ACTIONS.HOSTILE];
		}
		gameState.history.push(
			params.playerName + ' rejects the peace offer from ' + cm.country + ' at ' + peace.destination + '.'
		);
	}

	// Add the resolved tuple
	if (cm.phase === 'fleet') {
		if (!cm.completedFleetMoves) cm.completedFleetMoves = [];
		cm.completedFleetMoves.push(tuple);
	} else {
		if (!cm.completedArmyMoves) cm.completedArmyMoves = [];
		cm.completedArmyMoves.push(tuple);
	}
	cm.pendingPeace = null;
	cm.unitIndex++;

	// Check phase transition
	if (cm.phase === 'fleet' && cm.unitIndex >= (cm.pendingFleets || []).length) {
		cm.phase = 'army';
		cm.unitIndex = 0;
	}

	// Check completion
	if (cm.phase === 'army' && cm.unitIndex >= (cm.pendingArmies || []).length) {
		await completeManeuverFn(gameState, setup, countries);
		gameState.sameTurn = false;
		gameState.undo = params.playerName;
		return gameState;
	}

	// More units to move — return control to the proposer
	for (let key in gameState.playerInfo) {
		gameState.playerInfo[key].myTurn = false;
	}
	gameState.playerInfo[cm.player].myTurn = true;
	// Active player is changing back to proposer — force TurnApp refresh
	gameState.sameTurn = false;
	gameState.undo = params.playerName;
	return gameState;
}

// ---------------------------------------------------------------------------
// Stockholder Peace Vote (Democracy)
// ---------------------------------------------------------------------------

/**
 * Handles a stockholder's vote on a peace offer in a democracy.
 *
 * Target country is a democracy; stockholders vote weighted by their stock
 * denomination in the target country. The leader gets a +0.1 tiebreak bonus.
 * A majority (> totalStock/2) is needed to accept or reject.
 *
 * Mutates gameState in place:
 * - Records the voter's weighted vote (accept or reject)
 * - If accept threshold reached: resolves as peace, advances maneuver
 * - If reject threshold reached: resolves as war/hostile, advances maneuver
 * - If neither threshold reached: stays in peace-vote mode for more votes
 * - On maneuver completion, calls completeManeuverFn
 *
 * @param {Object} gameState - Current game state (mutated in place)
 * @param {Object} params - Submission parameters
 * @param {string} params.playerName - Name of the voting player
 * @param {string} params.vote - 'accept' or 'reject'
 * @param {Function} completeManeuverFn - Called as completeManeuverFn(gameState, setup, countries)
 *   when all units have finished moving. Passed in to avoid circular dependencies.
 * @param {Object} setup - Setup configuration for the game
 * @param {string[]} countries - Array of country names
 * @returns {Object} gameState (same reference, mutated)
 */
async function submitPeaceVoteLogic(gameState, params, completeManeuverFn, setup, countries) {
	let pv = gameState.peaceVote;
	if (!pv) return gameState;
	let cm = gameState.currentManeuver;
	if (!cm) return gameState;

	gameState.sameTurn = true;
	gameState.playerInfo[params.playerName].myTurn = false;

	// Calculate voter's stock weight
	let targetCountry = pv.targetCountry;
	let leadership = gameState.countryInfo[targetCountry].leadership;
	let voterWeight = 0;
	for (let s of gameState.playerInfo[params.playerName].stock || []) {
		if (s.country === targetCountry) {
			voterWeight += s.stock;
		}
	}
	// Leader tiebreak bonus
	if (leadership[0] === params.playerName) {
		voterWeight += 0.1;
	}

	if (params.vote === 'accept') {
		pv.acceptVotes += voterWeight;
	} else {
		pv.rejectVotes += voterWeight;
	}
	if (!pv.voters) pv.voters = [];
	pv.voters.push(params.playerName);

	let threshold = (pv.totalStock + 0.01) / 2.0;

	if (pv.acceptVotes > threshold) {
		// Accepted
		let tuple = [pv.origin, pv.destination, MANEUVER_ACTIONS.PEACE];
		if (cm.phase === 'fleet') {
			if (!cm.completedFleetMoves) cm.completedFleetMoves = [];
			cm.completedFleetMoves.push(tuple);
		} else {
			if (!cm.completedArmyMoves) cm.completedArmyMoves = [];
			cm.completedArmyMoves.push(tuple);
		}
		gameState.history.push(
			pv.targetCountry + ' stockholders accept the peace offer from ' + pv.movingCountry + ' at ' + pv.destination + '.'
		);
		gameState.peaceVote = null;
		cm.unitIndex++;

		// Check phase transition
		if (cm.phase === 'fleet' && cm.unitIndex >= (cm.pendingFleets || []).length) {
			cm.phase = 'army';
			cm.unitIndex = 0;
		}

		// Check completion
		if (cm.phase === 'army' && cm.unitIndex >= (cm.pendingArmies || []).length) {
			await completeManeuverFn(gameState, setup, countries);
			gameState.sameTurn = false;
			gameState.undo = params.playerName;
			return gameState;
		}

		// Return to continue-man — active player changing to proposer
		gameState.mode = MODES.CONTINUE_MAN;
		for (let key in gameState.playerInfo) {
			gameState.playerInfo[key].myTurn = false;
		}
		gameState.playerInfo[cm.player].myTurn = true;
		gameState.sameTurn = false;
	} else if (pv.rejectVotes > threshold) {
		// Rejected — becomes war
		let foundUnit = null;
		let virtualFleets = gameState.countryInfo[targetCountry].fleets || [];
		let virtualArmies = gameState.countryInfo[targetCountry].armies || [];
		for (let f of virtualFleets) {
			if (f.territory === pv.destination) {
				foundUnit = targetCountry + ' fleet';
				break;
			}
		}
		if (!foundUnit) {
			for (let a of virtualArmies) {
				if (a.territory === pv.destination) {
					foundUnit = targetCountry + ' army';
					break;
				}
			}
		}
		let tuple;
		if (foundUnit) {
			tuple = [pv.origin, pv.destination, 'war ' + foundUnit];
		} else {
			tuple = [pv.origin, pv.destination, MANEUVER_ACTIONS.HOSTILE];
		}

		if (cm.phase === 'fleet') {
			if (!cm.completedFleetMoves) cm.completedFleetMoves = [];
			cm.completedFleetMoves.push(tuple);
		} else {
			if (!cm.completedArmyMoves) cm.completedArmyMoves = [];
			cm.completedArmyMoves.push(tuple);
		}
		gameState.history.push(
			pv.targetCountry + ' stockholders reject the peace offer from ' + pv.movingCountry + ' at ' + pv.destination + '.'
		);
		gameState.peaceVote = null;
		cm.unitIndex++;

		// Check phase transition
		if (cm.phase === 'fleet' && cm.unitIndex >= (cm.pendingFleets || []).length) {
			cm.phase = 'army';
			cm.unitIndex = 0;
		}

		// Check completion
		if (cm.phase === 'army' && cm.unitIndex >= (cm.pendingArmies || []).length) {
			await completeManeuverFn(gameState, setup, countries);
			gameState.sameTurn = false;
			gameState.undo = params.playerName;
			return gameState;
		}

		// Return to continue-man — active player changing to proposer
		gameState.mode = MODES.CONTINUE_MAN;
		for (let key in gameState.playerInfo) {
			gameState.playerInfo[key].myTurn = false;
		}
		gameState.playerInfo[cm.player].myTurn = true;
		gameState.sameTurn = false;
	}
	// Else: more votes needed, stay in peace-vote mode

	gameState.undo = params.playerName;
	return gameState;
}

module.exports = {
	submitDictatorPeaceVoteLogic,
	submitPeaceVoteLogic,
};
