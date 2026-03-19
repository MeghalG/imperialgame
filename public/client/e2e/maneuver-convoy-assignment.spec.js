// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	activateNthUnit,
	assignMove,
	assignNthMove,
	getHighlightedTerritories,
	getConvoyLabels,
	clickRemoveOnRow,
	RESPOND_TIMEOUT,
} = require('./helpers/selectors');

/**
 * Comprehensive convoy assignment tests.
 *
 * Setup: Italy has 2 fleets (Western Med + Ionian Sea) and 3 armies at Rome.
 * Map adjacencies (from fixture):
 *   Western Med → Spain, Tunis, Rome, Naples, ...
 *   Ionian Sea  → Tunis, Greece, Rome, Naples, Venice, ...
 *
 * Spain is ONLY adjacent to Western Med (needs WM convoy).
 * Greece is ONLY adjacent to Ionian Sea (needs IS convoy).
 * Tunis is adjacent to BOTH (can use either).
 */

let gameID;

test.describe('Convoy Assignment — Italy 2 fleets + 3 armies', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Italy',
			fleets: [
				{ territory: 'Western Med', hostile: false },
				{ territory: 'Ionian Sea', hostile: false },
			],
			armies: [
				{ territory: 'Rome', hostile: false },
				{ territory: 'Rome', hostile: false },
				{ territory: 'Rome', hostile: false },
			],
		});
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	/**
	 * Helper: assign both fleets to stay at their current sea positions.
	 */
	async function assignFleets(page) {
		await assignMove(page, 'fleet at Western Med', 'Western Med');
		await assignMove(page, 'fleet at Ionian Sea', 'Ionian Sea');
	}

	test('army to Spain is convoyed via Western Med', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);
		await assignFleets(page);

		// Assign first army → Spain
		await assignNthMove(page, 'army at Rome', 0, 'Spain');

		// Convoy label should show Western Med (Spain is only adjacent to WM)
		let labels = await getConvoyLabels(page);
		expect(labels.length).toBe(1);
		expect(labels[0]).toContain('Western Med');
	});

	test('army to Greece is convoyed via Ionian Sea', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);
		await assignFleets(page);

		// Assign first army → Greece
		await assignNthMove(page, 'army at Rome', 0, 'Greece');

		// Convoy label should show Ionian Sea (Greece is only adjacent to IS)
		let labels = await getConvoyLabels(page);
		expect(labels.length).toBe(1);
		expect(labels[0]).toContain('Ionian Sea');
	});

	test('after one convoy assigned, the second army has fewer options', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);
		await assignFleets(page);

		// Assign army 0 → Spain (uses Western Med convoy)
		await assignNthMove(page, 'army at Rome', 0, 'Spain');

		// Activate army 1 (the second unassigned army at Rome)
		await activateNthUnit(page, 'army at Rome', 1);

		// Spain should NOT be available (WM is used by army 0)
		// but Tunis and Greece should be (Ionian Sea is still free)
		let highlights = await getHighlightedTerritories(page);
		expect(highlights).not.toContain('Spain');
		expect(highlights).toContain('Tunis');
		expect(highlights).toContain('Greece');
	});

	test('reassigning first army makes all convoy destinations available again', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);
		await assignFleets(page);

		// Assign army 0 → Spain (uses WM), army 1 → Tunis (uses IS)
		await assignNthMove(page, 'army at Rome', 0, 'Spain');
		await assignNthMove(page, 'army at Rome', 1, 'Tunis');

		// Click remove on army 0 (row index 2 = third row, after 2 fleet rows)
		await clickRemoveOnRow(page, 2);

		// Activate army 0 again — ALL convoy destinations should be available
		// because removing army 0 freed WM, and army 1 (Tunis) can use either sea
		await activateNthUnit(page, 'army at Rome', 0);
		let highlights = await getHighlightedTerritories(page);
		expect(highlights).toContain('Spain');
		expect(highlights).toContain('Tunis');
		expect(highlights).toContain('Greece');
	});

	test('reassigning to a different convoy bumps other army convoy label', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);
		await assignFleets(page);

		// Assign: army 0 → Spain (WM), army 1 → Tunis (IS)
		await assignNthMove(page, 'army at Rome', 0, 'Spain');
		await assignNthMove(page, 'army at Rome', 1, 'Tunis');

		// Verify initial convoy assignments
		let labels = await getConvoyLabels(page);
		expect(labels).toContainEqual(expect.stringContaining('Western Med'));
		expect(labels).toContainEqual(expect.stringContaining('Ionian Sea'));

		// Remove army 0, then reassign it to Greece (needs IS)
		await clickRemoveOnRow(page, 2);
		await assignNthMove(page, 'army at Rome', 0, 'Greece');

		// Now: army 0 → Greece (IS), army 1 → Tunis (WM — bumped from IS to WM)
		labels = await getConvoyLabels(page);
		let greekConvoy = labels.find((l) => l.includes('Ionian Sea'));
		let tunisConvoy = labels.find((l) => l.includes('Western Med'));
		expect(greekConvoy).toBeTruthy();
		expect(tunisConvoy).toBeTruthy();
	});

	test('land-only moves show no convoy label', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);
		await assignFleets(page);

		// Move army to Naples (adjacent by land — Rome→Naples, both Italian)
		await assignNthMove(page, 'army at Rome', 0, 'Naples');

		// No convoy indicator should appear
		let labels = await getConvoyLabels(page);
		expect(labels.length).toBe(0);
	});
});
