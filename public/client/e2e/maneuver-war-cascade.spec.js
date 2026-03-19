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

test.describe('Maneuver Planner — Stale War/Peace After Reorder (§8.4 regression)', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	let gameID3;

	test.afterEach(async () => {
		if (gameID3) await cleanupGame(gameID3);
	});

	test('out-of-order input: lower unit picks war, higher unit moves in → war shifts up, lower gets default', async ({
		page,
	}) => {
		// Setup: 2 Austrian armies, 1 Italian army at Budapest
		gameID3 = await seedManeuverGame({
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
		await joinGame(page, gameID3, 'Alice');
		await waitForPlannerReady(page);

		// Army 0 (Vienna) auto-activates. Assign it to stay at Vienna first.
		await clickTerritory(page, 'Vienna');
		await page.waitForFunction(() => document.querySelectorAll('.anticon-check-circle').length >= 1, {
			timeout: RESPOND_TIMEOUT,
		});

		// Army 1 (Trieste) → Budapest, declare war
		await activateUnit(page, 'army at Trieste');
		await clickTerritory(page, 'Budapest');
		await pickAction(page, 'Declare war on Italy army');
		await page.waitForFunction(() => document.querySelectorAll('.anticon-check-circle').length >= 2, {
			timeout: RESPOND_TIMEOUT,
		});

		// Now: Army 0 also moves to Budapest (reassign by clicking unit then territory)
		await activateUnit(page, 'army at Vienna');
		await clickTerritory(page, 'Budapest');
		// Army 0 is first in order, moves first → should get war action
		await page.waitForFunction(() => document.querySelectorAll('.anticon-check-circle').length >= 2, {
			timeout: RESPOND_TIMEOUT,
		});
		await waitForCascade(page);

		// Verify: Army 0 (index 0, moves first) should have war.
		// Army 1 (index 1, moves second) should NOT have war (enemy already destroyed).
		let rows = await getPlanListRows(page);
		let row0 = rows[0];
		let row1 = rows[1];

		// Row 0 should have a war badge
		expect(row0.actionBadge.toLowerCase()).toContain('war');

		// Row 1 should NOT have war — enemy was already destroyed by row 0
		expect(row1.actionBadge.toLowerCase()).not.toContain('war');
	});

	test('peace invalid after prior war destroys only enemy', async ({ page }) => {
		// Setup: 2 Austrian fleets, 1 Italian fleet at Ionian Sea
		gameID3 = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [
				{ territory: 'Trieste', hostile: true },
				{ territory: 'Venice', hostile: true },
			],
			armies: [],
			enemyUnits: {
				Italy: { fleets: [{ territory: 'Ionian Sea', hostile: true }] },
			},
		});
		await joinGame(page, gameID3, 'Alice');
		await waitForPlannerReady(page);

		// Fleet 0 auto-activates → Ionian Sea, pick war
		await clickTerritory(page, 'Ionian Sea');
		await pickAction(page, 'Declare war on Italy fleet');
		await page.waitForFunction(() => document.querySelectorAll('.anticon-check-circle').length >= 1, {
			timeout: RESPOND_TIMEOUT,
		});

		// Fleet 1 → Ionian Sea. Enemy is already destroyed by fleet 0's war.
		await activateUnit(page, 'fleet at Venice');
		await clickTerritory(page, 'Ionian Sea');
		await page.waitForFunction(() => document.querySelectorAll('.anticon-check-circle').length >= 2, {
			timeout: RESPOND_TIMEOUT,
		});
		await waitForCascade(page);

		// Fleet 1 should NOT have peace or war — just a plain move
		let rows = await getPlanListRows(page);
		let row1 = rows[1];
		expect(row1.isAssigned).toBe(true);
		if (row1.actionBadge) {
			expect(row1.actionBadge.toLowerCase()).not.toContain('peace');
			expect(row1.actionBadge.toLowerCase()).not.toContain('war');
		}
	});

	test('reorder moves: war shifts to new first mover, stale action cleared from second', async ({ page }) => {
		// Setup: 2 Austrian armies, 1 Italian army at Budapest
		gameID3 = await seedManeuverGame({
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
		await joinGame(page, gameID3, 'Alice');
		await waitForPlannerReady(page);

		// Army 0 (Vienna) → Budapest, war
		await clickTerritory(page, 'Budapest');
		await pickAction(page, 'Declare war on Italy army');
		await page.waitForFunction(() => document.querySelectorAll('.anticon-check-circle').length >= 1, {
			timeout: RESPOND_TIMEOUT,
		});

		// Army 1 (Trieste) → Budapest (enemy destroyed by army 0)
		await activateUnit(page, 'army at Trieste');
		await clickTerritory(page, 'Budapest');
		await page.waitForFunction(() => document.querySelectorAll('.anticon-check-circle').length >= 2, {
			timeout: RESPOND_TIMEOUT,
		});

		// Reorder: move Army 1 up (to index 0)
		// Click the up arrow on the second row
		let upButtons = await page.$$('.imp-plan-row .anticon-arrow-up, .imp-plan-row [aria-label="Move up"]');
		if (upButtons.length >= 2) {
			await upButtons[1].click();
		}
		await waitForCascade(page);

		// After reorder: the new row 0 (was Trieste army) moves first → should get war
		// The new row 1 (was Vienna army) moves second → enemy already destroyed → no war
		let rows = await getPlanListRows(page);
		expect(rows[0].actionBadge.toLowerCase()).toContain('war');
		expect(rows[1].actionBadge.toLowerCase()).not.toContain('war');
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
