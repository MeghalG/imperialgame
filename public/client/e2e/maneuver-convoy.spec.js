// @ts-check
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForPlannerReady,
	activateUnit,
	assignMove,
	getHighlightedTerritories,
	getArrowCount,
	getPlanListRows,
	RESPOND_TIMEOUT,
} = require('./helpers/selectors');

// Tests for convoy system (§3.4 from maneuver-ui-spec.md)

let gameID;

test.describe('Maneuver Planner — Convoy System', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.beforeEach(async () => {
		// Austria fleet at Trieste (can move to Ionian Sea for convoy),
		// army at Vienna (can use convoy to reach Italian territories)
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

	test('fleet at sea expands army reachable destinations via convoy', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// First, assign fleet to Ionian Sea (provides convoy)
		await assignMove(page, 'fleet at Trieste', 'Ionian Sea');

		// Now activate army — should have expanded destinations via convoy
		await activateUnit(page, 'army at Vienna');

		// Wait for convoy destinations to appear (Naples is across Ionian Sea)
		await page.waitForFunction(() => !!document.querySelector('.imp-boundary--selectable[data-territory="Naples"]'), {
			timeout: RESPOND_TIMEOUT,
		});

		const highlights = await getHighlightedTerritories(page);
		// Should include Naples (only reachable via convoy through Ionian Sea)
		expect(highlights).toContain('Naples');
		// Should still include base adjacencies
		expect(highlights).toContain('Vienna');
		expect(highlights).toContain('Budapest');
	});

	test('army convoy move renders movement arrow', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Fleet → Ionian Sea
		await assignMove(page, 'fleet at Trieste', 'Ionian Sea');

		// Army → Naples via convoy
		await activateUnit(page, 'army at Vienna');
		await page.waitForFunction(() => !!document.querySelector('.imp-boundary--selectable[data-territory="Naples"]'), {
			timeout: RESPOND_TIMEOUT,
		});
		await page.evaluate(() => {
			let el = document.querySelector('.imp-boundary--selectable[data-territory="Naples"]');
			if (!el) return;
			let rect = el.getBoundingClientRect();
			el.dispatchEvent(
				new MouseEvent('click', {
					bubbles: true,
					cancelable: true,
					clientX: rect.left + rect.width / 2,
					clientY: rect.top + rect.height / 2,
				})
			);
		});
		await page.waitForSelector('.imp-movement-arrow', { timeout: RESPOND_TIMEOUT });

		// Arrow should be rendered for the army's convoy move
		const arrows = await getArrowCount(page);
		expect(arrows).toBeGreaterThanOrEqual(1);
	});

	test('army convoy move shows convoy indicator in plan list', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Fleet → Ionian Sea (provides convoy)
		await assignMove(page, 'fleet at Trieste', 'Ionian Sea');

		// Army → Naples via convoy — wait for convoy destination to appear
		await activateUnit(page, 'army at Vienna');
		await page.waitForFunction(() => !!document.querySelector('[data-territory="Naples"].imp-boundary--selectable'), {
			timeout: RESPOND_TIMEOUT,
		});

		// Click Naples on the map
		await page.evaluate(() => {
			let el = document.querySelector('[data-territory="Naples"].imp-boundary--selectable');
			if (el) {
				let r = el.getBoundingClientRect();
				el.dispatchEvent(
					new MouseEvent('click', {
						bubbles: true,
						cancelable: true,
						clientX: r.left + r.width / 2,
						clientY: r.top + r.height / 2,
					})
				);
			}
		});

		// Wait for action picker to appear, then click first option
		await page.waitForSelector('.imp-action-picker', { timeout: RESPOND_TIMEOUT });
		await page.click('.imp-action-picker__btn');

		// Wait for the army row to show the convoy indicator (⛵)
		await page.waitForFunction(
			() => {
				let el = document.querySelector('[data-testid="convoy-indicator"]');
				return !!el;
			},
			{ timeout: RESPOND_TIMEOUT }
		);
	});

	test('land-only army move does NOT show convoy label', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Fleet → Ionian Sea (provides convoy, but army doesn't need it)
		await assignMove(page, 'fleet at Trieste', 'Ionian Sea');

		// Army → Budapest (adjacent by land, no convoy needed)
		await assignMove(page, 'army at Vienna', 'Budapest');

		// Plan list should NOT show convoy indicator for land move
		const noConvoy = await page.evaluate(() => !document.querySelector('[data-testid="convoy-indicator"]'));
		expect(noConvoy).toBe(true);
	});

	test('without fleet at sea, army cannot reach convoy destinations', async ({ page }) => {
		await joinGame(page, gameID, 'Alice');
		await waitForPlannerReady(page);

		// Assign fleet to stay at Trieste (port, not at sea — no convoy)
		await assignMove(page, 'fleet at Trieste', 'Trieste');

		// Activate army — should NOT have convoy destinations
		await activateUnit(page, 'army at Vienna');

		const highlights = await getHighlightedTerritories(page);
		// Naples should NOT be reachable (no fleet at sea for convoy)
		expect(highlights).not.toContain('Naples');
		expect(highlights).not.toContain('Rome');
	});
});
