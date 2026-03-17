/**
 * submitManeuver.js — Server-side pure game logic for maneuvers.
 *
 * Extracted from the client-side submitAPI.js. All functions are pure:
 * gameState in, mutated gameState out, no Firebase I/O.
 *
 * The triggerPeaceVote helper replaces ~227 lines of duplicated peace-vote
 * trigger logic that previously appeared in three places (submitManeuver,
 * submitBatchManeuver fleet loop, submitBatchManeuver army loop).
 */

const { GOV_TYPES, MODES, MANEUVER_ACTIONS } = require('../shared/gameConstants');
const helper = require('../shared/helper');

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/**
 * Returns ' with ' if the action string is truthy, empty string otherwise.
 * Used to build human-readable maneuver history strings.
 *
 * @param {string} x - Action code from a ManeuverTuple
 * @returns {string}
 */
function w(x) {
	if (x) {
		return ' with ';
	} else {
		return '';
	}
}

/**
 * Builds a human-readable history string for a maneuver action.
 *
 * This is the L-Maneuver/R-Maneuver case from the original makeHistory,
 * extracted as a standalone function since completeManeuverLogic needs it
 * synchronously (the original makeHistory was async due to other cases).
 *
 * @param {Object} gameState - Current game state
 * @param {Object} context - Context with { wheelSpot, fleetMan, armyMan }
 * @returns {string} History string describing the maneuver
 */
function makeHistoryManeuver(gameState, context) {
	let country = gameState.countryUp;
	let sortedF = [...(context.fleetMan || [])].sort((a, b) => b[2].charCodeAt(0) - a[2].charCodeAt(1));
	let f = sortedF.map((x) => x[0] + ' to ' + x[1] + w(x[2]) + x[2]);
	let sortedA = [...(context.armyMan || [])].sort((a, b) => b[2].charCodeAt(0) - a[2].charCodeAt(1));
	let a = sortedA.map((x) => x[0] + ' to ' + x[1] + w(x[2]) + x[2]);
	let parts = [];
	if (f.length > 0) parts.push('fleets from ' + f.join(', '));
	if (a.length > 0) parts.push('armies from ' + a.join(', '));
	return country + ' ' + context.wheelSpot + 's ' + parts.join('. It moves ') + '.';
}

// ---------------------------------------------------------------------------
// triggerPeaceVote — DRY extraction from 3 duplicated blocks
// ---------------------------------------------------------------------------

/**
 * Checks if a peace move triggers a peace vote and sets up the voting
 * mechanism. Replaces duplicated inline logic in submitManeuver (single-step),
 * submitBatchManeuver fleet loop, and submitBatchManeuver army loop.
 *
 * When triggered:
 * - Dictatorship: sets cm.pendingPeace and gives myTurn to the dictator
 * - Democracy: sets gameState.peaceVote, switches mode to PEACE_VOTE,
 *   and gives myTurn to all stockholders of the target country
 *
 * The caller is responsible for storing remainingFleetPlans/remainingArmyPlans
 * (batch mode) and calling finalizeSubmit after this returns { triggered: true }.
 *
 * @param {Object} gameState - Game state (mutated if peace vote triggered)
 * @param {Object} cm - currentManeuver object
 * @param {string} origin - Unit's current territory
 * @param {string} dest - Destination territory
 * @param {string} unitType - 'fleet' or 'army'
 * @param {Object} territorySetup - Territory configuration from setup
 * @param {Set} [destroyedUnits] - Units destroyed earlier in batch (optional, for batch mode)
 * @returns {{ triggered: boolean, tuple: Array }} Whether a peace vote was triggered
 */
