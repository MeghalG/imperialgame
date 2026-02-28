import * as helper from './helper.js';
import { readGameState, readSetup } from './stateCache.js';
import { MODES, MANEUVER_ACTIONS } from '../gameConstants.js';

/**
 * Retrieves the previous proposal message for the opposition leader or a maneuver continuation message.
 * If the current player is the opposition leader and the mode is 'proposal', returns the last
 * history entry (the leader's proposal). If the mode is 'continue-man', returns the current
 * maneuver state. Otherwise returns an empty string.
 *
 * Called from: ProposalAppOpp to display what the leader proposed so the opposition can counter.
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<string|Object>} The previous proposal description, maneuver state, or empty string
 */
async function getPreviousProposalMessage(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let opp = gameState.countryInfo[country].leadership[1];
	let history = gameState.history;

	if (opp === context.name && gameState.mode === MODES.PROPOSAL) {
		return history[history.length - 1];
	} else if (gameState.mode === MODES.CONTINUE_MAN) {
		return gameState.currentManeuver;
	} else {
		return '';
	}
}

/**
 * Returns the available wheel (rondel) positions for the current country.
 * Free moves are 1-3 steps forward; steps 4-6 require the player to have enough money
 * ($2 for step 4, $4 for step 5, $6 for step 6). If the country is at "center"
 * (first move of the game), all rondel positions are available for free.
 *
 * Called from: ProposalApp to populate the wheel action dropdown.
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<string[]>} Array of available wheel action names (e.g. "Investor", "Taxation", etc.)
 */
async function getWheelOptions(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let currentPos = gameState.countryInfo[country].wheelSpot;
	let money = gameState.playerInfo[context.name].money;
	let wheel = await readSetup(gameState.setup + '/wheel');
	if (currentPos === 'center') {
		return wheel;
	} else {
		let t = [];
		let index = wheel.indexOf(currentPos);
		t.push(wheel[(index + 1) % wheel.length]);
		t.push(wheel[(index + 2) % wheel.length]);
		t.push(wheel[(index + 3) % wheel.length]);
		if (money >= 2) {
			t.push(wheel[(index + 4) % wheel.length]);
		}
		if (money >= 4) {
			t.push(wheel[(index + 5) % wheel.length]);
		}
		if (money >= 6) {
			t.push(wheel[(index + 6) % wheel.length]);
		}
		return t;
	}
}

/**
 * Returns the territories where the current country can build a factory.
 * A factory can be built on any home territory that is not currently occupied
 * (sat on by a hostile army) and does not already have a factory.
 *
 * Called from: ProposalApp when the player selects the "Factory" wheel action.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<string[]>} Array of territory names eligible for factory placement
 */
async function getLocationOptions(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let countryInfo = gameState.countryInfo;
	let territories = await readSetup(gameState.setup + '/territories');
	let factories = countryInfo[country].factories;
	let opts = [];
	let sat = helper.getSat(countryInfo, country);
	for (let key in territories) {
		if (territories[key].country === country) {
			if (!sat.includes(key) && !factories.includes(key)) {
				opts.push(key);
			}
		}
	}
	return opts;
}

/**
 * Returns the territories where new fleets can be produced, along with the remaining fleet capacity.
 * Only unsaturated (not occupied) factories that have a port can produce fleets.
 * The limit is the country's fleet cap minus the number of existing fleets.
 *
 * Called from: ProposalApp when the player selects an "L-Produce" or "R-Produce" wheel action
 * to populate the fleet production checkboxes.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<{items: string[], limit: number}>} Object with eligible port factory territory names
 *   and the maximum number of new fleets that can be produced
 */
async function getFleetProduceOptions(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let territories = await readSetup(gameState.setup + '/territories');
	let countrysetup = await readSetup(gameState.setup + '/countries');
	let fleets = gameState.countryInfo[country].fleets;
	if (!fleets) {
		fleets = [];
	}

	let unsatFactories = helper.getUnsatFactories(gameState.countryInfo, country);
	let t = [];
	for (let i in unsatFactories) {
		if (territories[unsatFactories[i]].port) {
			t.push(unsatFactories[i]);
		}
	}
	return {
		items: t,
		limit: countrysetup[country].fleetLimit - fleets.length,
	};
}

/**
 * Returns the territories where new armies can be produced, along with the remaining army capacity.
 * Only unsaturated (not occupied) factories that are NOT ports can produce armies.
 * The limit is the country's army cap minus the number of existing armies.
 *
 * Called from: ProposalApp when the player selects an "L-Produce" or "R-Produce" wheel action
 * to populate the army production checkboxes.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<{items: string[], limit: number}>} Object with eligible inland factory territory names
 *   and the maximum number of new armies that can be produced
 */
async function getArmyProduceOptions(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let territories = await readSetup(gameState.setup + '/territories');
	let countrysetup = await readSetup(gameState.setup + '/countries');
	let armies = gameState.countryInfo[country].armies;
	if (!armies) {
		armies = [];
	}

	let unsatFactories = helper.getUnsatFactories(gameState.countryInfo, country);
	let t = [];
	for (let i in unsatFactories) {
		if (!territories[unsatFactories[i]].port) {
			t.push(unsatFactories[i]);
		}
	}
	return {
		items: t,
		limit: countrysetup[country].armyLimit - armies.length,
	};
}

/**
 * Builds a human-readable message describing the investor payout for the current country.
 * Calculates how much each player in the leadership chain will receive from the country's
 * treasury based on their stock ownership.
 *
 * Called from: ProposalApp to display the investor payout preview when the "Investor" wheel
 * action is selected.
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<string>} A message like "The investor will pay out $3 to Alice, $2 to Bob."
 */
async function getInvestorMessage(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let s = 'The investor will pay out ';

	let amt = helper.getInvestorPayout(gameState, country, context.name);
	let msgs = amt.map((x) => '$' + x[1] + ' to ' + x[0]);
	s += msgs.join(', ');
	s += '.';
	return s;
}

