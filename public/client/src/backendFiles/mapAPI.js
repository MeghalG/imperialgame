import { database } from './firebase.js';
import * as helper from './helper.js';
import { readGameState } from './stateCache.js';

/**
 * Retrieves all military units (fleets and armies) across every country and returns them
 * grouped by territory with pixel coordinates for map rendering.
 * Each territory entry contains a 6-element array (one per country) where each element
 * is [fleetCount, hostileArmyCount, peacefulArmyCount].
 *
 * Called from: MapApp to render unit icons on the game map.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Array<[number[], number[][]]>>} Array of [unitCoords, countryUnitCounts] pairs.
 *   unitCoords is [x, y] pixel coordinates. countryUnitCounts is a 6-element array where
 *   index corresponds to country order, each element being [fleets, hostileArmies, peacefulArmies].
 */
async function getUnits(context) {
	let un = [];
	let countries = await helper.getCountries(context);
	let gameState = await readGameState(context);
	let countryInfo = gameState.countryInfo;
	let territorySetup = await database.ref(gameState.setup + '/territories').once('value');
	territorySetup = territorySetup.val();

	let t = {};
	for (let i = 0; i < countries.length; i++) {
		let country = countries[i];
		let fleets = countryInfo[country].fleets;
		if (!fleets) {
			fleets = [];
		}
		for (let j = 0; j < fleets.length; j++) {
			if (!Object.keys(t).includes(fleets[j]['territory'])) {
				t[fleets[j]['territory']] = new Array(6).fill(0).map((x) => [0, 0, 0]);
			}
			t[fleets[j]['territory']][i][0] += 1;
		}
	}
	for (let i = 0; i < countries.length; i++) {
		let country = countries[i];
		let armies = countryInfo[country].armies;
		if (!armies) {
			armies = [];
		}
		for (let j = 0; j < armies.length; j++) {
			if (!Object.keys(t).includes(armies[j]['territory'])) {
				t[armies[j]['territory']] = new Array(6).fill(0).map((x) => [0, 0, 0]);
			}
			if (armies[j]['hostile'] === undefined || armies[j]['hostile'] === '' || armies[j]['hostile']) {
				t[armies[j]['territory']][i][1] += 1;
			} else {
				t[armies[j]['territory']][i][2] += 1;
			}
		}
	}
	for (let key in t) {
		let coord = territorySetup[key].unitCoords;
		un.push([coord, t[key]]);
	}
	return un;
}

/**
 * Retrieves the pixel coordinates of all sea (port) factories for each country, for map rendering.
 * Returns an array indexed by country order, where each element is an array of [x, y] coordinates
 * for that country's port factories.
 *
 * Called from: MapApp to render sea/port factory icons on the game map.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Array<Array<number[]>>>} Outer array indexed by country order (0-5);
 *   inner arrays contain [x, y] pixel coordinate pairs for each port factory
 */
async function getSeaFactories(context) {
	let fc = [];
	let gameState = await readGameState(context);
	let countryInfo = gameState.countryInfo;
	let countries = await helper.getCountries(context);
	let territorySetup = await database.ref(gameState.setup + '/territories').once('value');
	territorySetup = territorySetup.val();

	for (let key of countries) {
		let t = [];
		let factories = countryInfo[key].factories;
		for (let j = 0; j < factories.length; j++) {
			let port = territorySetup[factories[j]].port;
			if (port) {
				let coord = territorySetup[factories[j]].factoryCoords;
				t.push(coord);
			}
		}
		fc.push(t);
	}
	return fc;
}

/**
 * Retrieves the pixel coordinates of all land (non-port) factories for each country, for map rendering.
 * Returns an array indexed by country order, where each element is an array of [x, y] coordinates
 * for that country's inland factories.
 *
 * Called from: MapApp to render land factory icons on the game map.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Array<Array<number[]>>>} Outer array indexed by country order (0-5);
 *   inner arrays contain [x, y] pixel coordinate pairs for each inland factory
 */
async function getLandFactories(context) {
	let fc = [];
	let gameState = await readGameState(context);
	let countryInfo = gameState.countryInfo;
	let countries = await helper.getCountries(context);
	let territorySetup = await database.ref(gameState.setup + '/territories').once('value');
	territorySetup = territorySetup.val();

	for (let key of countries) {
		let t = [];
		let factories = countryInfo[key].factories;
		if (!factories) {
			factories = [];
		}
		for (let j = 0; j < factories.length; j++) {
			let port = territorySetup[factories[j]].port;
			if (!port) {
				let coord = territorySetup[factories[j]].factoryCoords;
				t.push(coord);
			}
		}
		fc.push(t);
	}
	return fc;
}

/**
 * Retrieves the pixel coordinates of all tax chip markers for each country, for map rendering.
 * Tax chips are placed on non-port territories the country has taxed. Returns an array indexed
 * by country order.
 *
 * Called from: MapApp to render tax chip icons on the game map.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Array<Array<number[]>>>} Outer array indexed by country order (0-5);
 *   inner arrays contain [x, y] pixel coordinate pairs for each tax chip
 */
