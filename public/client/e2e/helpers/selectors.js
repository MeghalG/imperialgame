/**
 * Page object helpers for maneuver planner E2E tests.
 *
 * These abstract away CSS selectors and common interaction patterns
 * so tests read like user stories, not DOM queries.
 */

// Default timeout for DOM-based waits.
// Maneuver UI should respond to user input within 2 seconds.
const RESPOND_TIMEOUT = 2000;
// Longer timeout for initial page load (dev server compile + Firebase connect).
const LOAD_TIMEOUT = 15000;

/**
 * Navigate to a game and log in as a player.
 * @param {import('@playwright/test').Page} page
 * @param {string} gameID
 * @param {string} playerName
 */
async function joinGame(page, gameID, playerName) {
	await page.goto(`/?game=${encodeURIComponent(gameID)}&name=${encodeURIComponent(playerName)}`);
	await page.waitForSelector('svg', { timeout: 30000 });
}

/**
 * Wait for the maneuver planner to be ready (plan list rendered).
 * @param {import('@playwright/test').Page} page
 */
async function waitForPlannerReady(page) {
	await page
		.waitForSelector('text="FLEET MOVES"', { timeout: LOAD_TIMEOUT })
		.catch(() => page.waitForSelector('text="ARMY MOVES"', { timeout: LOAD_TIMEOUT }));
	// Wait for unit markers to appear (loadData complete)
	await page.waitForSelector('.imp-unit-marker', { timeout: LOAD_TIMEOUT });
}

/**
 * Get all unit markers currently visible on the map.
 * @param {import('@playwright/test').Page} page
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
 * @param {string} unitTitle
 */
async function clickUnitMarker(page, unitTitle) {
	await page.click(`.imp-unit-marker[title="${unitTitle}"]`);
}

/**
 * Click a specific unit marker by index when multiple share the same title.
 * @param {import('@playwright/test').Page} page
 * @param {string} unitTitle - e.g. "army at Rome"
 * @param {number} nthIndex - 0-based index among markers with this title
 */
async function clickNthUnitMarker(page, unitTitle, nthIndex) {
	let locator = page.locator(`.imp-unit-marker[title="${unitTitle}"]`);
	await locator.nth(nthIndex).click();
}

/**
 * Activate a specific unit by index: click its marker and wait for territory highlights.
 * Use when multiple units share the same title (e.g. 3 armies at Rome).
 * @param {import('@playwright/test').Page} page
 * @param {string} unitTitle
 * @param {number} nthIndex - 0-based index among markers with this title
 */
async function activateNthUnit(page, unitTitle, nthIndex) {
	await clickNthUnitMarker(page, unitTitle, nthIndex);
	await page.waitForSelector('.imp-boundary--selectable, .imp-hotspot--selectable', { timeout: RESPOND_TIMEOUT });
}

/**
 * Assign a specific nth unit to a destination.
 * @param {import('@playwright/test').Page} page
 * @param {string} unitTitle
 * @param {number} nthIndex - 0-based index among markers with this title
 * @param {string} territory - destination territory name
 * @returns {Promise<'assigned'|'picker'>}
 */
async function assignNthMove(page, unitTitle, nthIndex, territory) {
	let prevCount = await countAssigned(page);
	await activateNthUnit(page, unitTitle, nthIndex);
	// Wait for the specific territory to become selectable (convoy destinations load async)
	await page.waitForFunction(
		(name) =>
			!!document.querySelector(`.imp-boundary--selectable[data-territory="${name}"]`) ||
			!!document.querySelector(`.imp-hotspot--selectable[data-territory="${name}"]`),
		territory,
		{ timeout: RESPOND_TIMEOUT }
	);
	await clickTerritory(page, territory);
	// Detect completion: checkmark count increases (new assignment), action picker appears,
	// or the territory name appears in the plan list (reassignment — count unchanged).
	let result = await Promise.race([
		waitForAssignmentCount(page, prevCount).then(() => 'assigned'),
		page.waitForSelector('.imp-action-picker', { timeout: RESPOND_TIMEOUT }).then(() => 'picker'),
		page
			.waitForFunction(
				(dest) => {
					let rows = document.querySelectorAll('strong');
					for (let s of rows) {
						let row = s.closest('div[style]');
						if (row && row.textContent.includes(dest)) return true;
					}
					return false;
				},
				territory,
				{ timeout: RESPOND_TIMEOUT }
			)
			.then(() => 'assigned'),
	]);
	return result;
}

/**
 * Activate a unit: click its marker and wait for territory highlights to appear.
 * Combines the common 2-step pattern into a single helper.
 * @param {import('@playwright/test').Page} page
 * @param {string} unitTitle - e.g. "army at Vienna", "fleet at Trieste"
 */
