// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	activateUnit,
	clickTerritory,
	pickAction,
	waitForActionPicker,
	getActionPickerOptions,
	getPlanListRows,
	isActionPickerVisible,
} = require('./helpers/selectors');

// Tests for §8.7 (multi-unit war at same territory) from docs/maneuver-ui-spec.md

let gameID;

test.describe('Maneuver Planner — Multi-Unit War (§8.7)', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// Austria has 2 armies at Vienna and Trieste.
		// Budapest has 2 Italian armies + 1 Italian fleet (enemies).
		// Budapest is adjacent to both Vienna and Trieste.
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Trieste', hostile: true },
			],
			enemyUnits: {
				Italy: {
					armies: [
						{ territory: 'Budapest', hostile: true },
						{ territory: 'Budapest', hostile: true },
					],
					fleets: [{ territory: 'Budapest', hostile: true }],
				},
			},
		});
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('virtual state tracks enemy destruction across multiple war moves', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Army 1 → Budapest, declare war on Italy army
		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await pickAction(page, 'Declare war on Italy army');

		// Army 2 → Budapest: should see updated options
		// Virtual state: 1 Italian army + 1 Italian fleet remain
		await activateUnit(page, 'army at Trieste');
		await clickTerritory(page, 'Budapest');
		await waitForActionPicker(page);
		const visible = await isActionPickerVisible(page);
		expect(visible).toBe(true);

		const options = await getActionPickerOptions(page);
		// Should have war and peace options
		expect(options.some((o) => o.includes('army'))).toBe(true);
		expect(options.some((o) => o.includes('fleet'))).toBe(true);
		expect(options.some((o) => o.toLowerCase().includes('peace'))).toBe(true);
		// Should NOT have hostile (enemies still present)
		expect(options.some((o) => o.toLowerCase().includes('hostile'))).toBe(false);
	});
});