async function getTaxChips(context) {
	let tx = [];
	let gameState = await readGameState(context);
	let countryInfo = gameState.countryInfo;
	let countries = await helper.getCountries(context);
	let territorySetup = await database.ref(gameState.setup + '/territories').once('value');
	territorySetup = territorySetup.val();

	for (let key of countries) {
		let t = [];
		let tax = countryInfo[key].taxChips;
		if (!tax) {
			tax = [];
		}
		for (let j = 0; j < tax.length; j++) {
			let port = territorySetup[tax[j]].port;
			if (!port) {
				let coord = territorySetup[tax[j]].taxChipCoords;
				t.push(coord);
			}
		}
		tx.push(t);
	}
	return tx;
}

/**
 * Retrieves the victory points for each country and groups countries by their point value.
 * Used to position country markers on the victory point track.
 *
 * Called from: MapApp to render the victory point track on the game map.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Object<number, string[]>>} Map of point value to array of country names
 *   at that point level (e.g. { 5: ["Austria", "Italy"], 10: ["France"] })
 */
async function getPoints(context) {
	let p = {};
	let gameState = await readGameState(context);
	let countryInfo = gameState.countryInfo;

	for (let key in countryInfo) {
		let point = countryInfo[key].points;
		if (!p[point]) {
			p[point] = [];
		}
		p[point].push(key);
	}
	return p;
}
/**
 * Retrieves the treasury money for each country.
 *
 * Called from: MapApp to display each country's treasury on the map or sidebar.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Object<string, number>>} Map of country name to treasury amount
 *   (e.g. { "Austria": 12, "France": 8 })
 */
async function getMoney(context) {
	let m = {};
	let gameState = await readGameState(context);
	let countryInfo = gameState.countryInfo;

	for (let key in countryInfo) {
		m[key] = countryInfo[key].money;
	}
	return m;
}
/**
 * Retrieves the available stock denominations for each country.
 * These are the stock values that have not yet been purchased by any player.
 *
 * Called from: MapApp to display available stocks for each country on the map or sidebar.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Object<string, number[]>>} Map of country name to array of available
 *   stock denominations (e.g. { "Austria": [1, 2, 5], "France": [3, 4] })
 */
async function getAvailStock(context) {
	let m = {};
	let gameState = await readGameState(context);
	let countryInfo = gameState.countryInfo;

	for (let key in countryInfo) {
		m[key] = countryInfo[key].availStock || [];
	}
	return m;
}
/**
 * Retrieves the last taxation threshold for each country.
 * The lastTax value is used to determine how much "greatness" (money to players) is
 * distributed during the next Taxation action -- only points above the lastTax threshold
 * generate player payouts.
 *
 * Called from: MapApp to display the taxation threshold on the map.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Object<string, number>>} Map of country name to last tax threshold value
 */
async function getLastTax(context) {
	let m = {};
	let gameState = await readGameState(context);
	let countryInfo = gameState.countryInfo;

	for (let key in countryInfo) {
		m[key] = countryInfo[key].lastTax;
	}
	return m;
}

/**
 * Computes the projected tax points (plus a base of 5) for each country if they were to
 * tax right now. Uses getTaxInfo to calculate, then adds 5 to the raw points value.
 * This represents the position on the taxation track.
 *
 * Called from: MapApp to display the projected taxation position on the map's tax track.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Object<string, number>>} Map of country name to projected tax track value
 */
async function getCurrentTax(context) {
	let tx = {};
	let gameState = await readGameState(context);
	let countryInfo = gameState.countryInfo;

	for (let key in countryInfo) {
		let a = await helper.getTaxInfo(countryInfo, null, key);
		tx[key] = a.points + 5;
	}
	return tx;
}

/**
 * Retrieves the current rondel (wheel) positions and pixel coordinates for all countries.
 * Skips countries still at "center" (haven't moved yet). Groups countries by their
 * current wheel position.
 *
 * Called from: MapApp to render country markers on the rondel wheel on the game map.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Object<string, [number[], string[]]>>} Map of wheel position name to
 *   [pixelCoords, countryNames] pairs, e.g. { "Investor": [[100, 200], ["Austria", "France"]] }
 */
async function getRondel(context) {
	let w = {};
	let gameState = await readGameState(context);
	let countryInfo = gameState.countryInfo;
	let wheelCoords = await database.ref(gameState.setup + '/wheelCoords').once('value');
	wheelCoords = wheelCoords.val();

	for (let key in countryInfo) {
		let position = countryInfo[key].wheelSpot;
		if (position === 'center') {
			continue;
		}
		if (!w[position]) {
			w[position] = [wheelCoords[position], []];
		}
		w[position][1].push(key);
	}
	return w;
}

export {
	getUnits,
	getSeaFactories,
	getLandFactories,
	getTaxChips,
	getPoints,
	getMoney,
	getAvailStock,
	getLastTax,
	getCurrentTax,
	getRondel,
};