/**
 * Builds a human-readable message describing the taxation outcome for the current country.
 * Includes the points earned, money going into the treasury, and how greatness (tax split)
 * is distributed among leadership players based on stock ownership.
 *
 * Called from: ProposalApp to display the taxation preview when the "Taxation" wheel action
 * is selected.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<string>} A message like "Austria will tax for 3 points, and $2 into its
 *   treasury. Greatness is distributed $1 to Alice, $1 to Bob."
 */
async function getTaxMessage(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;

	let taxInfo = await helper.getTaxInfo(gameState.countryInfo, gameState.playerInfo, country);
	let s =
		country +
		' will tax for ' +
		taxInfo.points +
		' points, and $' +
		taxInfo.money +
		' into its treasury. Greatness is distributed ';
	let splits = taxInfo['tax split'].map((x) => '$' + x[1] + ' to ' + x[0]).join(', ');
	if (splits === '') {
		splits = 'to no one';
	}
	s += splits + '.';

	return s;
}

/**
 * Returns the legal sea destinations for a fleet from its current position.
 * If the fleet is on a port territory, it can move to its own territory or the adjacent sea.
 * If on a sea territory, it can stay in place or move to any adjacent sea.
 *
 * Called from: getFleetOptions to compute movement choices for each fleet.
 *
 * @param {string} fleet - The territory name where the fleet currently is
 * @param {Object} territorySetup - The territory configuration from the game setup
 * @returns {string[]} Array of territory names the fleet can move to (includes current position)
 */
function getAdjacentSeas(fleet, territorySetup) {
	if (territorySetup[fleet].port) {
		return [fleet, territorySetup[fleet].port];
	}
	let adjacencies = territorySetup[fleet].adjacencies;
	let ans = [fleet];
	for (let a of adjacencies) {
		if (territorySetup[a].sea) {
			ans.push(a);
		}
	}
	return ans;
}

/**
 * Returns the movement options for all fleets of the current country.
 * Each fleet gets a list of adjacent sea territories it can move to (including staying in place).
 *
 * Called from: ProposalApp when the player selects an "L-Maneuver" or "R-Maneuver" wheel action
 * to populate the fleet movement dropdowns.
 *
 * @bug Marked as needing fixes (see "fix" comment in source).
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Array<[string, string[]]>>} Array of [currentTerritory, destinationOptions] pairs,
 *   one per fleet
 */
async function getFleetOptions(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let territorySetup = await readSetup(gameState.setup + '/territories');

	let choices = [];
	for (let fleet of gameState.countryInfo[country].fleets || []) {
		let opts = getAdjacentSeas(fleet.territory, territorySetup);
		choices.push([fleet.territory, opts]);
	}

	return choices;
}

/**
 * Returns the war/peace action options available at each territory after fleets move.
 * For each territory that contains hostile enemy units, the player can choose to declare
 * war on a specific enemy unit or choose peace. Previously chosen war actions are removed
 * from the available options to prevent duplicate selections.
 *
 * Called from: ProposalApp during maneuver to populate the fleet peace/war action dropdowns,
 * and from allFleetsMoved to validate that all fleet actions are complete.
 *
 * @bug Marked as needing fixes (see "fix" comment in source).
 *
 * @param {Object} context - UserContext with { game, fleetMan }
 * @param {string} context.game - The Firebase game ID
 * @param {Array<ManeuverTuple>} context.fleetMan - Current fleet maneuver selections
 * @returns {Promise<Object<string, string[]>>} Map of territory name to available actions
 *   (e.g. { "North Sea": ["war France fleet", "peace"] })
 */
async function getFleetPeaceOptions(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let territorySetup = await readSetup(gameState.setup + '/territories');
	let damage = {};

	for (let territory in territorySetup) {
		damage[territory] = [];
	}
	for (let c in gameState.countryInfo) {
		if (c !== country) {
			for (let a of gameState.countryInfo[c].armies || []) {
				if (a.hostile) {
					damage[a.territory].push(c + ' army');
				}
			}
			for (let f of gameState.countryInfo[c].fleets || []) {
				if (f.hostile) {
					damage[f.territory].push(c + ' fleet');
				}
			}
		}
	}
	let d = {};
	for (let key in damage) {
		if (damage[key].length !== 0) {
			d[key] = damage[key].map((x) => 'war ' + x);
			d[key].push(MANEUVER_ACTIONS.PEACE);
		}
	}
	// remove chosen options
	for (let i in context.fleetMan) {
		if (context.fleetMan[i][1] && context.fleetMan[i][2] && context.fleetMan[i][2] !== MANEUVER_ACTIONS.PEACE) {
			d[context.fleetMan[i][1]].splice(d[context.fleetMan[i][1]].indexOf(context.fleetMan[i][2]), 1);
		}
	}

	return d;
}

/**
 * Checks whether all fleets have been assigned a valid destination and, where required,
 * a peace/war action. Returns true only if every fleet has a destination selected and
 * any territory with more than one peace option has had one chosen.
 *
 * Called from: ProposalApp to determine if the fleet maneuver phase is complete and
 * the army maneuver phase can begin.
 *
 * @param {Object} context - UserContext with { game, fleetMan }
 * @param {string} context.game - The Firebase game ID
 * @param {Array<ManeuverTuple>} context.fleetMan - Current fleet maneuver selections
 * @returns {Promise<boolean>} True if all fleet movements and actions are fully specified
 */
async function allFleetsMoved(context) {
	let peaceOptions = await getFleetPeaceOptions(context);
	let legal = true;
	for (let i in context.fleetMan) {
		if (!context.fleetMan[i][1]) {
			legal = false;
		}
		if (context.fleetMan[i][2] === '' && context.fleetMan[i][1]) {
			if ((peaceOptions[context.fleetMan[i][1]] || []).length > 1) {
				legal = false;
			}
		}
	}
	return legal;
}

