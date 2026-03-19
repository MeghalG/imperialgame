// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	clickUnitMarker,
	activateUnit,
	getUnitMarkers,
	getHighlightedTerritories,
} = require('./helpers/selectors');

// Tests for unit activation state machine (§8.1 from maneuver-ui-spec.md)

let gameID;

test.describe('Maneuver Planner — Unit Activation', () => {
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

	test('first unit auto-activates when planner loads', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Territory highlights should already be visible (first army auto-activated)
		const highlights = await getHighlightedTerritories(page);
		expect(highlights.length).toBeGreaterThan(0);

		// One marker should be in active state
		const markers = await getUnitMarkers(page);
		const activeMarkers = markers.filter((m) => m.isActive);
		expect(activeMarkers.length).toBe(1);
	});

	test('clicking active unit keeps it active — highlights remain', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// First army auto-activates; verify highlights exist
		let highlights = await getHighlightedTerritories(page);
		expect(highlights.length).toBeGreaterThan(0);

		// Click the active marker again — stays active (no deactivation toggle)
		const markers = await getUnitMarkers(page);
		const activeMarker = markers.find((m) => m.isActive);
		expect(activeMarker).toBeDefined();
		await clickUnitMarker(page, activeMarker.title);

		// Highlights remain (re-clicking active unit is a no-op)
		highlights = await getHighlightedTerritories(page);
		expect(highlights.length).toBeGreaterThan(0);
	});

	test('clicking different unit switches active unit', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// First army auto-activates
		let markers = await getUnitMarkers(page);
		let active = markers.find((m) => m.isActive);
		expect(active).toBeDefined();
		const firstTitle = active.title;

		// Click the other army
		const otherTitle = firstTitle.includes('Vienna') ? 'army at Budapest' : 'army at Vienna';
		await activateUnit(page, otherTitle);

		// Active unit should have switched
		markers = await getUnitMarkers(page);
		active = markers.find((m) => m.isActive);
		expect(active).toBeDefined();
		expect(active.title).toBe(otherTitle);

		// Highlights should still be visible (for the new active unit)
		const highlights = await getHighlightedTerritories(page);
		expect(highlights.length).toBeGreaterThan(0);
	});
});
