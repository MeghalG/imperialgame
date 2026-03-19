// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	assignMove,
	getPlanListRows,
	clickReorderUp,
	clickReorderDown,
	isReorderUpDisabled,
	isReorderDownDisabled,
	waitForCascade,
} = require('./helpers/selectors');

// Tests for move reordering (§2.3 from maneuver-ui-spec.md)

let gameID;

test.describe('Maneuver Planner — Reorder Moves', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// 2 armies: Vienna and Budapest
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

	test('up and down arrows reorder plan list rows', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Assign both armies
		await assignMove(page, 'army at Vienna', 'Budapest');
		await assignMove(page, 'army at Budapest', 'Vienna');

		// Verify initial order: Army 1 (Vienna→Budapest), Army 2 (Budapest→Vienna)
		let rows = await getPlanListRows(page);
		expect(rows[0].text).toContain('Vienna');
		expect(rows[1].text).toContain('Budapest');

		// Click down on first row → swap
		await clickReorderDown(page, 0);
		await waitForCascade(page);

		// Order should be swapped: Army 2 first, Army 1 second
		rows = await getPlanListRows(page);
		expect(rows[0].text).toContain('Budapest');
		expect(rows[1].text).toContain('Vienna');

		// Click up on second row → swap back
		await clickReorderUp(page, 1);
		await waitForCascade(page);

		rows = await getPlanListRows(page);
		expect(rows[0].text).toContain('Vienna');
		expect(rows[1].text).toContain('Budapest');
	});

	test('first row up disabled, last row down disabled', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Assign both armies
		await assignMove(page, 'army at Vienna', 'Budapest');
		await assignMove(page, 'army at Budapest', 'Vienna');

		// First row: up should be disabled
		let upDisabled = await isReorderUpDisabled(page, 0);
		expect(upDisabled).toBe(true);

		// First row: down should be enabled
		let downDisabled = await isReorderDownDisabled(page, 0);
		expect(downDisabled).toBe(false);

		// Last row: down should be disabled
		downDisabled = await isReorderDownDisabled(page, 1);
		expect(downDisabled).toBe(true);

		// Last row: up should be enabled
		upDisabled = await isReorderUpDisabled(page, 1);
		expect(upDisabled).toBe(false);
	});
});
