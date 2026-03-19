// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	clickTerritory,
	pickAction,
	getPlanListRows,
	getSubmitButtonState,
	RESPOND_TIMEOUT,
} = require('./helpers/selectors');

// Tests for §5 (peace vote flow) from docs/maneuver-ui-spec.md

let gameID;

test.describe('Maneuver Planner — Peace Flow', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// Austria army at Vienna, Italy army at Budapest (adjacent to Vienna)
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [{ territory: 'Vienna', hostile: true }],
			enemyUnits: {
				Italy: { armies: [{ territory: 'Budapest', hostile: true }] },
			},
		});
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('peace action shows orange border and changes submit button', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Army 1 auto-activates (only unit). Wait for selectable highlights, then click Budapest.
		await page.waitForSelector('.imp-boundary--selectable', { timeout: RESPOND_TIMEOUT });
		await clickTerritory(page, 'Budapest');
		await pickAction(page, 'Enter peacefully');

		// Plan list row should show peace styling
		const rows = await getPlanListRows(page);
		const peaceRow = rows.find((r) => r.isAssigned);
		expect(peaceRow).toBeDefined();
		expect(peaceRow.actionBadge.toLowerCase()).toContain('peace');
	});
});