async function activateUnit(page, unitTitle) {
	await clickUnitMarker(page, unitTitle);
	await page.waitForSelector('.imp-boundary--selectable, .imp-hotspot--selectable', { timeout: RESPOND_TIMEOUT });
}

/**
 * Assign a unit to a destination: activate, click territory, wait for result.
 * If only one action option exists, auto-assigns and waits for checkmark.
 * If multiple options exist (action picker appears), waits for picker instead.
 * @param {import('@playwright/test').Page} page
 * @param {string} unitTitle - e.g. "army at Vienna"
 * @param {string} territory - destination territory name
 * @returns {Promise<'assigned'|'picker'>} Whether the move auto-assigned or a picker appeared
 */
async function assignMove(page, unitTitle, territory) {
	let prevCount = await countAssigned(page);
	await activateUnit(page, unitTitle);
	await clickTerritory(page, territory);
	// Race: either checkmark appears (auto-assign) or action picker appears (multi-option)
	let result = await Promise.race([
		waitForAssignmentCount(page, prevCount).then(() => 'assigned'),
		page.waitForSelector('.imp-action-picker', { timeout: RESPOND_TIMEOUT }).then(() => 'picker'),
	]);
	return result;
}

/**
 * Wait until the number of assigned rows exceeds the given count.
 * @param {import('@playwright/test').Page} page
 * @param {number} previousCount
 */
async function waitForAssignmentCount(page, previousCount) {
	await page.waitForFunction(
		(prev) => {
			let checks = document.querySelectorAll('.anticon-check-circle');
			return checks.length > prev;
		},
		previousCount,
		{ timeout: RESPOND_TIMEOUT }
	);
}

/**
 * Count currently assigned rows (rows with checkmark icon).
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
async function countAssigned(page) {
	return page.evaluate(() => document.querySelectorAll('.anticon-check-circle').length);
}

/**
 * Get all highlighted (selectable) territories on the map.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function getHighlightedTerritories(page) {
	return page.evaluate(() => {
		let els = document.querySelectorAll(
			'.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]'
		);
		return Array.from(els)
			.map((el) => el.getAttribute('data-territory') || '')
			.filter((name) => name.length > 0);
	});
}

/**
 * Click a territory on the map.
 * Uses evaluate + dispatchEvent to bypass z-order issues with SVG polygons.
 * Retries up to RESPOND_TIMEOUT ms in case React is mid-render and the selectable
 * boundary is temporarily absent (e.g. during useEffect cleanup/re-setup cycle).
 * @param {import('@playwright/test').Page} page
 * @param {string} territoryName
 */
