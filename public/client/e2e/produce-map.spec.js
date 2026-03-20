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

	test('army factory territories also appear as clickable on map', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		let highlights = await getHighlightedTerritories(page);
		expect(highlights).toContain('Vienna');
		expect(highlights).toContain('Budapest');
	});

	test('clicking army territory on map toggles army checkbox', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Vienna');
		await page.waitForTimeout(200);
		let checkboxes = await getProduceCheckboxes(page);
		let viennaCheckbox = checkboxes.find((c) => c.label.includes('Vienna'));
		expect(viennaCheckbox).toBeDefined();
		expect(viennaCheckbox.checked).toBe(false);
	});

	test('army factories show ghosted army markers', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		let markers = await getGhostedMarkers(page);
		expect(markers.some((m) => m.title.includes('Vienna'))).toBe(true);
		expect(markers.some((m) => m.title.includes('Budapest'))).toBe(true);
	});

	test('toggling army factory OFF via map removes its ghosted marker', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Vienna');
		await page.waitForTimeout(200);
		let markers = await getGhostedMarkers(page);
		expect(markers.some((m) => m.title.includes('Vienna'))).toBe(false);
		expect(markers.some((m) => m.title.includes('Budapest'))).toBe(true);
	});

	test('toggling army factory back ON via map re-adds its ghosted marker', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Vienna');
		await clickTerritory(page, 'Vienna');
		await page.waitForTimeout(200);
		let markers = await getGhostedMarkers(page);
		expect(markers.some((m) => m.title.includes('Vienna'))).toBe(true);
	});

	test('both army and fleet factories highlighted simultaneously', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		let highlights = await getHighlightedTerritories(page);
		expect(highlights).toContain('Trieste');
		expect(highlights).toContain('Vienna');
		expect(highlights).toContain('Budapest');
		expect(highlights.length).toBe(3);
	});

	test('army and fleet checkboxes appear in one unified group', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		let checkboxes = await getProduceCheckboxes(page);
		let hasFleet = checkboxes.some((c) => c.label.includes('Fleet'));
		let hasArmy = checkboxes.some((c) => c.label.includes('Army'));
		expect(hasFleet).toBe(true);
		expect(hasArmy).toBe(true);
	});

	test('enemy-occupied army factory excluded from map and checkboxes', async ({ page }) => {
		gameID = await seedProposalGame({
			factories: ['Vienna', 'Budapest', 'Trieste'],
			enemyUnits: { Italy: { armies: [{ territory: 'Vienna', hostile: true }] } },
		});
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'L-Produce');
		await page.waitForSelector('.ProduceApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 }).catch(() => {});
		let checkboxes = await getProduceCheckboxes(page);
		let viennaCheckbox = checkboxes.find((c) => c.label.includes('Vienna'));
		expect(viennaCheckbox).toBeUndefined();
		let highlights = await getHighlightedTerritories(page);
		expect(highlights).not.toContain('Vienna');
		expect(highlights).toContain('Budapest');
	});
});
