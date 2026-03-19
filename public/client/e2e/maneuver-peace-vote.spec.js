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
	getPlanListRows,
	getSubmitButtonState,
	clickSubmit,
	RESPOND_TIMEOUT,
} = require('./helpers/selectors');

// Tests for peace vote flow (§5 from maneuver-ui-spec.md)

let gameID;

test.describe('Maneuver Planner — Peace Vote Flow', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// Austria army at Vienna, Italy army at Budapest (dictatorship — Bob is dictator)
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

	test('inline Request Peace button appears on peace rows', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Assign peace action
		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await waitForActionPicker(page);
		await pickAction(page, 'Enter peacefully');

		// Look for inline peace button in the plan list
		const peaceBtn = page.locator('button:has-text("Request Peace")');
		await expect(peaceBtn).toBeVisible({ timeout: RESPOND_TIMEOUT });
	});

	test('submit FAB enabled after peace action assigned to all units', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Assign peace action to the only army
		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await waitForActionPicker(page);
		await pickAction(page, 'Enter peacefully');

		// Submit FAB should be visible and enabled (all units assigned)
		const state = await getSubmitButtonState(page);
		expect(state.visible).toBe(true);
		expect(state.disabled).toBe(false);
		// FAB shows either "Peace: Italy" or "Submit Maneuver" depending on peace stop detection
		expect(state.text.length).toBeGreaterThan(0);
	});

	test('peace badge shows country name in plan list', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Assign peace action
		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await waitForActionPicker(page);
		await pickAction(page, 'Enter peacefully');

		// Plan list row should show peace badge
		const rows = await getPlanListRows(page);
		const peaceRow = rows.find((r) => r.isAssigned);
		expect(peaceRow).toBeDefined();
		expect(peaceRow.actionBadge.toLowerCase()).toContain('peace');
	});

	test('war action shows war badge in plan list', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Assign war action
		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await waitForActionPicker(page);
		await pickAction(page, 'Declare war');

		// Plan list row should show war badge
		const rows = await getPlanListRows(page);
		const warRow = rows.find((r) => r.isAssigned);
		expect(warRow).toBeDefined();
		expect(warRow.actionBadge.toLowerCase()).toContain('war');
	});
});
