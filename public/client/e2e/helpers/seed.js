/**
 * Firebase Emulator seeding helpers for E2E tests.
 *
 * Writes test game state directly to the Firebase Realtime Database emulator
 * via its REST API. The emulator must be running on FIREBASE_EMULATOR_PORT
 * (default 9000).
 *
 * Usage in tests:
 *   const { seedManeuverGame, cleanupGame } = require('./helpers/seed');
 *   let gameID;
 *   test.beforeEach(async () => { gameID = await seedManeuverGame({...}); });
 *   test.afterEach(async () => { await cleanupGame(gameID); });
 */

const path = require('path');
const fs = require('fs');

const EMULATOR_HOST = process.env.FIREBASE_EMULATOR_HOST || 'localhost';
const EMULATOR_PORT = process.env.FIREBASE_EMULATOR_PORT || 9000;
// The Firebase SDK connects to the emulator with ns=PROJECT_ID (no suffix).
// REST API calls must include ?ns=PROJECT_ID to write to the same namespace.
const PROJECT_ID = process.env.REACT_APP_FIREBASE_PROJECT_ID || 'imperialgame-e8a12';
const NAMESPACE = PROJECT_ID;
const BASE_URL = `http://${EMULATOR_HOST}:${EMULATOR_PORT}`;

/**
 * Write a value to a Firebase Realtime Database path via the emulator REST API.
 * @param {string} path - Database path (e.g. "games/test123")
 * @param {*} data - JSON-serializable data
 */
async function dbSet(dbPath, data) {
	const url = `${BASE_URL}/${dbPath}.json?ns=${NAMESPACE}&access_token=owner`;
	const res = await fetch(url, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data),
	});
	if (!res.ok) {
		throw new Error(`Firebase emulator PUT ${dbPath} failed: ${res.status} ${await res.text()}`);
	}
}

/**
 * Delete a Firebase Realtime Database path via the emulator REST API.
 * @param {string} path - Database path to delete
 */
async function dbDelete(dbPath) {
	const url = `${BASE_URL}/${dbPath}.json?ns=${NAMESPACE}&access_token=owner`;
	const res = await fetch(url, { method: 'DELETE' });
	if (!res.ok) {
		throw new Error(`Firebase emulator DELETE ${dbPath} failed: ${res.status} ${await res.text()}`);
	}
}

/**
 * Generate a unique test game ID.
 * @returns {string}
 */
