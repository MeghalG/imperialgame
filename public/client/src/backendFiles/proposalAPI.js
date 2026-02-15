import { database } from './firebase.js';
import * as helper from './helper.js';
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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let currentPos = gameState.countryInfo[country].wheelSpot;
	let money = gameState.playerInfo[context.name].money;
	let wheel = await database.ref(setup + '/wheel').once('value');
	wheel = wheel.val();
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
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let country = await database.ref('games/' + context.game + '/countryUp').once('value');
	country = country.val();
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let territories = await database.ref(setup + '/territories').once('value');
	territories = territories.val();
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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territories = await database.ref(setup + '/territories').once('value');
	territories = territories.val();
	let countrysetup = await database.ref(setup + '/countries').once('value');
	countrysetup = countrysetup.val();
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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territories = await database.ref(setup + '/territories').once('value');
	territories = territories.val();
	let countrysetup = await database.ref(setup + '/countries').once('value');
	countrysetup = countrysetup.val();
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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territorySetup = await database.ref(setup + '/territories').once('value');
	territorySetup = territorySetup.val();

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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territorySetup = await database.ref(setup + '/territories').once('value');
	territorySetup = territorySetup.val();
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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territorySetup = await database.ref(setup + '/territories').once('value');
	territorySetup = territorySetup.val();

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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territorySetup = await database.ref(setup + '/territories').once('value');
	territorySetup = territorySetup.val();
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
			d[key].push(MANEUVER_ACTIONS.HOSTILE);
		}
		if (
			territorySetup[key].country &&
			territorySetup[key].country !== country &&
			gameState.countryInfo[territorySetup[key].country].factories.includes(key)
		) {
			d[key].push('blow up ' + territorySetup[key].country);
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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let countrysetup = await database.ref(setup + '/countries').once('value');
	countrysetup = countrysetup.val();

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
};