/**
 * Computes the "distance-0" reachable set from an army's position using BFS.
 * An army can traverse freely through connected home territories and through
 * friendly-controlled seas (where a fleet has chosen peace or move). This builds
 * the set of territories reachable without crossing enemy lines.
 *
 * Called from: getAdjacentLands to determine the base reachable zone for army movement.
 *
 * @param {string} army - The starting territory name
 * @param {Object} territorySetup - The territory configuration from the game setup
 * @param {string} country - The country that owns the army
 * @param {Object} context - UserContext with { fleetMan }
 * @param {Array<ManeuverTuple>} context.fleetMan - Current fleet maneuver selections
 *   (used to check if seas are controlled by friendly fleets)
 * @returns {string[]} Array of territory names reachable at distance 0 (connected home + friendly seas)
 */
function getD0(army, territorySetup, country, context) {
	let d0 = [army];
	let q = [army];

	while (q.length > 0) {
		let a = q.pop();
		let adjacencies = territorySetup[a].adjacencies;
		for (let adj of adjacencies) {
			let sea = false;
			if (territorySetup[adj].sea) {
				for (let x of context.fleetMan) {
					if (x[1] === adj && (x[2] === MANEUVER_ACTIONS.PEACE || x[2] === MANEUVER_ACTIONS.MOVE)) {
						sea = true;
					}
				}
			}
			if ((territorySetup[adj].country === country && territorySetup[a].country === country) || sea) {
				if (!d0.includes(adj)) {
					d0.push(adj);
					q.push(adj);
				}
			}
		}
	}

	return d0;
}

/**
 * Returns all land territories an army can reach from its current position.
 * Uses getD0 to compute the connected reachable zone, then expands one step
 * outward from every territory in that zone to find adjacent lands (including
 * through friendly-fleet-controlled seas). Deduplicates the result.
 *
 * Called from: getArmyOptions to determine the legal movement destinations for each army.
 *
 * @param {string} army - The territory name where the army currently is
 * @param {Object} territorySetup - The territory configuration from the game setup
 * @param {string} country - The country that owns the army
 * @param {Object} context - UserContext with { fleetMan }
 * @param {Array<ManeuverTuple>} context.fleetMan - Current fleet maneuver selections
 * @returns {string[]} Array of unique land territory names the army can move to
 */
function getAdjacentLands(army, territorySetup, country, context) {
	let d0 = getD0(army, territorySetup, country, context);
	let ans = [];

	for (let t of d0) {
		let adj = [...territorySetup[t].adjacencies];
		adj.push(t);

		for (let a of adj) {
			let d0a = getD0(a, territorySetup, country, context);
			for (let elt of d0a) {
				if (!territorySetup[elt].sea) {
					ans.push(elt);
				}
			}
		}
	}
	ans = Array.from(new Set(ans));
	return ans;
}

/**
 * Returns the movement options for all armies of the current country.
 * Each army gets a list of reachable land territories it can move to, computed via
 * getAdjacentLands which considers connected home territories and fleet-controlled seas.
 *
 * Called from: ProposalApp when the player selects an "L-Maneuver" or "R-Maneuver" wheel
 * action to populate the army movement dropdowns (after fleets are moved).
 *
 * @param {Object} context - UserContext with { game, fleetMan }
 * @param {string} context.game - The Firebase game ID
 * @param {Array<ManeuverTuple>} context.fleetMan - Current fleet maneuver selections
 * @returns {Promise<Array<[string, string[]]>>} Array of [currentTerritory, destinationOptions] pairs,
 *   one per army
 */
async function getArmyOptions(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let territorySetup = await readSetup(gameState.setup + '/territories');

	let choices = [];
	for (let army of gameState.countryInfo[country].armies || []) {
		let opts = getAdjacentLands(army.territory, territorySetup, country, context);
		choices.push([army.territory, opts]);
	}

	return choices;
}

/**
 * Returns the war/peace/hostile action options for each territory where armies have conflict potential.
 * For each territory, builds a list of possible actions:
 * - "war {country} {unitType}" for each enemy unit present
 * - "peace" for entering peacefully
 * - "hostile" if the territory belongs to another country
 * - "blow up {country}" if the territory has an enemy factory
 *
 * Previously chosen actions from both fleetMan and armyMan are removed to prevent duplicates.
 *
 * Called from: ProposalApp during maneuver to populate army peace/war action dropdowns,
 * and from allArmiesMoved to validate that all army actions are complete.
 *
 * @bug Marked as needing fixes (see "fix" comment in source).
 *
 * @param {Object} context - UserContext with { game, fleetMan, armyMan }
 * @param {string} context.game - The Firebase game ID
 * @param {Array<ManeuverTuple>} context.fleetMan - Current fleet maneuver selections
 * @param {Array<ManeuverTuple>} context.armyMan - Current army maneuver selections
 * @returns {Promise<Object<string, string[]>>} Map of territory name to available actions
 */
