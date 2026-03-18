/**
 * Page object helpers for maneuver planner E2E tests.
 *
 * These abstract away CSS selectors and common interaction patterns
 * so tests read like user stories, not DOM queries.
 */

/**
 * Navigate to a game and log in as a player.
 * Assumes the app is running at baseURL and the game exists in Firebase.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} gameID
 * @param {string} playerName
 */
async function joinGame(page, gameID, playerName) {
	// Navigate directly to the game using URL parameters.
	// App.js reads ?game=xxx&name=Alice from the URL on mount.
	await page.goto(`/?game=${encodeURIComponent(gameID)}&name=${encodeURIComponent(playerName)}`);
	// Wait for the game map to load
	await page.waitForSelector('.imp-map-container, [class*="MapApp"], svg, [class*="map"]', { timeout: 20000 });
}

/**
 * Wait for the maneuver planner to be ready.
 * @param {import('@playwright/test').Page} page
 */
async function waitForPlannerReady(page) {
	// The plan list container should be visible
	await page.waitForSelector('[class*="ManeuverPlan"], [class*="maneuver-plan"]', { timeout: 10000 });
}

/**
 * Get all unit markers currently visible on the map.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{phase: string, index: number, isActive: boolean, isPlanned: boolean}>>}
 */
async function getUnitMarkers(page) {
	return page.evaluate(() => {
		let markers = document.querySelectorAll('.imp-unit-marker');
		return Array.from(markers).map((el) => ({
			text: el.textContent,
			isActive: el.classList.contains('imp-unit-marker--active'),
			isPlanned: el.classList.contains('imp-unit-marker--planned'),
			isIdle: el.classList.contains('imp-unit-marker--idle'),
			title: el.getAttribute('title') || '',
		}));
	});
}

/**
 * Click a unit marker on the map by its title (e.g. "army at Vienna").
 * @param {import('@playwright/test').Page} page
 * @param {string} unitTitle - The title attribute of the marker (e.g. "army at Vienna")
 */
async function clickUnitMarker(page, unitTitle) {
	await page.click(`.imp-unit-marker[title="${unitTitle}"]`);
}

/**
 * Get all highlighted (selectable) territories on the map.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>} Array of territory names
 */
async function getHighlightedTerritories(page) {
	return page.evaluate(() => {
		let hotspots = document.querySelectorAll('.imp-hotspot--selectable, [class*="selectable"]');
		return Array.from(hotspots).map((el) => el.getAttribute('data-territory') || el.textContent.trim());
	});
}

/**
 * Click a territory hotspot on the map.
 * @param {import('@playwright/test').Page} page
 * @param {string} territoryName
 */
async function clickTerritory(page, territoryName) {
	await page.click(`[data-territory="${territoryName}"], .imp-hotspot:has-text("${territoryName}")`);
}

/**
 * Check if the action picker popup is visible.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function isActionPickerVisible(page) {
	return page.isVisible('[class*="ActionPicker"], [class*="action-picker"]');
}

/**
 * Get the action options shown in the action picker.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>} Array of action labels
 */
async function getActionPickerOptions(page) {
	return page.evaluate(() => {
		let picker = document.querySelector('[class*="ActionPicker"], [class*="action-picker"]');
		if (!picker) return [];
		let buttons = picker.querySelectorAll('button, [role="option"]');
		return Array.from(buttons).map((b) => b.textContent.trim());
	});
}

/**
 * Click an action in the action picker by its label text.
 * @param {import('@playwright/test').Page} page
 * @param {string} actionText - Partial text match (e.g. "war on Italy army")
 */
async function pickAction(page, actionText) {
	let picker = page.locator('[class*="ActionPicker"], [class*="action-picker"]');
	await picker.locator(`button:has-text("${actionText}"), [role="option"]:has-text("${actionText}")`).click();
}

/**
 * Get the plan list rows and their states.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{text: string, isAssigned: boolean, isLocked: boolean, actionBadge: string}>>}
 */
async function getPlanListRows(page) {
	return page.evaluate(() => {
		let rows = document.querySelectorAll('[class*="UnitRow"], [class*="unit-row"]');
		return Array.from(rows).map((row) => {
			let badge = row.querySelector('[class*="action-badge"], [class*="ActionBadge"]');
			return {
				text: row.textContent.trim(),
				isAssigned: !row.textContent.includes('unassigned'),
				isLocked: row.classList.contains('locked') || row.querySelector('[class*="lock"]') !== null,
				actionBadge: badge ? badge.textContent.trim() : '',
			};
		});
	});
}

/**
 * Click the remove (✕) button on a plan list row.
 * @param {import('@playwright/test').Page} page
 * @param {number} rowIndex - 0-based index of the row in the plan list
 */
async function clickRemoveOnRow(page, rowIndex) {
	let rows = page.locator('[class*="UnitRow"], [class*="unit-row"]');
	await rows.nth(rowIndex).locator('button:has-text("✕"), [class*="remove"], .anticon-close').click();
}

/**
 * Get the submit/peace FAB button state.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{visible: boolean, text: string, disabled: boolean}>}
 */
async function getSubmitButtonState(page) {
	let fab = page.locator('[class*="SubmitFAB"], [class*="submit-fab"], button:has-text("Submit"), button:has-text("Peace")');
	let visible = await fab.isVisible().catch(() => false);
	if (!visible) return { visible: false, text: '', disabled: true };
	let text = await fab.textContent().catch(() => '');
	let disabled = await fab.isDisabled().catch(() => true);
	return { visible, text: text.trim(), disabled };
}

/**
 * Click the submit/peace button.
 * @param {import('@playwright/test').Page} page
 */
async function clickSubmit(page) {
	await page.click('[class*="SubmitFAB"], [class*="submit-fab"], button:has-text("Submit"), button:has-text("Peace")');
}

/**
 * Get the count of movement arrows visible on the map.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
async function getArrowCount(page) {
	return page.evaluate(() => {
		return document.querySelectorAll('.imp-arrow').length;
	});
}

module.exports = {
	joinGame,
	waitForPlannerReady,
	getUnitMarkers,
	clickUnitMarker,
	getHighlightedTerritories,
	clickTerritory,
	isActionPickerVisible,
	getActionPickerOptions,
	pickAction,
	getPlanListRows,
	clickRemoveOnRow,
	getSubmitButtonState,
	clickSubmit,
	getArrowCount,
};
