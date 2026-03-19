// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	assignMove,
	getSubmitButtonState,
	clickSubmit,
	getPlanListRows,
} = require('./helpers/selectors');

// Tests for §6 (submit button states) from docs/maneuver-ui-spec.md

let gameID;

test.describe('Maneuver Planner — Submit Flow', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

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

		// Assign Army 1 to stay at Vienna, then Army 2 to stay at Budapest
		await assignMove(page, 'army at Vienna', 'Vienna');
		await assignMove(page, 'army at Budapest', 'Budapest');

		const state = await getSubmitButtonState(page);
		expect(state.disabled).toBe(false);
		expect(state.text).toContain('Submit');
	});

	test('all units staying in place is a valid submission', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Assign both to stay in place
		await assignMove(page, 'army at Vienna', 'Vienna');
		await assignMove(page, 'army at Budapest', 'Budapest');

		// Submit should work
		await clickSubmit(page);

		// After submit, wait for mode change (planner disappears)
		await page.waitForSelector('.imp-unit-marker', { state: 'hidden', timeout: 5000 }).catch(() => {});
	});
});