function testGameID() {
	return 'e2e-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Creates a standard 6-country game state template.
 * @returns {Object} Base game state
 */
function baseGameState() {
	return {
		mode: 'proposal',
		countryUp: 'Austria',
		round: 1,
		turnID: 1,
		setup: 'setups/standard',
		sameTurn: false,
		undo: null,
		history: ['Game started.'],
		'proposal 1': null,
		'proposal 2': null,
		voting: null,
		currentManeuver: null,
		peaceVote: null,
		swissSet: null,
		timer: { timed: false },
		playerInfo: {
			Alice: {
				money: 10,
				myTurn: true,
				investor: false,
				order: 1,
				swiss: false,
				stock: [{ country: 'Austria', stock: 4 }],
				scoreModifier: 0,
				email: '',
			},
			Bob: {
				money: 10,
				myTurn: false,
				investor: false,
				order: 2,
				swiss: false,
				stock: [{ country: 'Italy', stock: 4 }],
				scoreModifier: 0,
				email: '',
			},
		},
		countryInfo: {
			Austria: {
				money: 5,
				points: 0,
				factories: ['Vienna', 'Budapest'],
				wheelSpot: 'center',
				gov: 'dictatorship',
				leadership: ['Alice'],
				availStock: [3, 2, 1],
				offLimits: false,
				lastTax: 0,
				taxChips: [],
				fleets: [{ territory: 'Trieste', hostile: true }],
				armies: [
					{ territory: 'Vienna', hostile: true },
					{ territory: 'Budapest', hostile: true },
				],
			},
			Italy: {
				money: 5,
				points: 0,
				factories: ['Rome', 'Naples'],
				wheelSpot: 'center',
				gov: 'dictatorship',
				leadership: ['Bob'],
				availStock: [3, 2, 1],
				offLimits: false,
				lastTax: 0,
				taxChips: [],
				fleets: [],
				armies: [{ territory: 'Rome', hostile: true }],
			},
			France: {
				money: 5,
				points: 0,
				factories: ['Paris', 'Marseille'],
				wheelSpot: 'center',
				gov: 'dictatorship',
				leadership: [],
				availStock: [4, 3, 2, 1],
				offLimits: false,
				lastTax: 0,
				taxChips: [],
				fleets: [],
				armies: [],
			},
			England: {
				money: 5,
				points: 0,
				factories: ['London', 'Liverpool'],
				wheelSpot: 'center',
				gov: 'dictatorship',
				leadership: [],
				availStock: [4, 3, 2, 1],
				offLimits: false,
				lastTax: 0,
				taxChips: [],
				fleets: [],
				armies: [],
			},
			Germany: {
				money: 5,
				points: 0,
				factories: ['Berlin', 'Munich'],
				wheelSpot: 'center',
				gov: 'dictatorship',
				leadership: [],
				availStock: [4, 3, 2, 1],
				offLimits: false,
				lastTax: 0,
				taxChips: [],
				fleets: [],
				armies: [],
			},
			Russia: {
				money: 5,
				points: 0,
				factories: ['Moscow', 'St Petersburg'],
				wheelSpot: 'center',
				gov: 'dictatorship',
				leadership: [],
				availStock: [4, 3, 2, 1],
				offLimits: false,
				lastTax: 0,
				taxChips: [],
				fleets: [],
				armies: [],
			},
		},
	};
}

/**
 * Seed a game in continue-man mode (maneuver planner active).
 *
 * @param {Object} [options]
 * @param {string} [options.player='Alice'] - Player doing the maneuver
 * @param {string} [options.country='Austria'] - Country being maneuvered
 * @param {Array} [options.fleets] - Override fleet positions [{territory, hostile}]
 * @param {Array} [options.armies] - Override army positions [{territory, hostile}]
 * @param {Object} [options.enemyUnits] - Extra enemy units: {Italy: {armies: [...], fleets: [...]}}
 * @param {Object} [options.enemyFactories] - Override enemy factories: {Italy: ['Rome', 'Naples', 'Venice']}
 * @param {Array} [options.completedFleetMoves] - Prior completed fleet moves [[origin, dest, action], ...]
 * @param {Array} [options.completedArmyMoves] - Prior completed army moves [[origin, dest, action], ...]
 * @param {Object} [options.pendingPeace] - Pending peace vote state: {country, territory, ...}
 * @param {Object} [options.factories] - Override own country factories: ['Vienna', 'Budapest', 'Trieste']
 * @returns {Promise<string>} The game ID
 */
async function seedManeuverGame(options = {}) {
	const gameID = testGameID();
	const player = options.player || 'Alice';
	const country = options.country || 'Austria';

	let gs = baseGameState();
	gs.mode = 'continue-man';
	gs.countryUp = country;

	// Override own country factories
	if (options.factories) {
		gs.countryInfo[country].factories = options.factories;
	}

	// Override units if provided
	if (options.fleets) {
		gs.countryInfo[country].fleets = options.fleets;
	}
	if (options.armies) {
		gs.countryInfo[country].armies = options.armies;
	}

	// Add enemy units
	if (options.enemyUnits) {
		for (let [enemyCountry, units] of Object.entries(options.enemyUnits)) {
			if (units.armies) gs.countryInfo[enemyCountry].armies = units.armies;
			if (units.fleets) gs.countryInfo[enemyCountry].fleets = units.fleets;
		}
	}

	// Override enemy factories
	if (options.enemyFactories) {
		for (let [enemyCountry, factories] of Object.entries(options.enemyFactories)) {
			gs.countryInfo[enemyCountry].factories = factories;
		}
	}

	// Set up currentManeuver
	let pendingFleets = (gs.countryInfo[country].fleets || []).map((f) => ({ ...f }));
	let pendingArmies = (gs.countryInfo[country].armies || []).map((a) => ({ ...a }));

	gs.currentManeuver = {
		country: country,
		player: player,
		wheelSpot: 'L-Maneuver',
		phase: pendingFleets.length > 0 ? 'fleet' : 'army',
		unitIndex: 0,
		pendingFleets: pendingFleets,
		pendingArmies: pendingArmies,
		completedFleetMoves: options.completedFleetMoves || [],
		completedArmyMoves: options.completedArmyMoves || [],
		returnMode: 'execute',
		proposalSlot: 0,
		pendingPeace: options.pendingPeace || null,
	};

	// Set myTurn for the maneuvering player
	for (let p in gs.playerInfo) {
		gs.playerInfo[p].myTurn = p === player;
	}

	await dbSet(`games/${gameID}`, gs);
	return gameID;
}

/**
 * Remove a test game from the emulator.
 * @param {string} gameID
 */
async function cleanupGame(gameID) {
	await dbDelete(`games/${gameID}`);
}

/**
 * Seed the setup data (territories, countries, wheel, costs) from a local
 * fixture file into the emulator. Only needs to run once per emulator session.
 * Uses a checked-in fixture to avoid production network dependency.
 */
async function seedSetupData() {
	// Check if setup data already exists (in the project namespace)
	const checkUrl = `${BASE_URL}/setups/standard.json?ns=${NAMESPACE}&access_token=owner`;
	const check = await fetch(checkUrl);
	const existing = await check.json();
	if (existing && existing.territories) return; // Already seeded

	// Load from local fixture file (no production network dependency)
	const fixturePath = path.resolve(__dirname, '../fixtures/setup-standard.json');
	const setupData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
	if (!setupData || !setupData.territories) {
		throw new Error('Setup fixture is empty or missing territories. Regenerate e2e/fixtures/setup-standard.json');
	}
	await dbSet('setups/standard', setupData);
}

module.exports = {
	dbSet,
	dbDelete,
	testGameID,
	baseGameState,
	seedManeuverGame,
	seedSetupData,
	cleanupGame,
	EMULATOR_HOST,
	EMULATOR_PORT,
	BASE_URL,
};
