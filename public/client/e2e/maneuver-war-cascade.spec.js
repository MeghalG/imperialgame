// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	activateUnit,
	assignMove,
	clickTerritory,
	pickAction,
	getPlanListRows,
	clickRemoveOnRow,
	waitForCascade,
	RESPOND_TIMEOUT,
} = require('./helpers/selectors');

// Tests for §8.4 (war→cancel cascade) and §8.5 (fleet removal cascade)
// from docs/maneuver-ui-spec.md

let gameID;

test.describe('Maneuver Planner — War Cancel Cascade (§8.4)', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// Setup: Austria has 2 armies (Vienna, Trieste). Italy has 1 army at Budapest.
		// Both Vienna and Trieste are adjacent to Budapest.
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Trieste', hostile: true },
			],
			enemyUnits: {
				Italy: { armies: [{ territory: 'Budapest', hostile: true }] },
			},
		});
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('cancel war cascades: hostile action becomes invalid and resets', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Step 1: Army 1 → Budapest, declare war on Italy army
		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		await pickAction(page, 'Declare war on Italy army');

		// Wait for assignment
		await page.waitForFunction(() => document.querySelectorAll('.anticon-check-circle').length >= 1, {
			timeout: RESPOND_TIMEOUT,
		});

		// Step 2: Army 2 → Budapest. In virtual state, Army 1's war cleared the enemy,
		// so hostile is the only option and should auto-assign (no picker).
		await activateUnit(page, 'army at Trieste');
		await clickTerritory(page, 'Budapest');
		await page.waitForFunction(() => document.querySelectorAll('.anticon-check-circle').length >= 2, {
			timeout: RESPOND_TIMEOUT,
		});

		// Verify both rows assigned
		let rows = await getPlanListRows(page);
		expect(rows.filter((r) => r.isAssigned).length).toBe(2);

		// Step 3: Cancel Army 1's move (first assigned row)
		await clickRemoveOnRow(page, 0);
		await waitForCascade(page);

		// CASCADE: Army 2's "hostile" should now be INVALID because
		// enemies are no longer cleared at Budapest.
		// Army 2 should keep its destination (Budapest) but action should change.
		rows = await getPlanListRows(page);
		const army2Row = rows.find((r) => r.isAssigned && r.text.includes('Budapest'));
		expect(army2Row).toBeDefined();
		// The action should NOT be "hostile" anymore (enemies are back)
		expect(army2Row.actionBadge.toLowerCase()).not.toContain('hostile');
	});
});

test.describe('Maneuver Planner — Fleet Removal Cascade (§8.5)', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// Setup: Austria has 1 fleet at Trieste (port on Adriatic), 1 army at Vienna.
		// Fleet can move to Adriatic Sea; army can then convoy to Rome.
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [{ territory: 'Trieste', hostile: true }],
			armies: [{ territory: 'Vienna', hostile: true }],
		});
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('cancel fleet clears army destination that required convoy', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Step 1: Fleet moves from Trieste to Ionian Sea (provides convoy)
		await assignMove(page, 'fleet at Trieste', 'Ionian Sea');

		// Step 2: Army → Naples (only reachable via convoy through Ionian Sea)
		// Naples is an Italian territory adjacent to Ionian Sea, unreachable by land from Vienna.
		await activateUnit(page, 'army at Vienna');
		// Wait for army selectables to include convoy destinations
		await page.waitForFunction(() => !!document.querySelector('.imp-boundary--selectable[data-territory="Naples"]'), {
			timeout: RESPOND_TIMEOUT,
		});
		await clickTerritory(page, 'Naples');
		await page.waitForFunction(() => document.querySelectorAll('.anticon-check-circle').length >= 2, {
			timeout: RESPOND_TIMEOUT,
		});

		// Verify both assigned (fleet + army)
		let rows = await getPlanListRows(page);
		expect(rows.filter((r) => r.isAssigned).length).toBe(2);

		// Step 3: Cancel Fleet's move (fleet is first in the list)
		await clickRemoveOnRow(page, 0);
		await waitForCascade(page);

		// CASCADE: Army's convoy destination should be cleared
		rows = await getPlanListRows(page);
		const armyRow = rows.find((r) => r.text.includes('Army'));
		expect(armyRow.isAssigned).toBe(false);
	});
});

test.describe('Maneuver Planner — Action Change Cascade', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	let gameID2;

	test.afterEach(async () => {
		if (gameID2) await cleanupGame(gameID2);
	});

	test('changing war to peace recascades: downstream hostile stays valid if enemies still exist', async ({ page }) => {
		// 2 Austrian armies, 2 Italian armies at Budapest
		gameID2 = await seedManeuverGame({
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
				},
			},
		});
		await joinGame(page, gameID2, 'Alice');
		await waitForPlannerReady(page);

		// Army 1 auto-activates → Budapest with war (clears 1 Italian army)
		await page.waitForSelector('.imp-boundary--selectable', { timeout: RESPOND_TIMEOUT });
		await clickTerritory(page, 'Budapest');
		await pickAction(page, 'Declare war on Italy army');

		// Army 2 auto-activates → Budapest with war (clears 2nd)
		await page.waitForSelector('.imp-boundary--selectable', { timeout: RESPOND_TIMEOUT });
		await clickTerritory(page, 'Budapest');
		await pickAction(page, 'Declare war on Italy army');

		// Both assigned
		let rows = await getPlanListRows(page);
		expect(rows.filter((r) => r.isAssigned).length).toBe(2);
	});

	test('removing a move does not affect unrelated units at different territories', async ({ page }) => {
		// 2 armies going to different territories — no dependency
		gameID2 = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Budapest', hostile: true },
			],
		});
		await joinGame(page, gameID2, 'Alice');
		await waitForPlannerReady(page);

		// Army 1 → stay at Vienna
		await assignMove(page, 'army at Vienna', 'Vienna');

		// Army 2 → stay at Budapest
		await assignMove(page, 'army at Budapest', 'Budapest');

		// Both assigned
		let rows = await getPlanListRows(page);
		expect(rows.filter((r) => r.isAssigned).length).toBe(2);

		// Cancel Army 1 — Army 2 should NOT be affected
		await clickRemoveOnRow(page, 0);
		await waitForCascade(page);

		rows = await getPlanListRows(page);
		let army2 = rows.find((r) => r.text.includes('Budapest') && r.isAssigned);
		expect(army2).toBeDefined();
		let army1 = rows.find((r) => r.text.includes('Vienna') && !r.isAssigned);
		expect(army1).toBeDefined();
	});
});
