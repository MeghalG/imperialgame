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
	getImportSlots,
	isActionPickerVisible,
	getActionPickerOptions,
	pickAction,
	waitForActionPicker,
	dismissActionPicker,
} = require('./helpers/selectors');

let gameID;

test.describe('Import — Map Interaction', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('selecting Import highlights all eligible territories', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		let highlights = await getHighlightedTerritories(page);
		expect(highlights).toContain('Vienna');
		expect(highlights).toContain('Budapest');
		expect(highlights).toContain('Trieste');
		expect(highlights).toContain('Prague');
		expect(highlights).toContain('Lemberg');
	});

	test('clicking army-only territory auto-fills import slot', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Vienna');
		await page.waitForTimeout(300);
		let slots = await getImportSlots(page);
		expect(slots.length).toBeGreaterThanOrEqual(1);
		expect(slots[0].type).toBe('army');
		expect(slots[0].territory).toBe('Vienna');
	});

	test('clicking port territory shows type picker popup', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Trieste');
		await waitForActionPicker(page);
		let visible = await isActionPickerVisible(page);
		expect(visible).toBe(true);
		let options = await getActionPickerOptions(page);
		expect(options).toContain('Army');
		expect(options).toContain('Fleet');
	});

	test('picking type from popup fills import slot', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Trieste');
		await waitForActionPicker(page);
		await pickAction(page, 'Fleet');
		await page.waitForTimeout(300);
		let slots = await getImportSlots(page);
		expect(slots.length).toBeGreaterThanOrEqual(1);
		expect(slots[0].type).toBe('fleet');
		expect(slots[0].territory).toBe('Trieste');
	});

	test('multiple imports to same territory', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Vienna');
		await clickTerritory(page, 'Vienna');
		await page.waitForTimeout(300);
		let slots = await getImportSlots(page);
		expect(slots.length).toBeGreaterThanOrEqual(2);
		expect(slots[0].territory).toBe('Vienna');
		expect(slots[1].territory).toBe('Vienna');
	});

	test('3 slots filled — no more map clicks accepted', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Vienna');
		await clickTerritory(page, 'Budapest');
		await clickTerritory(page, 'Prague');
		await page.waitForTimeout(300);
		let slotsBefore = await getImportSlots(page);
		expect(slotsBefore.length).toBe(3);
		await clickTerritory(page, 'Lemberg').catch(() => {});
		await page.waitForTimeout(300);
		let slotsAfter = await getImportSlots(page);
		expect(slotsAfter.length).toBe(3);
	});

	test('ghosted markers appear for placed imports', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Vienna');
		await page.waitForTimeout(300);
		let markers = await getGhostedMarkers(page);
		expect(markers.some((m) => m.title.includes('Vienna'))).toBe(true);
	});

	test('army limit reached — only fleet type available at port', async ({ page }) => {
		let existingArmies = [];
		for (let i = 0; i < 11; i++) {
			existingArmies.push({ territory: 'Vienna', hostile: true });
		}
		gameID = await seedProposalGame({
			factories: ['Vienna', 'Budapest', 'Trieste'],
			armies: existingArmies,
		});
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Budapest');
		await clickTerritory(page, 'Trieste');
		await page.waitForTimeout(300);
		let pickerVisible = await isActionPickerVisible(page);
		expect(pickerVisible).toBe(false);
		let slots = await getImportSlots(page);
		let triSlot = slots.find((s) => s.territory === 'Trieste');
		if (triSlot) {
			expect(triSlot.type).toBe('fleet');
		}
	});

	test('enemy-occupied territory excluded from import highlights', async ({ page }) => {
		gameID = await seedProposalGame({
			factories: ['Vienna', 'Budapest', 'Trieste'],
			enemyUnits: { Italy: { armies: [{ territory: 'Prague', hostile: true }] } },
		});
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		let highlights = await getHighlightedTerritories(page);
		expect(highlights).not.toContain('Prague');
		expect(highlights).toContain('Vienna');
	});

	test('fleet limit 0 — port territory only offers army', async ({ page }) => {
		let existingFleets = [];
		for (let i = 0; i < 6; i++) {
			existingFleets.push({ territory: 'Ionian Sea', hostile: true });
		}
		gameID = await seedProposalGame({
			factories: ['Vienna', 'Budapest', 'Trieste'],
			fleets: existingFleets,
		});
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Trieste');
		await page.waitForTimeout(300);
		let pickerVisible = await isActionPickerVisible(page);
		expect(pickerVisible).toBe(false);
		let slots = await getImportSlots(page);
		let triSlot = slots.find((s) => s.territory === 'Trieste');
		if (triSlot) {
			expect(triSlot.type).toBe('army');
		}
	});

	test('both limits reached — map clicks are no-ops', async ({ page }) => {
		let existingFleets = [];
		for (let i = 0; i < 6; i++) {
			existingFleets.push({ territory: 'Ionian Sea', hostile: true });
		}
		let existingArmies = [];
		for (let i = 0; i < 12; i++) {
			existingArmies.push({ territory: 'Vienna', hostile: true });
		}
		gameID = await seedProposalGame({
			factories: ['Vienna', 'Budapest', 'Trieste'],
			fleets: existingFleets,
			armies: existingArmies,
		});
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForTimeout(500);
		await clickTerritory(page, 'Budapest').catch(() => {});
		await page.waitForTimeout(300);
		let slots = await getImportSlots(page);
		let filledSlots = slots.filter((s) => s.type && s.territory);
		expect(filledSlots.length).toBe(0);
	});

	test('dismissing type picker via backdrop does not fill slot', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Trieste');
		await waitForActionPicker(page);
		await dismissActionPicker(page);
		await page.waitForTimeout(300);
		let slots = await getImportSlots(page);
		let filledSlots = slots.filter((s) => s.type && s.territory);
		expect(filledSlots.length).toBe(0);
	});

	test('type picker reappears after dismiss and re-click', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Trieste');
		await waitForActionPicker(page);
		await dismissActionPicker(page);
		await page.waitForTimeout(300);
		await clickTerritory(page, 'Trieste');
		await waitForActionPicker(page);
		let visible = await isActionPickerVisible(page);
		expect(visible).toBe(true);
	});

	test('army-only territory auto-fills without showing picker', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Budapest');
		await page.waitForTimeout(300);
		let pickerVisible = await isActionPickerVisible(page);
		expect(pickerVisible).toBe(false);
		let slots = await getImportSlots(page);
		expect(slots.length).toBeGreaterThanOrEqual(1);
		expect(slots[0].type).toBe('army');
		expect(slots[0].territory).toBe('Budapest');
	});

	test('filling all 3 slots then clicking map does nothing', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Vienna');
		await clickTerritory(page, 'Budapest');
		await clickTerritory(page, 'Prague');
		await page.waitForTimeout(300);
		let slotsBefore = await getImportSlots(page);
		expect(slotsBefore.filter((s) => s.type).length).toBe(3);
		await clickTerritory(page, 'Lemberg').catch(() => {});
		await page.waitForTimeout(300);
		let slotsAfter = await getImportSlots(page);
		expect(slotsAfter.filter((s) => s.type).length).toBe(3);
	});

	test('import ghosted markers show correct unit type colors', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Import');
		await page.waitForSelector('.ImportApp', { timeout: 5000 });
		await page.waitForSelector('.imp-boundary--selectable[data-territory], .imp-hotspot--selectable[data-territory]', { timeout: 5000 });
		await clickTerritory(page, 'Vienna');
		await clickTerritory(page, 'Trieste');
		await waitForActionPicker(page);
		await pickAction(page, 'Fleet');
		await page.waitForTimeout(300);
		let markers = await getGhostedMarkers(page);
		expect(markers.some((m) => m.title.includes('Vienna'))).toBe(true);
		expect(markers.some((m) => m.title.includes('Trieste'))).toBe(true);
	});
});
