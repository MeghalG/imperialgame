// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	clickUnitMarker,
	clickTerritory,
	pickAction,
	getActionPickerOptions,
	getPlanListRows,
	isActionPickerVisible,
} = require('./helpers/selectors');

// Tests for §8.7 (multi-unit war at same territory) from docs/maneuver-ui-spec.md

let gameID;

test.describe('Maneuver Planner — Multi-Unit War (§8.7)', () => {
	test.beforeEach(async () => {
		// Austria has 3 armies. Rome has 2 Italian armies + 1 Italian fleet.
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Budapest', hostile: true },
				{ territory: 'Trieste', hostile: true },
			],
			enemyUnits: {
				Italy: {
					armies: [
						{ territory: 'Rome', hostile: true },
						{ territory: 'Rome', hostile: true },
					],
					fleets: [{ territory: 'Rome', hostile: true }],
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

		// Army 1 → Rome, war Italy army (destroys 1 of 2 Italian armies)
		await clickUnitMarker(page, 'army at Vienna');
		await clickTerritory(page, 'Rome');
		await pickAction(page, 'war on Italy army');

		// Army 2 → Rome: should see updated options
		// Virtual state: 1 Italian army + 1 Italian fleet remain
		await clickUnitMarker(page, 'army at Budapest');
		await clickTerritory(page, 'Rome');
		const visible = await isActionPickerVisible(page);
		expect(visible).toBe(true);

		const options = await getActionPickerOptions(page);
		// Should have: war Italy army, war Italy fleet, peace
		// Should NOT have: hostile (enemies still present)
		expect(options.some((o) => o.includes('army'))).toBe(true);
		expect(options.some((o) => o.includes('fleet'))).toBe(true);
		expect(options.some((o) => o.includes('peace') || o.includes('Peace'))).toBe(true);
		expect(options.some((o) => o.includes('hostile') || o.includes('Hostile'))).toBe(false);
	});
});