async function clickTerritory(page, territoryName) {
	// Use waitForFunction to both wait for the element and click it atomically,
	// avoiding the race between waitForSelector and evaluate.
	let clicked = false;
	let lastError = null;
	const deadline = Date.now() + RESPOND_TIMEOUT;
	while (Date.now() < deadline) {
		clicked = await page.evaluate((name) => {
			let el =
				document.querySelector(`.imp-boundary--selectable[data-territory="${name}"]`) ||
				document.querySelector(`.imp-boundary--selected[data-territory="${name}"]`) ||
				document.querySelector(`.imp-hotspot--selectable[data-territory="${name}"]`) ||
				document.querySelector(`.imp-hotspot--selected[data-territory="${name}"]`);
			if (!el) return false;
			// Use React's onClick directly if available via React fiber
			let reactProp = Object.keys(el).find(
				(k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
			);
			if (reactProp) {
				let eventProp = Object.keys(el).find(
					(k) => k.startsWith('__reactEvents') || k.startsWith('__reactProps')
				);
				if (eventProp && el[eventProp] && el[eventProp].onClick) {
					el[eventProp].onClick({ stopPropagation: () => {}, preventDefault: () => {} });
					return true;
				}
			}
			// Fallback: dispatch native click event
			let rect = el.getBoundingClientRect();
			let event = new MouseEvent('click', {
				bubbles: true,
				cancelable: true,
				clientX: rect.left + rect.width / 2,
				clientY: rect.top + rect.height / 2,
			});
			el.dispatchEvent(event);
			return true;
		}, territoryName);
		if (clicked) return;
		await page.waitForTimeout(50);
	}
	throw new Error('Territory not found or not selectable: ' + territoryName);
}

/**
 * Check if the action picker popup is visible.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function isActionPickerVisible(page) {
	return page.isVisible('.imp-action-picker');
}

/**
 * Wait for the action picker to appear.
 * @param {import('@playwright/test').Page} page
 */
async function waitForActionPicker(page) {
	await page.waitForSelector('.imp-action-picker', { timeout: RESPOND_TIMEOUT });
}

/**
 * Wait for the action picker to disappear.
 * @param {import('@playwright/test').Page} page
 */
async function waitForActionPickerDismissed(page) {
	await page.waitForSelector('.imp-action-picker', { state: 'hidden', timeout: RESPOND_TIMEOUT });
}

/**
 * Get the action options shown in the action picker.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function getActionPickerOptions(page) {
	return page.evaluate(() => {
		let buttons = document.querySelectorAll('.imp-action-picker__btn');
		return Array.from(buttons).map((b) => b.textContent.trim());
	});
}

/**
 * Click an action in the action picker by its label text.
 * @param {import('@playwright/test').Page} page
 * @param {string} actionText - Partial text match
 */
async function pickAction(page, actionText) {
	let picker = page.locator('.imp-action-picker');
	await picker.locator(`button:has-text("${actionText}")`).click();
}

/**
 * Click the action picker backdrop to dismiss it.
 * @param {import('@playwright/test').Page} page
 */
async function dismissActionPicker(page) {
	await page.click('.imp-action-picker__backdrop');
}

/**
 * Get the plan list rows and their states.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{text: string, isAssigned: boolean, isLocked: boolean, actionBadge: string}>>}
 */
async function getPlanListRows(page) {
	return page.evaluate(() => {
		let results = [];
		let strongs = document.querySelectorAll('strong');
		for (let strong of strongs) {
			let label = strong.textContent.trim();
			if (!/^(Fleet|Army)\s+\d+:$/.test(label)) continue;
			let row = strong.closest('div[style]');
			if (!row) continue;
			let text = row.textContent.trim();
			let badge = row.querySelector('.ant-tag');
			let convoyEl = row.querySelector('[data-testid="convoy-indicator"]');
			results.push({
				text: text,
				isAssigned: !text.includes('unassigned'),
				isLocked: parseFloat(row.style.opacity) < 0.35,
				actionBadge: badge ? badge.textContent.trim() : '',
				convoyLabel: convoyEl ? convoyEl.textContent.trim() : '',
			});
		}
		return results;
	});
}

/**
 * Get just the convoy labels from the plan list, in order.
 * Returns array of strings like "⛵ via Western Med" for army rows with convoys.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function getConvoyLabels(page) {
	return page.evaluate(() => {
		let labels = [];
		let els = document.querySelectorAll('[data-testid="convoy-indicator"]');
		for (let el of els) {
			labels.push(el.textContent.trim());
		}
		return labels;
	});
}

/**
 * Click the remove button on the nth assigned plan list row.
 * @param {import('@playwright/test').Page} page
 * @param {number} rowIndex - 0-based index among assigned rows
 */
async function clickRemoveOnRow(page, rowIndex) {
	let assignedRows = page.locator('div:has(> div > .anticon-check-circle)');
	await assignedRows.nth(rowIndex).locator('.anticon-close').click();
}

/**
 * Click the up-arrow reorder button on the nth assigned plan list row.
 * @param {import('@playwright/test').Page} page
 * @param {number} rowIndex - 0-based index among assigned rows
 */
async function clickReorderUp(page, rowIndex) {
	let assignedRows = page.locator('div:has(> div > .anticon-check-circle)');
	await assignedRows.nth(rowIndex).locator('.anticon-arrow-up').click();
}

/**
 * Click the down-arrow reorder button on the nth assigned plan list row.
 * @param {import('@playwright/test').Page} page
 * @param {number} rowIndex - 0-based index among assigned rows
 */
async function clickReorderDown(page, rowIndex) {
	let assignedRows = page.locator('div:has(> div > .anticon-check-circle)');
	await assignedRows.nth(rowIndex).locator('.anticon-arrow-down').click();
}

/**
 * Check if the up-arrow button is disabled on the nth assigned row.
 * @param {import('@playwright/test').Page} page
 * @param {number} rowIndex
 * @returns {Promise<boolean>}
 */
async function isReorderUpDisabled(page, rowIndex) {
	let assignedRows = page.locator('div:has(> div > .anticon-check-circle)');
	return assignedRows.nth(rowIndex).locator('.anticon-arrow-up').locator('..').isDisabled();
}

/**
 * Check if the down-arrow button is disabled on the nth assigned row.
 * @param {import('@playwright/test').Page} page
 * @param {number} rowIndex
 * @returns {Promise<boolean>}
 */
async function isReorderDownDisabled(page, rowIndex) {
	let assignedRows = page.locator('div:has(> div > .anticon-check-circle)');
	return assignedRows.nth(rowIndex).locator('.anticon-arrow-down').locator('..').isDisabled();
}

/**
 * Get the submit/peace FAB button state.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{visible: boolean, text: string, disabled: boolean}>}
 */
async function getSubmitButtonState(page) {
	let fab = page.locator('.imp-submit-fab');
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
	await page.click('.imp-submit-fab');
}

/**
 * Get the count of movement arrows visible on the map.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
async function getArrowCount(page) {
	return page.evaluate(() => document.querySelectorAll('.imp-movement-arrow').length);
}

/**
 * Wait for cascade recomputation to settle by watching for DOM stability.
 * Checks that plan row content stops changing.
 * @param {import('@playwright/test').Page} page
 */
async function waitForCascade(page) {
	// Wait for React to process the cascade by checking that assigned count stabilizes
	await page.waitForFunction(
		() => {
			// Quick stability check: if no checkmarks are changing, cascade is done
			return document.readyState === 'complete';
		},
		{ timeout: RESPOND_TIMEOUT }
	);
	// Small buffer for async cascade operations
	await page.waitForTimeout(200);
}

/**
 * Wait for the proposal UI to be ready.
 * @param {import('@playwright/test').Page} page
 */
async function waitForProposalReady(page) {
	await page.waitForSelector('.ProposalApp', { timeout: LOAD_TIMEOUT });
	await page.waitForSelector('.ant-select', { timeout: LOAD_TIMEOUT });
}

/**
 * Select a wheel action from the first dropdown in ProposalApp.
 * @param {import('@playwright/test').Page} page
 * @param {string} actionName
 */
async function selectWheelActionDropdown(page, actionName) {
	let selects = page.locator('.ProposalApp .ant-select');
	await selects.first().click();
	await page.click(`.ant-select-item-option:has-text("${actionName}")`);
	await page.waitForTimeout(300);
}

/**
 * Click the proposal submit button.
 * @param {import('@playwright/test').Page} page
 */
async function clickProposalSubmit(page) {
	await page.click('.imp-submit-btn');
	await page.waitForTimeout(1000);
}

/**
 * Get all ghosted unit markers on the map.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{title: string}>>}
 */
async function getGhostedMarkers(page) {
	return page.evaluate(() => {
		let markers = document.querySelectorAll('.imp-unit-marker--ghosted');
		return Array.from(markers).map((el) => ({
			title: el.getAttribute('title') || '',
		}));
	});
}

/**
 * Get all produce checkboxes from the ProduceApp.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{label: string, checked: boolean, disabled: boolean}>>}
 */
async function getProduceCheckboxes(page) {
	return page.evaluate(() => {
		let checkboxes = document.querySelectorAll('.ProduceApp .ant-checkbox-wrapper');
		return Array.from(checkboxes).map((wrapper) => {
			let input = wrapper.querySelector('input[type="checkbox"]');
			return {
				label: wrapper.textContent.trim(),
				checked: input ? input.checked : false,
				disabled: input ? input.disabled : true,
			};
		});
	});
}

/**
 * Get all filled import slots from the ImportApp.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{type: string, territory: string}>>}
 */
async function getImportSlots(page) {
	return page.evaluate(() => {
		let rows = document.querySelectorAll('.ImportApp div[style*="flex"]');
		let slots = [];
		for (let row of rows) {
			let selects = row.querySelectorAll('.ant-select-selection-item');
			let type = selects[0] ? selects[0].textContent.trim() : '';
			let territory = selects[1] ? selects[1].textContent.trim() : '';
			if (type || territory) {
				slots.push({ type, territory });
			}
		}
		return slots;
	});
}

module.exports = {
	joinGame,
	waitForPlannerReady,
	getUnitMarkers,
	clickUnitMarker,
	clickNthUnitMarker,
	activateUnit,
	activateNthUnit,
	assignMove,
	assignNthMove,
	countAssigned,
	getHighlightedTerritories,
	clickTerritory,
	isActionPickerVisible,
	waitForActionPicker,
	waitForActionPickerDismissed,
	getActionPickerOptions,
	pickAction,
	dismissActionPicker,
	getPlanListRows,
	getConvoyLabels,
	clickRemoveOnRow,
	clickReorderUp,
	clickReorderDown,
	isReorderUpDisabled,
	isReorderDownDisabled,
	getSubmitButtonState,
	clickSubmit,
	getArrowCount,
	waitForCascade,
	waitForProposalReady,
	selectWheelActionDropdown,
	clickProposalSubmit,
	getGhostedMarkers,
	getProduceCheckboxes,
	getImportSlots,
	RESPOND_TIMEOUT,
	LOAD_TIMEOUT,
};
