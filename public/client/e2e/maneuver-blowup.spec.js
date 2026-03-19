// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	activateUnit,
	clickTerritory,
	waitForActionPicker,
	getActionPickerOptions,
	isActionPickerVisible,
} = require('./helpers/selectors');

// Tests for blow-up action availability (§4.4 from maneuver-ui-spec.md)
// Blow-up requires: ≥3 friendly armies at destination + enemy has factory there + enemy has >1 factory total

let gameID;

test.describe('Maneuver Planner — Blow-Up Action', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('blow-up available with 3+ armies at territory with enemy factory', async ({ page }) => {
		// Seed: 3 Austrian armies at Vienna, Trieste, Budapest.
		// Italy has army + factory at Budapest. Italy has 2 factories (Rome, Budapest).
		// All 3 armies can reach Budapest. After 3 arrive, blow-up should be available.
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Trieste', hostile: true },
				{ territory: 'Budapest', hostile: true },
			],
			enemyUnits: {
				Italy: { armies: [{ territory: 'Budapest', hostile: true }] },
			},
			enemyFactories: {
				Italy: ['Rome', 'Naples', 'Budapest'],
			},
		});

		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Move Army 1 to Budapest (has enemy) — pick war
		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await waitForActionPicker(page);

		let options = await getActionPickerOptions(page);
		// With only 1 army arriving, blow-up should NOT be available
		expect(options.some((o) => o.toLowerCase().includes('destroy'))).toBe(false);
	});

	test('blow-up NOT available with fewer than 3 armies', async ({ page }) => {
		// Seed: 2 Austrian armies, Italy has factory at Budapest
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Trieste', hostile: true },
			],
			enemyUnits: {
				Italy: { armies: [{ territory: 'Budapest', hostile: true }] },
			},
			enemyFactories: {
				Italy: ['Rome', 'Naples', 'Budapest'],
			},
		});

		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Move Army 1 to Budapest
		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await waitForActionPicker(page);

		let options = await getActionPickerOptions(page);
		// Blow-up should NOT be available (only 1 army arriving, need 3)
		expect(options.some((o) => o.toLowerCase().includes('destroy'))).toBe(false);

		// Should still have war and peace options
		expect(options.some((o) => o.toLowerCase().includes('war'))).toBe(true);
		expect(options.some((o) => o.toLowerCase().includes('peace'))).toBe(true);
	});

	test('blow-up NOT available when target country has only 1 factory', async ({ page }) => {
		// Italy has only 1 factory — blow-up would eliminate them, not allowed
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Trieste', hostile: true },
				{ territory: 'Budapest', hostile: true },
			],
			enemyUnits: {
				Italy: { armies: [{ territory: 'Budapest', hostile: true }] },
			},
			enemyFactories: {
				Italy: ['Budapest'], // Only 1 factory — can't blow up
			},
		});

		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await waitForActionPicker(page);

		let options = await getActionPickerOptions(page);
		// Blow-up should NOT be available (would eliminate Italy's last factory)
		expect(options.some((o) => o.toLowerCase().includes('destroy'))).toBe(false);
	});
});
