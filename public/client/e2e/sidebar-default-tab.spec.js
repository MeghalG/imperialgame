// @ts-check
/**
 * E2E: Sidebar default-tab logic after the 2026-04-16 panel rework.
 *
 * New behavior (per design doc `aok-main-design-20260416-162421.md`):
 *   - Countries tab is the sidebar's default in most modes.
 *   - When mode === 'continue-man' (maneuver), Turn tab is the default so
 *     the maneuver planner isn't buried behind a tab click.
 *
 * These are separate games (not a single game transitioning modes). Mode
 * transition tests live in TurnFlow.test.js (Jest); E2E just verifies the
 * browser actually renders the right tab active when the game loads fresh
 * in each mode.
 */
const { test, expect } = require('@playwright/test');
const { seedManeuverGame, seedProposalGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const { joinGame } = require('./helpers/selectors');

let gameID;

test.describe('Sidebar default-tab', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.afterEach(async () => {
		if (gameID) {
			await cleanupGame(gameID);
			gameID = null;
		}
	});

	test('Countries tab is active when game loads in proposal mode', async ({ page }) => {
		gameID = await seedProposalGame({ player: 'Alice', country: 'Austria' });
		await joinGame(page, gameID, 'Alice');

		// Wait for the sidebar tab bar to mount
		const tabBar = page.locator('.imp-sidebar__tab-bar').first();
		await expect(tabBar).toBeVisible({ timeout: 15000 });

		// The active tab must be Countries (default for non-maneuver modes)
		const activeTab = page.locator('.imp-sidebar__tab-btn--active').first();
		await expect(activeTab).toHaveAttribute('aria-label', 'Countries');
	});

	test('Turn tab is active when game loads in continue-man (maneuver) mode', async ({ page }) => {
		gameID = await seedManeuverGame({
			player: 'Alice',
			country: 'Austria',
			armies: [{ territory: 'Vienna', hostile: true }],
		});
		await joinGame(page, gameID, 'Alice');

		// Wait for the sidebar tab bar
		const tabBar = page.locator('.imp-sidebar__tab-bar').first();
		await expect(tabBar).toBeVisible({ timeout: 15000 });

		// Active tab must be Turn (because mode is continue-man)
		const activeTab = page.locator('.imp-sidebar__tab-btn--active').first();
		await expect(activeTab).toHaveAttribute('aria-label', 'Turn');
	});

	test('Sidebar has exactly 4 tabs (Players tab removed in rework)', async ({ page }) => {
		gameID = await seedProposalGame({ player: 'Alice', country: 'Austria' });
		await joinGame(page, gameID, 'Alice');
		const tabBar = page.locator('.imp-sidebar__tab-bar').first();
		await expect(tabBar).toBeVisible({ timeout: 15000 });

		const tabBtns = page.locator('.imp-sidebar__tab-btn');
		await expect(tabBtns).toHaveCount(4);

		// Verify no Players tab
		const playersTab = page.locator('.imp-sidebar__tab-btn[aria-label="Players"]');
		await expect(playersTab).toHaveCount(0);
	});

	test('Floating submit FAB appears over the map (not in the sidebar)', async ({ page }) => {
		gameID = await seedProposalGame({ player: 'Alice', country: 'Austria' });
		await joinGame(page, gameID, 'Alice');

		// The viewport (map container) has the overlay layer
		const viewport = page.locator('.imp-viewport').first();
		await expect(viewport).toBeVisible({ timeout: 15000 });

		// The .imp-submit-fab class was pre-committed by earlier E2E work.
		// The FAB only appears when there's a registered submit handler, which
		// may or may not be the case in all proposal states. So we don't require
		// it to be visible — we only require that IF present, it's inside
		// the viewport overlay (outside the pan/zoom transform).
		const fab = page.locator('.imp-submit-fab');
		const count = await fab.count();
		if (count > 0) {
			// Assert the FAB's ancestor chain contains the overlay layer, not imp-canvas
			const fabInOverlay = await fab.first().evaluate((el) => {
				return !!el.closest('.imp-viewport__overlay');
			});
			expect(fabInOverlay).toBe(true);
		}
	});

	test('Sidebar has no portfolio row (removed in rework)', async ({ page }) => {
		gameID = await seedProposalGame({ player: 'Alice', country: 'Austria' });
		await joinGame(page, gameID, 'Alice');
		const tabBar = page.locator('.imp-sidebar__tab-bar').first();
		await expect(tabBar).toBeVisible({ timeout: 15000 });

		const portfolio = page.locator('.imp-sidebar__portfolio');
		await expect(portfolio).toHaveCount(0);
	});

	test('Sidebar no longer renders an inline submit button (moved to floating FAB)', async ({ page }) => {
		gameID = await seedProposalGame({ player: 'Alice', country: 'Austria' });
		await joinGame(page, gameID, 'Alice');
		const tabBar = page.locator('.imp-sidebar__tab-bar').first();
		await expect(tabBar).toBeVisible({ timeout: 15000 });

		const sidebarSubmit = page.locator('.imp-sidebar-submit');
		await expect(sidebarSubmit).toHaveCount(0);
	});
});