async function getArmyPeaceOptions(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let territorySetup = await readSetup(gameState.setup + '/territories');
	let damage = {};

	for (let territory in territorySetup) {
		damage[territory] = [];
	}
	for (let c in gameState.countryInfo) {
		if (c !== country) {
			for (let a of gameState.countryInfo[c].armies || []) {
				damage[a.territory].push(c + ' army');
			}
			for (let f of gameState.countryInfo[c].fleets || []) {
				damage[f.territory].push(c + ' fleet');
			}
		}
	}
	let d = {};
	for (let key in damage) {
		d[key] = damage[key].map((x) => 'war ' + x);
		d[key].push(MANEUVER_ACTIONS.PEACE);

		if (territorySetup[key].country && territorySetup[key].country !== country) {
			// Check if this territory holds the target country's last operational factory
			// (a factory is "saturated"/non-operational if a hostile army from another country sits on it)
			let targetName = territorySetup[key].country;
			let isLastFactory = false;
			if (gameState.countryInfo[targetName].factories.includes(key)) {
				let opCount = 0;
				for (let f of gameState.countryInfo[targetName].factories) {
					let occ = false;
					for (let c in gameState.countryInfo) {
						if (c !== targetName) {
							for (let a of gameState.countryInfo[c].armies || []) {
								if (a.hostile && a.territory === f) occ = true;
							}
						}
					}
					if (!occ) opCount++;
				}
				if (opCount <= 1) isLastFactory = true;
			}
			if (!isLastFactory) {
				d[key].push(MANEUVER_ACTIONS.HOSTILE);
			}
		}
		if (
			territorySetup[key].country &&
			territorySetup[key].country !== country &&
			gameState.countryInfo[territorySetup[key].country].factories.includes(key)
		) {
			// Blow up requires 3 armies at the territory AND target must have >1 operational factory
			let targetName = territorySetup[key].country;
			let targetFactories = gameState.countryInfo[targetName].factories;
			let operationalCount = 0;
			for (let f of targetFactories) {
				let occupied = false;
				for (let c in gameState.countryInfo) {
					if (c !== targetName) {
						for (let a of gameState.countryInfo[c].armies || []) {
							if (a.hostile && a.territory === f) occupied = true;
						}
					}
				}
				if (!occupied) operationalCount++;
			}
			let armiesAssigned = (context.armyMan || []).filter((m) => m[1] === key).length;
			let ownArmiesThere = (gameState.countryInfo[country].armies || []).filter((a) => a.territory === key).length;
			if (operationalCount > 1 && armiesAssigned + ownArmiesThere + 1 >= 3) {
				d[key].push('blow up ' + territorySetup[key].country);
			}
		}
	}
	// remove chosen options
	for (let i in context.fleetMan) {
		if (
			context.fleetMan[i][1] &&
			context.fleetMan[i][2] &&
			context.fleetMan[i][2] !== MANEUVER_ACTIONS.PEACE &&
			context.fleetMan[i][2] !== MANEUVER_ACTIONS.HOSTILE &&
			context.fleetMan[i][2].substring(0, 7) !== MANEUVER_ACTIONS.BLOW_UP_PREFIX
		) {
			d[context.fleetMan[i][1]].splice(d[context.fleetMan[i][1]].indexOf(context.fleetMan[i][2]), 1);
		}
	}
	for (let i in context.armyMan) {
		if (
			context.armyMan[i][1] &&
			context.armyMan[i][2] &&
			context.armyMan[i][2] !== MANEUVER_ACTIONS.PEACE &&
			context.armyMan[i][2] !== MANEUVER_ACTIONS.HOSTILE &&
			context.armyMan[i][2].substring(0, 7) !== MANEUVER_ACTIONS.BLOW_UP_PREFIX
		) {
			d[context.armyMan[i][1]].splice(d[context.armyMan[i][1]].indexOf(context.armyMan[i][2]), 1);
		}
	}

	return d;
}

/**
 * Checks whether all armies have been assigned a valid destination and, where required,
 * a peace/war/hostile action. Returns true only if every army has a destination selected
 * and any territory with more than one peace option has had one chosen.
 *
 * Called from: ProposalApp to determine if the army maneuver phase is complete and
 * the proposal can be submitted.
 *
 * @param {Object} context - UserContext with { game, armyMan, fleetMan }
 * @param {string} context.game - The Firebase game ID
 * @param {Array<ManeuverTuple>} context.armyMan - Current army maneuver selections
 * @param {Array<ManeuverTuple>} context.fleetMan - Current fleet maneuver selections
 * @returns {Promise<boolean>} True if all army movements and actions are fully specified
 */
async function allArmiesMoved(context) {
	let peaceOptions = await getArmyPeaceOptions(context);
	let legal = true;
	for (let i in context.armyMan) {
		if (!context.armyMan[i][1]) {
			legal = false;
		}
		if (context.armyMan[i][2] === '' && context.armyMan[i][1]) {
			if ((peaceOptions[context.armyMan[i][1]] || []).length > 1) {
				legal = false;
			}
		}
	}
	return legal;
}

/**
 * Returns the available import options for the current country, including eligible territories
 * for armies and fleets, and the remaining unit capacity for each type.
 * Armies can be imported to unsaturated non-port home territories; fleets to port territories.
 * Up to 3 units can be imported per Import action.
 *
 * Called from: ProposalApp when the player selects the "Import" wheel action to populate
 * the import unit type and territory dropdowns.
 *
 * @bug Marked as needing fixes (see "fix" comment in source).
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<{labels: string[], options: {army: string[], fleet: string[]}, limits: {army: number, fleet: number}}>}
 *   Object containing:
 *   - labels: Display labels for the 3 import slots
 *   - options.army: Territory names eligible for army imports
 *   - options.fleet: Territory names eligible for fleet imports
 *   - limits.army: Remaining army capacity
 *   - limits.fleet: Remaining fleet capacity
 */
async function getImportOptions(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let countrysetup = await readSetup(gameState.setup + '/countries');

	let armyLocs = await helper.getUnsatTerritories(gameState.countryInfo, country, false, context);
	let fleetLocs = await helper.getUnsatTerritories(gameState.countryInfo, country, true, context);

	let armies = gameState.countryInfo[country].armies;
	if (!armies) {
		armies = [];
	}

	let fleets = gameState.countryInfo[country].fleets;
	if (!fleets) {
		fleets = [];
	}

	return {
		labels: ['Import #1', 'Import #2', 'Import #3'],
		options: {
			army: armyLocs,
			fleet: fleetLocs,
		},
		limits: {
			army: countrysetup[country].armyLimit - armies.length,
			fleet: countrysetup[country].fleetLimit - fleets.length,
		},
	};
}

