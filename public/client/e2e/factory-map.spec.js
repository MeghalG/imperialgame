// @ts-check
const { test, expect } = require('@playwright/test');
const { seedProposalGame, seedSetupData, cleanupGame } = require('./helpers/seed');
const {
	joinGame,
	waitForProposalReady,
	selectWheelActionDropdown,
	getHighlightedTerritories,
	clickTerritory,
} = require('./helpers/selectors');

let gameID;

test.describe('Factory — Map Interaction', () => {
	test.beforeAll(async () => {
		await seedSetupData();
	});

	test.afterEach(async () => {
		if (gameID) await cleanupGame(gameID);
	});

	test('selecting Factory highlights buildable territories on map', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Factory');
		let highlights = await getHighlightedTerritories(page);
		expect(highlights).toContain('Trieste');
		expect(highlights).toContain('Prague');
		expect(highlights).toContain('Lemberg');
		expect(highlights).not.toContain('Vienna');
		expect(highlights).not.toContain('Budapest');
	});

	test('clicking territory on map selects it in the dropdown', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Factory');
		await clickTerritory(page, 'Trieste');
		let selected = await page.evaluate(() => {
			let sel = document.querySelector('.FactoryApp .ant-select-selection-item');
			return sel ? sel.textContent.trim() : '';
		});
		expect(selected).toBe('Trieste');
	});

	test('Factory with zero eligible territories shows empty', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest', 'Trieste', 'Prague', 'Lemberg'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Factory');
		let highlights = await getHighlightedTerritories(page);
		expect(highlights.length).toBe(0);
	});

	test('Factory with enemy-occupied territory excludes it', async ({ page }) => {
		gameID = await seedProposalGame({
			factories: ['Vienna', 'Budapest'],
			enemyUnits: { Italy: { armies: [{ territory: 'Prague', hostile: true }] } },
		});
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Factory');
		let highlights = await getHighlightedTerritories(page);
		expect(highlights).not.toContain('Prague');
		expect(highlights).toContain('Trieste');
		expect(highlights).toContain('Lemberg');
	});

	test('clicking different territory changes selection', async ({ page }) => {
		gameID = await seedProposalGame({ factories: ['Vienna', 'Budapest'] });
		await joinGame(page, gameID, 'Alice');
		await waitForProposalReady(page);
		await selectWheelActionDropdown(page, 'Factory');
		await clickTerritory(page, 'Trieste');
		let sel1 = await page.evaluate(() => {
			let sel = document.querySelector('.FactoryApp .ant-select-selection-item');
			return sel ? sel.textContent.trim() : '';
		});
		expect(sel1).toBe('Trieste');
		await clickTerritory(page, 'Prague');
		let sel2 = await page.evaluate(() => {
			let sel = document.querySelector('.FactoryApp .ant-select-selection-item');
			return sel ? sel.textContent.trim() : '';
		});
		expect(sel2).toBe('Prague');
	});
});
