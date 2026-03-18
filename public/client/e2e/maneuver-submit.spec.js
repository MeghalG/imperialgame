// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	clickUnitMarker,
	clickTerritory,
	getSubmitButtonState,
	clickSubmit,
	getPlanListRows,
} = require('./helpers/selectors');

// Tests for §6 (submit button states) from docs/maneuver-ui-spec.md

let gameID;

test.describe('Maneuver Planner — Submit Flow', () => {
	test.beforeEach(async () => {
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Budapest', hostile: true },
			],
		});
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('submit button disabled when units still unassigned', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		const state = await getSubmitButtonState(page);
		// Should be disabled (2 unassigned units)
		expect(state.disabled).toBe(true);
	});

	test('submit button enabled when all units assigned', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Assign both armies to stay in place
		await clickUnitMarker(page, 'army at Vienna');
		await clickTerritory(page, 'Vienna');
		await clickUnitMarker(page, 'army at Budapest');
		await clickTerritory(page, 'Budapest');

		const state = await getSubmitButtonState(page);
		expect(state.disabled).toBe(false);
		expect(state.text).toContain('Submit');
	});

	test('all units staying in place is a valid submission', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Assign both to stay in place
		await clickUnitMarker(page, 'army at Vienna');
		await clickTerritory(page, 'Vienna');
		await clickUnitMarker(page, 'army at Budapest');
		await clickTerritory(page, 'Budapest');

		// Submit should work
		await clickSubmit(page);

		// After submit, mode should change (maneuver complete)
		// The planner should no longer be visible
		await page.waitForSelector('[class*="ManeuverPlan"]', { state: 'hidden', timeout: 10000 });
	});
});
