// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	getUnitMarkers,
	clickUnitMarker,
	getHighlightedTerritories,
	clickTerritory,
	isActionPickerVisible,
	getPlanListRows,
	getArrowCount,
	getSubmitButtonState,
} = require('./helpers/selectors');

// These tests target SPEC behavior from docs/maneuver-ui-spec.md.
// Many will initially FAIL because the current implementation doesn't
// match the spec. They go green as we implement Phases 1-3.

let gameID;

test.describe('Maneuver Planner — Basics', () => {
	test.beforeEach(async () => {
		// Seed a game with Austria having 1 fleet (at Trieste port) and 2 armies
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [{ territory: 'Trieste', hostile: true }],
			armies: [
				{ territory: 'Vienna', hostile: true },
				{ territory: 'Budapest', hostile: true },
			],
		});
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('planner opens with all units unassigned', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		const rows = await getPlanListRows(page);
		// 1 fleet + 2 armies = 3 rows
		expect(rows.length).toBe(3);
		// All should be unassigned
		for (const row of rows) {
			expect(row.isAssigned).toBe(false);
		}
	});

	test('clicking unit marker shows destination highlights on map', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Click Army 1 at Vienna
		await clickUnitMarker(page, 'army at Vienna');

		// Map should show highlighted territories (Army's reachable destinations)
		const highlights = await getHighlightedTerritories(page);
		expect(highlights.length).toBeGreaterThan(0);
		// Vienna itself should be highlighted (can stay in place)
		expect(highlights).toContain('Vienna');
	});

	test('clicking highlighted territory assigns destination and shows arrow', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Activate Army 1
		await clickUnitMarker(page, 'army at Vienna');
		// Click a reachable territory
		await clickTerritory(page, 'Budapest');

		// Arrow should appear
		const arrows = await getArrowCount(page);
		expect(arrows).toBeGreaterThanOrEqual(1);

		// Plan list should show the assignment
		const rows = await getPlanListRows(page);
		const assignedRow = rows.find((r) => r.isAssigned);
		expect(assignedRow).toBeDefined();
	});

	test('action picker appears when moving to territory with enemy units', async ({ page }) => {
		// Seed with Italian army at Rome
		if (gameID) await cleanupGame(gameID);
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			fleets: [],
			armies: [{ territory: 'Vienna', hostile: true }],
			enemyUnits: {
				Italy: { armies: [{ territory: 'Rome', hostile: true }] },
			},
		});

		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Activate Army 1
		await clickUnitMarker(page, 'army at Vienna');
		// Click Rome (has enemy)
		await clickTerritory(page, 'Rome');

		// Action picker should appear with war + peace options
		const pickerVisible = await isActionPickerVisible(page);
		expect(pickerVisible).toBe(true);
	});

	test('stay in place by clicking origin territory', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Activate Army 1 at Vienna
		await clickUnitMarker(page, 'army at Vienna');
		// Click Vienna itself (origin, should be gold-highlighted)
		await clickTerritory(page, 'Vienna');

		// Should auto-assign move action (stay in place)
		const rows = await getPlanListRows(page);
		const viennaRow = rows.find((r) => r.isAssigned && r.text.includes('Vienna'));
		expect(viennaRow).toBeDefined();
		// No action picker should appear for stay-in-place
		const pickerVisible = await isActionPickerVisible(page);
		expect(pickerVisible).toBe(false);
	});
});