function triggerPeaceVote(gameState, cm, origin, dest, unitType, territorySetup, destroyedUnits) {
	let tuple = [origin, dest, MANEUVER_ACTIONS.PEACE];

	let destCountry = territorySetup[dest] && territorySetup[dest].country;
	if (!destCountry || destCountry === cm.country) {
		return { triggered: false, tuple };
	}

	// Check for enemy units at destination
	let hasEnemyUnits = false;
	for (let c in gameState.countryInfo) {
		if (c !== cm.country) {
			for (let f of gameState.countryInfo[c].fleets || []) {
				if (f.territory === dest) {
					if (!destroyedUnits || !destroyedUnits.has(c + ' fleet ' + dest)) {
						hasEnemyUnits = true;
					}
				}
			}
			for (let a of gameState.countryInfo[c].armies || []) {
				if (a.territory === dest) {
					if (!destroyedUnits || !destroyedUnits.has(c + ' army ' + dest)) {
						hasEnemyUnits = true;
					}
				}
			}
		}
	}

	if (!hasEnemyUnits) {
		return { triggered: false, tuple };
	}

	let targetGov = gameState.countryInfo[destCountry].gov;
	if (targetGov === GOV_TYPES.DICTATORSHIP) {
		let dictator = gameState.countryInfo[destCountry].leadership[0];
		cm.pendingPeace = {
			origin: origin,
			destination: dest,
			targetCountry: destCountry,
			unitType: unitType,
			tuple: tuple,
		};
		for (let key in gameState.playerInfo) {
			gameState.playerInfo[key].myTurn = false;
		}
		gameState.playerInfo[dictator].myTurn = true;
		gameState.sameTurn = false;
	} else {
		// Democracy: all stockholders of target country vote
		let leadership = gameState.countryInfo[destCountry].leadership;
		let totalStock = 0;
		for (let player of leadership) {
			for (let s of gameState.playerInfo[player].stock || []) {
				if (s.country === destCountry) {
					totalStock += s.stock;
				}
			}
		}
		gameState.peaceVote = {
			movingCountry: cm.country,
			targetCountry: destCountry,
			unitType: unitType,
			origin: origin,
			destination: dest,
			acceptVotes: 0,
			rejectVotes: 0,
			voters: [],
			totalStock: totalStock,
			tuple: tuple,
		};
		gameState.mode = MODES.PEACE_VOTE;
		for (let key in gameState.playerInfo) {
			gameState.playerInfo[key].myTurn = false;
		}
		for (let player of leadership) {
			gameState.playerInfo[player].myTurn = true;
		}
		gameState.sameTurn = false;
	}

	return { triggered: true, tuple };
}

// ---------------------------------------------------------------------------
// enterManeuverLogic
// ---------------------------------------------------------------------------

/**
 * Initializes step-by-step maneuver mode. Called from submitProposal when
 * the selected wheel action is L-Maneuver or R-Maneuver.
 *
 * Sets up currentManeuver with pending fleet/army lists and switches mode
 * to CONTINUE_MAN. If the country has no units, returns { needsCompletion: true }
 * so the caller can invoke completeManeuverLogic.
 *
 * Adapted from the original enterManeuver (submitAPI.js lines 481-527).
 *
 * @param {Object} gameState - Game state (mutated in place)
 * @param {Object} params - { playerName: string, wheelSpot: string }
 * @returns {{ needsCompletion: boolean }}
 */
function enterManeuverLogic(gameState, params) {
	let country = gameState.countryUp;
	let fleets = gameState.countryInfo[country].fleets || [];
	let armies = gameState.countryInfo[country].armies || [];

	// Determine return mode and proposal slot
	let gov = gameState.countryInfo[country].gov;
	let returnMode, proposalSlot;
	if (gov === GOV_TYPES.DICTATORSHIP) {
		returnMode = 'execute';
		proposalSlot = 0;
	} else if (gameState.mode === MODES.PROPOSAL) {
		returnMode = MODES.PROPOSAL_OPP;
		proposalSlot = 1;
	} else {
		returnMode = MODES.VOTE;
		proposalSlot = 2;
	}

	// Set up currentManeuver
	gameState.currentManeuver = {
		country: country,
		player: params.playerName,
		wheelSpot: params.wheelSpot,
		phase: fleets.length > 0 ? 'fleet' : 'army',
		unitIndex: 0,
		pendingFleets: JSON.parse(JSON.stringify(fleets)),
		pendingArmies: JSON.parse(JSON.stringify(armies)),
		completedFleetMoves: [],
		completedArmyMoves: [],
		returnMode: returnMode,
		proposalSlot: proposalSlot,
		pendingPeace: null,
	};

	// If no units at all, skip directly to completion
	if (fleets.length === 0 && armies.length === 0) {
		return { needsCompletion: true };
	}

	gameState.mode = MODES.CONTINUE_MAN;
	for (let key in gameState.playerInfo) {
		gameState.playerInfo[key].myTurn = false;
	}
	gameState.playerInfo[params.playerName].myTurn = true;
	return { needsCompletion: false };
}

