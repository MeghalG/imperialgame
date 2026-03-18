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
	clickRemoveOnRow,
	isActionPickerVisible,
	getActionPickerOptions,
	getArrowCount,
} = require('./helpers/selectors');

// Tests for §8.4 (war→cancel cascade) and §8.5 (fleet removal cascade)
// from docs/maneuver-ui-spec.md

let gameID;

test.describe('Maneuver Planner — War Cancel Cascade (§8.4)', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// Setup: Austria has 2 armies. Italy has 1 army at Rome.
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Budapest', hostile: true },
			],
			enemyUnits: {
				Italy: { armies: [{ territory: 'Rome', hostile: true }] },
			},
		});
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('cancel war cascades: hostile action becomes invalid and resets', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Step 1: Army 1 → Rome, pick "war Italy army"
		await clickUnitMarker(page, 'army at Vienna');
		await clickTerritory(page, 'Rome');
		await pickAction(page, 'war');

		// Step 2: Army 2 → Rome, pick "hostile" (available because Army 1's war clears enemies)
		await clickUnitMarker(page, 'army at Budapest');
		await clickTerritory(page, 'Rome');
		// In virtual state, enemies are cleared by Army 1's war → hostile should be available
		await pickAction(page, 'hostile');

		// Verify both rows assigned
		let rows = await getPlanListRows(page);
		expect(rows.filter((r) => r.isAssigned).length).toBe(2);

		// Step 3: Cancel Army 1's move (first row, index 0)
		await clickRemoveOnRow(page, 0);

		// CASCADE: Army 2's "hostile" should now be INVALID because
		// enemies are no longer cleared at Rome.
		// Army 2 should keep its destination (Rome) but action should reset
		// to a valid default (e.g. "war Italy army")
		rows = await getPlanListRows(page);
		const army2Row = rows.find((r) => r.isAssigned && r.text.includes('Rome'));
		expect(army2Row).toBeDefined();
		// The action should NOT be "hostile" anymore
		expect(army2Row.actionBadge).not.toContain('hostile');
	});
});

test.describe('Maneuver Planner — Fleet Removal Cascade (§8.5)', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// Setup: Austria has 1 fleet at Adriatic Sea, 1 army at Trieste.
		// Army can reach Albania via fleet convoy.
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [{ territory: 'Adriatic Sea', hostile: true }],
			armies: [{ territory: 'Trieste', hostile: true }],
		});
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('cancel fleet clears army destination that required convoy', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Step 1: Fleet stays in place (provides convoy at Adriatic)
		await clickUnitMarker(page, 'fleet at Adriatic Sea');
		await clickTerritory(page, 'Adriatic Sea');

		// Step 2: Army crosses Adriatic via convoy to reach Albania
		await clickUnitMarker(page, 'army at Trieste');
		await clickTerritory(page, 'Albania');

		// Verify both assigned
		let rows = await getPlanListRows(page);
		expect(rows.filter((r) => r.isAssigned).length).toBe(2);

		// Step 3: Cancel Fleet's move
		await clickRemoveOnRow(page, 0); // Fleet is first row

		// CASCADE: Army's destination "Albania" should be cleared
		// because the fleet no longer provides convoy
		rows = await getPlanListRows(page);
		const armyRow = rows.find((r) => r.text.includes('Trieste'));
		// Army should be unassigned (destination cleared by cascade)
		expect(armyRow.isAssigned).toBe(false);
	});
});
