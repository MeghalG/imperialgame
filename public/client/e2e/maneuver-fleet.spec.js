// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	activateUnit,
	assignMove,
	getHighlightedTerritories,
	getPlanListRows,
} = require('./helpers/selectors');

// Tests for fleet-specific movement (§3.2 from maneuver-ui-spec.md)

let gameID;

test.describe('Maneuver Planner — Fleet Movement', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// Austria fleet at Trieste (port), army at Vienna
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

	test('fleet at port sees sea territories as destinations', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Fleet auto-activates (fleets come before armies)
		const highlights = await getHighlightedTerritories(page);

		// Should include sea territories (Ionian Sea is adjacent to Trieste)
		// and the port itself (stay in place)
		expect(highlights).toContain('Trieste');
		expect(highlights.some((t) => t.includes('Sea') || t.includes('Med') || t.includes('Atlantic'))).toBe(true);
	});

	test('fleet at port can stay in place', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Assign fleet to stay at Trieste
		await assignMove(page, 'fleet at Trieste', 'Trieste');

		// Plan row should show assigned with stay
		const rows = await getPlanListRows(page);
		const fleetRow = rows.find((r) => r.text.includes('Fleet') && r.text.includes('stay'));
		expect(fleetRow).toBeDefined();
		expect(fleetRow.isAssigned).toBe(true);
	});

	test('fleet destinations do not include non-adjacent land territories', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Fleet auto-activates; check destinations
		const highlights = await getHighlightedTerritories(page);

		// Fleet at port should NOT see inland territories like Vienna, Budapest, Prague
		expect(highlights).not.toContain('Vienna');
		expect(highlights).not.toContain('Budapest');
		expect(highlights).not.toContain('Prague');
	});
});