// ---------------------------------------------------------------------------
// completeManeuverLogic
// ---------------------------------------------------------------------------

/**
 * Completes the step-by-step maneuver after all units have been moved.
 * Assembles full fleetMan/armyMan arrays and either executes immediately
 * (dictatorship) or stores as a proposal (democracy).
 *
 * Accepts executeProposalFn as a parameter to avoid circular dependency
 * with submitProposal.js. The caller (index.js) passes it in.
 *
 * Adapted from the original completeManeuver (submitAPI.js lines 537-589).
 *
 * @param {Object} gameState - Game state (mutated in place)
 * @param {Object} setup - Setup configuration data (territories, wheel, etc.)
 * @param {string[]} countries - Ordered array of country names
 * @param {Function} executeProposalFn - executeProposalLogic(gameState, context, setup, countries)
 */
async function completeManeuverLogic(gameState, setup, countries, executeProposalFn) {
	let cm = gameState.currentManeuver;
	let fullContext = {
		name: cm.player,
		wheelSpot: cm.wheelSpot,
		fleetMan: cm.completedFleetMoves || [],
		armyMan: cm.completedArmyMoves || [],
	};

	if (cm.returnMode === 'execute') {
		// Dictatorship: execute immediately
		await executeProposalFn(gameState, fullContext, setup, countries);
	} else if (cm.returnMode === MODES.PROPOSAL_OPP) {
		// Democracy leader: store as proposal 1
		let history = makeHistoryManeuver(gameState, fullContext);
		gameState.history.push(cm.player + ' proposes as the leader: ' + history);
		gameState['proposal 1'] = helper.stringifyFunctions(fullContext);
		gameState.mode = MODES.PROPOSAL_OPP;
		let country = cm.country;
		let opposition = gameState.countryInfo[country].leadership[1];
		for (let key in gameState.playerInfo) {
			gameState.playerInfo[key].myTurn = false;
		}
		gameState.playerInfo[opposition].myTurn = true;
	} else if (cm.returnMode === MODES.VOTE) {
		// Democracy opposition: store as proposal 2
		let history = makeHistoryManeuver(gameState, fullContext);
		gameState.history.push(cm.player + ' proposes as the opposition: ' + history);
		gameState['proposal 2'] = helper.stringifyFunctions(fullContext);
		let country = cm.country;
		let leadership = gameState.countryInfo[country].leadership;
		for (let player of leadership) {
			gameState.playerInfo[player].myTurn = true;
		}
		gameState.mode = MODES.VOTE;
		let l = gameState.history.length;
		gameState.voting = {
			country: country,
			'proposal 1': {
				proposal: gameState.history[l - 2],
				votes: 0,
				voters: [],
			},
			'proposal 2': {
				proposal: gameState.history[l - 1],
				votes: 0,
				voters: [],
			},
		};
	}
	gameState.currentManeuver = null;
}

// ---------------------------------------------------------------------------
// submitManeuverLogic
// ---------------------------------------------------------------------------

/**
 * Submit one unit's movement in the step-by-step maneuver flow.
 *
 * Processes the current unit's destination and action, handles peace offer
 * detection via triggerPeaceVote, and advances to the next unit or marks the
 * maneuver for completion.
 *
 * Adapted from the original submitManeuver (submitAPI.js lines 599-746).
 *
 * @param {Object} gameState - Game state (mutated in place)
 * @param {Object} setup - Setup configuration; must contain setup.territories
 * @param {Object} params - { playerName: string, destination: string, action: string }
 * @returns {{ needsFinalize: boolean, needsCompletion: boolean }} Signals to caller
 */