/**
 * Computes a "virtual" board state by applying completed maneuver moves
 * to the original countryInfo. This is used during continue-man mode to
 * let subsequent unit selections see the effect of earlier moves in the
 * same maneuver, without modifying the actual game state.
 *
 * @param {Object} gameState - The current game state (not mutated)
 * @returns {Object<string, CountryInfo>} A deep copy of countryInfo with completed moves applied
 */
function getVirtualState(gameState) {
	let countryInfo = JSON.parse(JSON.stringify(gameState.countryInfo));
	let cm = gameState.currentManeuver;
	if (!cm) {
		return countryInfo;
	}
	let country = cm.country;

	// Apply completed fleet moves
	let virtualFleets = [];
	for (let i = 0; i < (cm.pendingFleets || []).length; i++) {
		if (i < (cm.completedFleetMoves || []).length) {
			let move = cm.completedFleetMoves[i];
			let split = move[2].split(' ');
			if (split[0] === MANEUVER_ACTIONS.WAR_PREFIX) {
				// War: attacking fleet is removed, target unit is removed
				if (split[2] === 'fleet') {
					let targetFleets = countryInfo[split[1]].fleets || [];
					for (let j = 0; j < targetFleets.length; j++) {
						if (targetFleets[j].territory === move[1]) {
							targetFleets.splice(j, 1);
							break;
						}
					}
				} else {
					let targetArmies = countryInfo[split[1]].armies || [];
					for (let j = 0; j < targetArmies.length; j++) {
						if (targetArmies[j].territory === move[1]) {
							targetArmies.splice(j, 1);
							break;
						}
					}
				}
				// Attacking fleet is destroyed — don't add to virtualFleets
			} else {
				// Normal move or peace — fleet survives and moves to destination
				virtualFleets.push({ territory: move[1], hostile: true });
			}
		} else {
			// Not yet moved — keep at original position
			virtualFleets.push({ ...cm.pendingFleets[i] });
		}
	}
	countryInfo[country].fleets = virtualFleets;

	// Apply completed army moves
	let virtualArmies = [];
	for (let i = 0; i < (cm.pendingArmies || []).length; i++) {
		if (i < (cm.completedArmyMoves || []).length) {
			let move = cm.completedArmyMoves[i];
			let split = move[2].split(' ');
			if (split[0] === MANEUVER_ACTIONS.WAR_PREFIX) {
				// War: attacking army and target unit both removed
				if (split[2] === 'fleet') {
					let targetFleets = countryInfo[split[1]].fleets || [];
					for (let j = 0; j < targetFleets.length; j++) {
						if (targetFleets[j].territory === move[1]) {
							targetFleets.splice(j, 1);
							break;
						}
					}
				} else {
					let targetArmies = countryInfo[split[1]].armies || [];
					for (let j = 0; j < targetArmies.length; j++) {
						if (targetArmies[j].territory === move[1]) {
							targetArmies.splice(j, 1);
							break;
						}
					}
				}
				// Attacking army is destroyed
			} else if (split[0] === 'blow') {
				// Blow up factory: attacker destroyed, factory removed
				// (2 additional armies consumed in post-processing below)
				let targetCountry = split[2];
				let factories = countryInfo[targetCountry].factories || [];
				let idx = factories.indexOf(move[1]);
				if (idx !== -1) {
					factories.splice(idx, 1);
				}
				// Attacking army is destroyed (not added to virtualArmies)
			} else {
				// Normal move, peace, or hostile — army survives
				let hostile = true;
				if (split[0] === MANEUVER_ACTIONS.PEACE) {
					hostile = false;
				}
				virtualArmies.push({ territory: move[1], hostile: hostile });
			}
		} else {
			// Not yet moved — keep at original position
			virtualArmies.push({ ...cm.pendingArmies[i] });
		}
	}
	// Post-processing: blow-up consumes 2 additional armies at each blow-up territory
	for (let move of cm.completedArmyMoves || []) {
		let split = (move[2] || '').split(' ');
		if (split[0] === 'blow') {
			let destroyed = 0;
			for (let j = virtualArmies.length - 1; j >= 0 && destroyed < 2; j--) {
				if (virtualArmies[j].territory === move[1]) {
					virtualArmies.splice(j, 1);
					destroyed++;
				}
			}
		}
	}
	countryInfo[country].armies = virtualArmies;

	return countryInfo;
}

/**
 * Returns the movement options for the CURRENT pending unit in the step-by-step
 * maneuver flow. Computes options from the virtual state (original positions
 * adjusted by completed moves).
 *
 * @param {Object} context - UserContext with { game }
 * @returns {Promise<string[]>} Array of territory names the current unit can move to
 */
async function getCurrentUnitOptions(context) {
	let gameState = await readGameState(context);
	let cm = gameState.currentManeuver;
	if (!cm) return [];

	let territorySetup = await readSetup(gameState.setup + '/territories');

	let virtualCountryInfo = getVirtualState(gameState);

	if (cm.phase === 'fleet') {
		// Get current fleet from virtual state
		let virtualFleets = virtualCountryInfo[cm.country].fleets || [];
		let fleetIndex = cm.unitIndex;
		// Count surviving fleets from completed moves to find the right index
		let survivingIndex = 0;
		let targetFleet = null;
		for (let i = 0; i < (cm.pendingFleets || []).length; i++) {
			if (i < (cm.completedFleetMoves || []).length) {
				let move = cm.completedFleetMoves[i];
				let split = move[2].split(' ');
				if (split[0] !== MANEUVER_ACTIONS.WAR_PREFIX) {
					survivingIndex++;
				}
			} else if (i === fleetIndex) {
				targetFleet = virtualFleets[survivingIndex];
				break;
			} else {
				survivingIndex++;
			}
		}
		if (!targetFleet) return [];
		return getAdjacentSeas(targetFleet.territory, territorySetup);
	} else {
		// Army phase — need completed fleet moves as context for BFS
		// Build virtual fleetMan from completed fleet moves (for getD0/getAdjacentLands)
		let virtualFleetMan = (cm.completedFleetMoves || []).map((move) => [move[0], move[1], move[2]]);

		let virtualArmies = virtualCountryInfo[cm.country].armies || [];
		let armyIndex = cm.unitIndex;
		// Count surviving armies from completed moves
		let survivingIndex = 0;
		let targetArmy = null;
		for (let i = 0; i < (cm.pendingArmies || []).length; i++) {
			if (i < (cm.completedArmyMoves || []).length) {
				let move = cm.completedArmyMoves[i];
				let split = move[2].split(' ');
				if (split[0] !== MANEUVER_ACTIONS.WAR_PREFIX && split[0] !== 'blow') {
					survivingIndex++;
				}
			} else if (i === armyIndex) {
				targetArmy = virtualArmies[survivingIndex];
				break;
			} else {
				survivingIndex++;
			}
		}
		if (!targetArmy) return [];

		let virtualContext = { fleetMan: virtualFleetMan };
		return getAdjacentLands(targetArmy.territory, territorySetup, cm.country, virtualContext);
	}
}

