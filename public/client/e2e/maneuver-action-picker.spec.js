// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	activateUnit,
	clickTerritory,
	isActionPickerVisible,
	waitForActionPicker,
	waitForActionPickerDismissed,
	getActionPickerOptions,
	pickAction,
	dismissActionPicker,
	getPlanListRows,
} = require('./helpers/selectors');

// Tests for action picker behavior (§4.2 from maneuver-ui-spec.md)

let gameID;

test.describe('Maneuver Planner — Action Picker', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// Austria army at Vienna, Italy army at Budapest (adjacent, so war/peace options appear)
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

	test('backdrop click dismisses picker and keeps default action', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Move to Budapest (has enemy) → picker appears with auto-assigned default
		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await waitForActionPicker(page);

		let visible = await isActionPickerVisible(page);
		expect(visible).toBe(true);

		// Click backdrop to dismiss — keeps the auto-assigned default action
		await dismissActionPicker(page);
		await waitForActionPickerDismissed(page);

		visible = await isActionPickerVisible(page);
		expect(visible).toBe(false);

		// The row should be assigned with the default action (auto-assigned on click)
		const rows = await getPlanListRows(page);
		const assignedRow = rows.find((r) => r.isAssigned);
		expect(assignedRow).toBeDefined();
	});

	test('picker closes after action selection', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Move to Budapest → picker appears
		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await waitForActionPicker(page);

		// Select war action
		await pickAction(page, 'Declare war');
		await waitForActionPickerDismissed(page);

		// Picker should be gone
		let visible = await isActionPickerVisible(page);
		expect(visible).toBe(false);

		// Row should show the war action badge
		const rows = await getPlanListRows(page);
		const warRow = rows.find((r) => r.isAssigned && r.actionBadge.toLowerCase().includes('war'));
		expect(warRow).toBeDefined();
	});

	test('multi-country enemies show grouped action display', async ({ page }) => {
		// Seed with both Italian and French armies at Budapest
		if (gameID) await cleanupGame(gameID);
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [{ territory: 'Vienna', hostile: true }],
			enemyUnits: {
				Italy: { armies: [{ territory: 'Budapest', hostile: true }] },
				France: { armies: [{ territory: 'Budapest', hostile: true }] },
			},
		});

		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await waitForActionPicker(page);

		const options = await getActionPickerOptions(page);
		// Should have options mentioning both Italy and France
		expect(options.some((o) => o.includes('Italy'))).toBe(true);
		expect(options.some((o) => o.includes('France'))).toBe(true);
	});
});