function submitManeuverLogic(gameState, setup, params) {
	let cm = gameState.currentManeuver;
	if (!cm) return { needsFinalize: false, needsCompletion: false };

	let territorySetup = setup.territories;

	gameState.sameTurn = true;

	// Get current unit info
	let phase = cm.phase;
	let unitIndex = cm.unitIndex;
	let pendingUnits = phase === 'fleet' ? cm.pendingFleets : cm.pendingArmies;
	let currentUnit = pendingUnits[unitIndex];
	let origin = currentUnit.territory;
	let dest = params.destination;
	let action = params.action || '';

	// Validate: armies cannot move to sea territories
	if (phase === 'army' && territorySetup[dest] && territorySetup[dest].sea) {
		console.error('Invalid army move: armies cannot move to sea territory "' + dest + '"');
		return { needsFinalize: false, needsCompletion: false };
	}

	// Build ManeuverTuple
	let tuple = [origin, dest, action];

	// Check if this is a peace offer to foreign territory
	let split = action.split(' ');
	if (split[0] === MANEUVER_ACTIONS.PEACE && dest !== origin) {
		let result = triggerPeaceVote(gameState, cm, origin, dest, phase, territorySetup);
		if (result.triggered) {
			// Peace vote was triggered — caller should finalize
			return { needsFinalize: true, needsCompletion: false };
		}
	}

	// Normal move (not a peace offer to foreign territory, or peace with no enemy units)
	if (phase === 'fleet') {
		if (!cm.completedFleetMoves) cm.completedFleetMoves = [];
		cm.completedFleetMoves.push(tuple);
	} else {
		if (!cm.completedArmyMoves) cm.completedArmyMoves = [];
		cm.completedArmyMoves.push(tuple);
	}
	cm.unitIndex++;

	// Check phase transition
	if (phase === 'fleet' && cm.unitIndex >= (cm.pendingFleets || []).length) {
		cm.phase = 'army';
		cm.unitIndex = 0;
	}

	// Check completion
	if (cm.phase === 'army' && cm.unitIndex >= (cm.pendingArmies || []).length) {
		// All units moved — caller should complete the maneuver then finalize
		gameState.sameTurn = false;
		return { needsFinalize: true, needsCompletion: true };
	}

	// More units to move — stay in continue-man
	for (let key in gameState.playerInfo) {
		gameState.playerInfo[key].myTurn = false;
	}
	gameState.playerInfo[cm.player].myTurn = true;
	return { needsFinalize: true, needsCompletion: false };
}

// ---------------------------------------------------------------------------
// submitBatchManeuverLogic
// ---------------------------------------------------------------------------

/**
 * Submit all maneuver moves at once (batch mode).
 *
 * Processes fleet moves then army moves sequentially, checking each for
 * peace vote triggers via triggerPeaceVote. If no peace votes are triggered,
 * the entire maneuver completes in one pass.
 *
 * If a peace vote IS triggered at move N:
 * - Moves 0..N-1 are committed to completedFleetMoves/completedArmyMoves
 * - Move N triggers the peace vote (dictatorship or democracy)
 * - Remaining moves are stored in cm.remainingFleetPlans/cm.remainingArmyPlans
 * - After peace vote resolves, ManeuverPlannerApp re-loads with remaining plans
 *
 * Adapted from the original submitBatchManeuver (submitAPI.js lines 764-996).
 *
 * @param {Object} gameState - Game state (mutated in place)
 * @param {Object} setup - Setup configuration; must contain setup.territories
 * @param {Object} params - { playerName: string, fleetMan: ManeuverTuple[], armyMan: ManeuverTuple[] }
 * @param {Function} executeProposalFn - executeProposalLogic(gameState, context, setup, countries)
 * @param {string[]} countries - Ordered array of country names
 * @returns {{ needsFinalize: boolean, peaceTriggered: boolean }}
 */