/**
 * Returns the peace/war/hostile/blow-up action options for the current unit's
 * selected destination, based on the virtual state. Must account for units
 * destroyed by earlier war moves in the same maneuver.
 *
 * @param {Object} context - UserContext with { game, maneuverDest }
 * @returns {Promise<string[]>} Array of action strings (e.g. "war France fleet", "peace", "hostile")
 */
async function getCurrentUnitActionOptions(context) {
	let gameState = await readGameState(context);
	let cm = gameState.currentManeuver;
	if (!cm || !context.maneuverDest) return [];

	let territorySetup = await readSetup(gameState.setup + '/territories');

	let virtualCountryInfo = getVirtualState(gameState);
	let country = cm.country;
	let dest = context.maneuverDest;
	let actions = [];

	// Check for enemy units at the destination
	for (let c in virtualCountryInfo) {
		if (c !== country) {
			for (let f of virtualCountryInfo[c].fleets || []) {
				if (f.hostile && f.territory === dest) {
					actions.push('war ' + c + ' fleet');
				}
			}
			for (let a of virtualCountryInfo[c].armies || []) {
				if (a.territory === dest) {
					actions.push('war ' + c + ' army');
				}
			}
		}
	}

	if (cm.phase === 'fleet') {
		// Fleets can war or peace
		if (actions.length > 0) {
			actions.push(MANEUVER_ACTIONS.PEACE);
		}
	} else {
		// Armies: when enemy units present → war + peace only
		// When no enemy units but foreign territory → peace + hostile + blow up
		let isForeign = territorySetup[dest].country && territorySetup[dest].country !== country;
		if (actions.length > 0) {
			// Enemy units present: can declare war or peace
			actions.push(MANEUVER_ACTIONS.PEACE);
		} else if (isForeign) {
			// No enemy units but foreign territory: peace, hostile, or blow up
			actions.push(MANEUVER_ACTIONS.PEACE);
			// Check if this territory holds the target country's last operational factory
			// (a factory is "saturated"/non-operational if a hostile army from another country sits on it)
			let targetCountryName = territorySetup[dest].country;
			let isLastFactory = false;
			if (virtualCountryInfo[targetCountryName].factories.includes(dest)) {
				let opCount = 0;
				for (let f of virtualCountryInfo[targetCountryName].factories) {
					let occ = false;
					for (let c in virtualCountryInfo) {
						if (c !== targetCountryName) {
							for (let a of virtualCountryInfo[c].armies || []) {
								if (a.hostile && a.territory === f) occ = true;
							}
						}
					}
					if (!occ) opCount++;
				}
				if (opCount <= 1) isLastFactory = true;
			}
			if (!isLastFactory) {
				actions.push(MANEUVER_ACTIONS.HOSTILE);
			}
			// Blow up factory (requires 3 armies AND target must have >1 operational factory)
			if (virtualCountryInfo[targetCountryName].factories.includes(dest)) {
				let operationalCount = 0;
				for (let f of virtualCountryInfo[targetCountryName].factories) {
					let occupied = false;
					for (let c in virtualCountryInfo) {
						if (c !== targetCountryName) {
							for (let a of virtualCountryInfo[c].armies || []) {
								if (a.hostile && a.territory === f) occupied = true;
							}
						}
					}
					if (!occupied) operationalCount++;
				}
				let friendlyArmiesAtDest = (virtualCountryInfo[country].armies || []).filter(
					(a) => a.territory === dest
				).length;
				if (operationalCount > 1 && friendlyArmiesAtDest + 1 >= 3) {
					actions.push('blow up ' + territorySetup[dest].country);
				}
			}
		}
	}

	return actions;
}

// ---------------------------------------------------------------------------
// Plan-based virtual state functions (for ManeuverPlannerApp client-side planning)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ManeuverPlan
 * @property {string} country - The maneuvering country
 * @property {Object[]} pendingFleets - Original fleet positions [{territory, hostile}]
 * @property {Object[]} pendingArmies - Original army positions [{territory, hostile}]
 * @property {Array<[string, string, string]>} fleetTuples - Planned fleet moves [origin, dest, action]
 * @property {Array<[string, string, string]>} armyTuples - Planned army moves [origin, dest, action]
 */

/**
 * Computes a "virtual" board state by applying planned maneuver moves
 * to the original countryInfo. This is the plan-based equivalent of
 * getVirtualState — it takes explicit move arrays instead of reading
 * from gameState.currentManeuver.
 *
 * @param {Object<string, CountryInfo>} countryInfo - The original countryInfo (not mutated)
 * @param {ManeuverPlan} plan - The maneuver plan
 * @returns {Object<string, CountryInfo>} A deep copy of countryInfo with planned moves applied
 */
