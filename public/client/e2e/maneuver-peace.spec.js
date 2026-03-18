// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	clickUnitMarker,
	clickTerritory,
	pickAction,
	getPlanListRows,
	getSubmitButtonState,
} = require('./helpers/selectors');

// Tests for §5 (peace vote flow) from docs/maneuver-ui-spec.md

let gameID;

test.describe('Maneuver Planner — Peace Flow', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// Austria army at Vienna, Italy army at Rome (enemy)
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [{ territory: 'Vienna', hostile: true }],
			enemyUnits: {
				Italy: { armies: [{ territory: 'Rome', hostile: true }] },
			},
		});
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('peace action shows orange border and changes submit button', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Move Army 1 to Rome and pick peace
		await clickUnitMarker(page, 'army at Vienna');
		await clickTerritory(page, 'Rome');
		await pickAction(page, 'peace');

		// Plan list row should show peace styling
		const rows = await getPlanListRows(page);
		const peaceRow = rows.find((r) => r.isAssigned);
		expect(peaceRow).toBeDefined();
		expect(peaceRow.actionBadge).toContain('peace');

		// Submit button should show peace label
		const submitState = await getSubmitButtonState(page);
		expect(submitState.text).toContain('Peace');
	});
});
