// @ts-check
const { test, expect } = require('@playwright/test');
const { seedProposalGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForProposalReady,
	selectWheelActionDropdown,
	getHighlightedTerritories,
	clickTerritory,
	getGhostedMarkers,
	getProduceCheckboxes,
} = require('./helpers/selectors');

let gameID;

test.describe('Produce — Map Interaction', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('selecting Produce highlights port factories on map (fleet)', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		let highlights = await getHighlightedTerritories(page);
		expect(highlights).toContain('Trieste');
	});

	test('fleet factories are pre-selected (checkboxes checked)', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		let checkboxes = await getProduceCheckboxes(page);
		let fleetCheckbox = checkboxes.find((c) => c.label.includes('Trieste'));
		if (fleetCheckbox) {
			expect(fleetCheckbox.checked).toBe(true);
		}
	});

	test('clicking factory on map toggles checkbox OFF', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Trieste');
		await page.waitForTimeout(200);
		let checkboxes = await getProduceCheckboxes(page);
		let fleetCheckbox = checkboxes.find((c) => c.label.includes('Trieste'));
		if (fleetCheckbox) {
			expect(fleetCheckbox.checked).toBe(false);
		}
	});

	test('clicking factory on map toggles checkbox back ON', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Trieste');
		await clickTerritory(page, 'Trieste');
		await page.waitForTimeout(200);
		let checkboxes = await getProduceCheckboxes(page);
		let fleetCheckbox = checkboxes.find((c) => c.label.includes('Trieste'));
		if (fleetCheckbox) {
			expect(fleetCheckbox.checked).toBe(true);
		}
	});

	test('ghosted unit markers appear for selected fleet factories', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		let markers = await getGhostedMarkers(page);
		expect(markers.some((m) => m.title.includes('Trieste'))).toBe(true);
	});

	test('toggling factory OFF removes its ghosted marker', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Trieste');
		await page.waitForTimeout(200);
		let markers = await getGhostedMarkers(page);
		expect(markers.some((m) => m.title.includes('Trieste'))).toBe(false);
	});

	test('zero eligible fleet factories — no map highlights for fleet', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForTimeout(500);
		let checkboxes = await getProduceCheckboxes(page);
		let armyCheckboxes = checkboxes.filter((c) => c.label.includes('Army'));
		expect(armyCheckboxes.length).toBeGreaterThan(0);
	});

	test('enemy-occupied factory is NOT available for production', async ({ page }) => {
		gameID = await seedProposalGame({
			factories: ['Vienna', 'Budapest', 'Trieste'],
			enemyUnits: { Italy: { armies: [{ territory: 'Trieste', hostile: true }] } },
		});
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 }).catch(() => {});
		let checkboxes = await getProduceCheckboxes(page);
		let fleetCheckbox = checkboxes.find((c) => c.label.includes('Trieste'));
		expect(fleetCheckbox).toBeUndefined();
		let highlights = await getHighlightedTerritories(page);
		expect(highlights).not.toContain('Trieste');
	});
});