function getVirtualStateFromPlans(countryInfo, plan) {
	let virtual = JSON.parse(JSON.stringify(countryInfo));
	let country = plan.country;

	// Apply fleet tuples
	let virtualFleets = [];
	for (let i = 0; i < (plan.pendingFleets || []).length; i++) {
		if (i < (plan.fleetTuples || []).length && plan.fleetTuples[i][1]) {
			let move = plan.fleetTuples[i];
			let action = move[2] || '';
			let split = action.split(' ');
			if (split[0] === MANEUVER_ACTIONS.WAR_PREFIX) {
				// War: attacking fleet destroyed, target unit removed
				if (split[2] === 'fleet') {
					let targetFleets = virtual[split[1]].fleets || [];
					for (let j = 0; j < targetFleets.length; j++) {
						if (targetFleets[j].territory === move[1]) {
							targetFleets.splice(j, 1);
							break;
						}
					}
				} else {
					let targetArmies = virtual[split[1]].armies || [];
					for (let j = 0; j < targetArmies.length; j++) {
						if (targetArmies[j].territory === move[1]) {
							targetArmies.splice(j, 1);
							break;
						}
					}
				}
				// Attacking fleet is destroyed — don't add to virtualFleets
			} else {
				// Normal move or peace — fleet survives at destination
				virtualFleets.push({ territory: move[1], hostile: true });
			}
		} else {
			// Not yet planned — keep at original position
			virtualFleets.push({ ...plan.pendingFleets[i] });
		}
	}
	virtual[country].fleets = virtualFleets;

	// Apply army tuples
	let virtualArmies = [];
	for (let i = 0; i < (plan.pendingArmies || []).length; i++) {
		if (i < (plan.armyTuples || []).length && plan.armyTuples[i][1]) {
			let move = plan.armyTuples[i];
			let action = move[2] || '';
			let split = action.split(' ');
			if (split[0] === MANEUVER_ACTIONS.WAR_PREFIX) {
				// War: both units destroyed
				if (split[2] === 'fleet') {
					let targetFleets = virtual[split[1]].fleets || [];
					for (let j = 0; j < targetFleets.length; j++) {
						if (targetFleets[j].territory === move[1]) {
							targetFleets.splice(j, 1);
							break;
						}
					}
				} else {
					let targetArmies = virtual[split[1]].armies || [];
					for (let j = 0; j < targetArmies.length; j++) {
						if (targetArmies[j].territory === move[1]) {
							targetArmies.splice(j, 1);
							break;
						}
					}
				}
				// Attacking army is destroyed
			} else if (split[0] === 'blow') {
				// Blow up: attacker destroyed, factory removed
				let targetCountry = split[2];
				let factories = virtual[targetCountry].factories || [];
				let idx = factories.indexOf(move[1]);
				if (idx !== -1) {
					factories.splice(idx, 1);
				}
			} else {
				// Normal move, peace, or hostile — army survives
				let hostile = action !== MANEUVER_ACTIONS.PEACE;
				virtualArmies.push({ territory: move[1], hostile: hostile });
			}
		} else {
			// Not yet planned — keep at original position
			virtualArmies.push({ ...plan.pendingArmies[i] });
		}
	}
	// Post-processing: blow-up consumes 2 additional armies at each blow-up territory
	for (let move of plan.armyTuples || []) {
		let split = (move[2] || '').split(' ');
		if (split[0] === 'blow') {
			let destroyed = 0;
			for (let j = virtualArmies.length - 1; j >= 0 && destroyed < 2; j--) {
				if (virtualArmies[j].territory === move[1]) {
					virtualArmies.splice(j, 1);
					destroyed++;
				}
			}
		}
	}
	virtual[country].armies = virtualArmies;

	return virtual;
}

/**
 * Get destination options for a unit at a given index, using explicit plan arrays
 * to compute the virtual state. Plan-based equivalent of getCurrentUnitOptions.
 *
 * @param {Object} context - UserContext with { game }
 * @param {ManeuverPlan} plan - The maneuver plan
 * @param {string} phase - 'fleet' or 'army'
 * @param {number} unitIndex - Index of the unit in pendingFleets/pendingArmies
 * @returns {Promise<string[]>} Array of destination territory names
 */
async function getUnitOptionsFromPlans(context, plan, phase, unitIndex) {
	let gameState = await readGameState(context);
	let territorySetup = await readSetup(gameState.setup + '/territories');
	let country = plan.country;

	// Build partial plan: apply moves only up to (but not including) unitIndex
	let partialPlan = {
		country: country,
		pendingFleets: plan.pendingFleets,
		pendingArmies: plan.pendingArmies,
		fleetTuples: phase === 'fleet' ? plan.fleetTuples.slice(0, unitIndex) : plan.fleetTuples,
		armyTuples: phase === 'army' ? plan.armyTuples.slice(0, unitIndex) : [],
	};

	let virtualCountryInfo = getVirtualStateFromPlans(gameState.countryInfo, partialPlan);

	if (phase === 'fleet') {
		let virtualFleets = virtualCountryInfo[country].fleets || [];
		// Find the surviving fleet at this index — earlier war moves may have
		// reduced the virtual fleet array
		let survivingIndex = 0;
		for (let i = 0; i < (plan.pendingFleets || []).length; i++) {
			if (i < unitIndex) {
				let tuple = plan.fleetTuples[i];
				if (tuple && tuple[1]) {
					let split = (tuple[2] || '').split(' ');
					if (split[0] !== MANEUVER_ACTIONS.WAR_PREFIX) {
						survivingIndex++;
					}
				} else {
					survivingIndex++;
				}
			} else if (i === unitIndex) {
				break;
			} else {
				survivingIndex++;
			}
		}
		let targetFleet = virtualFleets[survivingIndex];
		if (!targetFleet) return [];
		return getAdjacentSeas(targetFleet.territory, territorySetup);
	} else {
		// Army phase — build virtual fleetMan from all fleet tuples
		let virtualFleetMan = (plan.fleetTuples || []).map((t) => [t[0], t[1], t[2]]);

		let virtualArmies = virtualCountryInfo[country].armies || [];
		let survivingIndex = 0;
		for (let i = 0; i < (plan.pendingArmies || []).length; i++) {
			if (i < unitIndex) {
				let tuple = plan.armyTuples[i];
				if (tuple && tuple[1]) {
					let split = (tuple[2] || '').split(' ');
					if (split[0] !== MANEUVER_ACTIONS.WAR_PREFIX && split[0] !== 'blow') {
						survivingIndex++;
					}
				} else {
					survivingIndex++;
				}
			} else if (i === unitIndex) {
				break;
			} else {
				survivingIndex++;
			}
		}
		let targetArmy = virtualArmies[survivingIndex];
		if (!targetArmy) return [];

		let virtualContext = { fleetMan: virtualFleetMan };
		return getAdjacentLands(targetArmy.territory, territorySetup, country, virtualContext);
	}
}