async function submitBatchManeuverLogic(gameState, setup, params, executeProposalFn, countries) {
	let cm = gameState.currentManeuver;
	if (!cm) return { needsFinalize: false, peaceTriggered: false };

	let territorySetup = setup.territories;

	gameState.sameTurn = true;

	let fleetMoves = params.fleetMan || [];
	let armyMoves = params.armyMan || [];

	// Track destroyed units for accurate peace checks.
	// Key: "country unitType territory", e.g. "Italy fleet Adriatic Sea"
	let destroyedUnits = new Set();

	// --- Process fleet moves ---
	for (let i = 0; i < fleetMoves.length; i++) {
		let tuple = fleetMoves[i];
		let origin = tuple[0];
		let dest = tuple[1];
		let action = tuple[2] || '';
		let split = action.split(' ');

		// Check if this move triggers a peace vote
		if (split[0] === MANEUVER_ACTIONS.PEACE && dest !== origin) {
			let result = triggerPeaceVote(gameState, cm, origin, dest, 'fleet', territorySetup, destroyedUnits);
			if (result.triggered) {
				// Store remaining plans for later
				cm.remainingFleetPlans = fleetMoves.slice(i + 1);
				cm.remainingArmyPlans = armyMoves;
				return { needsFinalize: true, peaceTriggered: true };
			}
		}

		// Track unit destruction from war moves
		if (split[0] === MANEUVER_ACTIONS.WAR_PREFIX && split.length >= 3) {
			let targetCountry = split.slice(1, split.length - 1).join(' ');
			let targetType = split[split.length - 1];
			destroyedUnits.add(targetCountry + ' ' + targetType + ' ' + dest);
		}

		// No peace vote: commit this move
		if (!cm.completedFleetMoves) cm.completedFleetMoves = [];
		cm.completedFleetMoves.push(tuple);
		cm.unitIndex++;
	}

	// Phase transition to army
	cm.phase = 'army';
	cm.unitIndex = 0;

	// --- Process army moves ---
	for (let i = 0; i < armyMoves.length; i++) {
		let tuple = armyMoves[i];
		let origin = tuple[0];
		let dest = tuple[1];
		let action = tuple[2] || '';
		let split = action.split(' ');

		// Validate: armies cannot move to sea territories
		if (territorySetup[dest] && territorySetup[dest].sea) {
			console.error('Invalid army move: armies cannot move to sea territory "' + dest + '"');
			continue;
		}

		// Check if this move triggers a peace vote
		if (split[0] === MANEUVER_ACTIONS.PEACE && dest !== origin) {
			let result = triggerPeaceVote(gameState, cm, origin, dest, 'army', territorySetup, destroyedUnits);
			if (result.triggered) {
				// Store remaining plans for later
				cm.remainingFleetPlans = [];
				cm.remainingArmyPlans = armyMoves.slice(i + 1);
				return { needsFinalize: true, peaceTriggered: true };
			}
		}

		// Track unit destruction from war and blow-up moves
		if (split[0] === MANEUVER_ACTIONS.WAR_PREFIX && split.length >= 3) {
			let targetCountry = split.slice(1, split.length - 1).join(' ');
			let targetType = split[split.length - 1];
			destroyedUnits.add(targetCountry + ' ' + targetType + ' ' + dest);
		}

		// No peace vote: commit this move
		if (!cm.completedArmyMoves) cm.completedArmyMoves = [];
		cm.completedArmyMoves.push(tuple);
		cm.unitIndex++;
	}

	// All moves processed without peace interruption — complete the maneuver
	await completeManeuverLogic(gameState, setup, countries, executeProposalFn);
	gameState.sameTurn = false;
	return { needsFinalize: true, peaceTriggered: false };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
	triggerPeaceVote,
	enterManeuverLogic,
	completeManeuverLogic,
	submitManeuverLogic,
	submitBatchManeuverLogic,
	makeHistoryManeuver,
};