/**
 * Get action options for a unit at a specific destination, using virtual state
 * from plan arrays. Plan-based equivalent of getCurrentUnitActionOptions.
 *
 * Returns a per-country breakdown when multiple enemy countries have units at
 * the destination, or a flat array for simple cases.
 *
 * @param {Object} context - UserContext with { game }
 * @param {ManeuverPlan} plan - The maneuver plan
 * @param {string} phase - 'fleet' or 'army'
 * @param {number} unitIndex - Index of the unit
 * @param {string} destination - The selected destination territory
 * @returns {Promise<string[] | {countries: Array<{country: string, units: string[], actions: string[]}>, otherActions: string[]}>}
 *   Flat array for simple cases, or per-country object for multi-country destinations
 */
async function getUnitActionOptionsFromPlans(context, plan, phase, unitIndex, destination) {
	let gameState = await readGameState(context);
	let territorySetup = await readSetup(gameState.setup + '/territories');
	let country = plan.country;

	// Build partial plan up to (but not including) unitIndex
	let partialPlan = {
		country: country,
		pendingFleets: plan.pendingFleets,
		pendingArmies: plan.pendingArmies,
		fleetTuples: phase === 'fleet' ? plan.fleetTuples.slice(0, unitIndex) : plan.fleetTuples,
		armyTuples: phase === 'army' ? plan.armyTuples.slice(0, unitIndex) : [],
	};

	let virtualCountryInfo = getVirtualStateFromPlans(gameState.countryInfo, partialPlan);

	// Build per-country breakdown of enemy units at destination
	let countriesAtDest = {};
	for (let c in virtualCountryInfo) {
		if (c !== country) {
			let units = [];
			for (let f of virtualCountryInfo[c].fleets || []) {
				if (f.hostile && f.territory === destination) {
					units.push('fleet');
				}
			}
			for (let a of virtualCountryInfo[c].armies || []) {
				if (a.territory === destination) {
					units.push('army');
				}
			}
			if (units.length > 0) {
				countriesAtDest[c] = units;
			}
		}
	}

	let enemyCountries = Object.keys(countriesAtDest);

	if (phase === 'fleet') {
		if (enemyCountries.length > 1) {
			// Multi-country: return per-country breakdown
			let countries = enemyCountries.map((c) => ({
				country: c,
				units: countriesAtDest[c],
				actions: countriesAtDest[c].map((u) => 'war ' + c + ' ' + u).concat([MANEUVER_ACTIONS.PEACE]),
			}));
			return { countries: countries, otherActions: [] };
		} else if (enemyCountries.length === 1) {
			let actions = [];
			let c = enemyCountries[0];
			for (let u of countriesAtDest[c]) {
				actions.push('war ' + c + ' ' + u);
			}
			actions.push(MANEUVER_ACTIONS.PEACE);
			return actions;
		}
		return [];
	} else {
		// Army phase
		let isForeign = territorySetup[destination].country && territorySetup[destination].country !== country;

		if (enemyCountries.length > 1) {
			// Multi-country: per-country breakdown
			let countries = enemyCountries.map((c) => ({
				country: c,
				units: countriesAtDest[c],
				actions: countriesAtDest[c].map((u) => 'war ' + c + ' ' + u).concat([MANEUVER_ACTIONS.PEACE]),
			}));
			let otherActions = [];
			if (isForeign) {
				otherActions.push(MANEUVER_ACTIONS.HOSTILE);
			}
			return { countries: countries, otherActions: otherActions };
		} else if (enemyCountries.length === 1) {
			let actions = [];
			let c = enemyCountries[0];
			for (let u of countriesAtDest[c]) {
				actions.push('war ' + c + ' ' + u);
			}
			actions.push(MANEUVER_ACTIONS.PEACE);
			return actions;
		} else if (isForeign) {
			let actions = [MANEUVER_ACTIONS.PEACE, MANEUVER_ACTIONS.HOSTILE];
			// Blow up factory check
			let territoryOwner = territorySetup[destination].country;
			if (virtualCountryInfo[territoryOwner].factories.includes(destination)) {
				let friendlyArmiesAtDest = (virtualCountryInfo[country].armies || []).filter(
					(a) => a.territory === destination
				).length;
				if (friendlyArmiesAtDest + 1 >= 3) {
					actions.push('blow up ' + territoryOwner);
				}
			}
			return actions;
		}
		return [];
	}
}

export {
	getPreviousProposalMessage,
	getWheelOptions,
	getLocationOptions,
	getFleetProduceOptions,
	getArmyProduceOptions,
	getInvestorMessage,
	getTaxMessage,
	getFleetOptions,
	getFleetPeaceOptions,
	allFleetsMoved,
	getArmyOptions,
	getArmyPeaceOptions,
	allArmiesMoved,
	getImportOptions,
	getVirtualState,
	getCurrentUnitOptions,
	getCurrentUnitActionOptions,
	getAdjacentSeas,
	getAdjacentLands,
	getD0,
	getVirtualStateFromPlans,
	getUnitOptionsFromPlans,
	getUnitActionOptionsFromPlans,
};
