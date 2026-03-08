// ---------------------------------------------------------------------------
// ManeuverPlannerApp.test.js — Tests for the plan-based maneuver UI
// ---------------------------------------------------------------------------

import React from 'react';
import ReactDOM from 'react-dom';

let mockDbData = {};
let mockSetupData = {};

function mockGetNestedValue(obj, path) {
	if (!path) return obj;
	const parts = path.split('/');
	let current = obj;
	for (const part of parts) {
		if (current == null) return undefined;
		current = current[part];
	}
	return current;
}

jest.mock('./backendFiles/firebase.js', () => ({
	database: {
		ref: jest.fn((path) => ({
			once: jest.fn(() =>
				Promise.resolve({
					val: () => {
						const raw = mockGetNestedValue(mockDbData, path);
						return raw !== undefined ? JSON.parse(JSON.stringify(raw)) : null;
					},
				})
			),
			on: jest.fn(),
			off: jest.fn(),
		})),
	},
}));

// Mock proposalAPI to avoid complex territory/adjacency lookups
jest.mock('./backendFiles/proposalAPI.js', () => ({
	getUnitOptionsFromPlans: jest.fn(() => Promise.resolve(['Adriatic Sea', 'Ionian Sea', 'Trieste'])),
	getUnitActionOptionsFromPlans: jest.fn(() => Promise.resolve([])),
	getCurrentUnitOptions: jest.fn(() => Promise.resolve([])),
	getCurrentUnitActionOptions: jest.fn(() => Promise.resolve([])),
}));

import ManeuverPlannerApp from './ManeuverPlannerApp.js';
import UserContext from './UserContext.js';
import { clearCache } from './backendFiles/stateCache.js';

async function flushPromises() {
	for (let i = 0; i < 15; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function renderWithContext(contextValue, div) {
	ReactDOM.render(
		<UserContext.Provider value={contextValue}>
			<ManeuverPlannerApp />
		</UserContext.Provider>,
		div
	);
}

function buildManeuverGameState() {
	return {
		setup: 'standard',
		currentManeuver: {
			country: 'Austria',
			wheelSpot: 'L-Maneuver',
			phase: 'fleet',
			unitIndex: 0,
			player: 'Alice',
			returnMode: 'execute',
			pendingFleets: [{ territory: 'Trieste' }, { territory: 'Adriatic Sea' }],
			pendingArmies: [{ territory: 'Vienna' }],
			completedFleetMoves: [],
			completedArmyMoves: [],
		},
		playerInfo: {
			Alice: {
				money: 20,
				stock: [{ country: 'Austria', stock: 5 }],
				scoreModifier: 0,
				investor: false,
				swiss: false,
				myTurn: true,
				order: 1,
			},
		},
		countryInfo: {
			Austria: {
				points: 10,
				money: 8,
				leadership: ['Alice'],
				gov: 'dictatorship',
				factories: ['Vienna', 'Trieste'],
				wheelSpot: 'L-Maneuver',
				availStock: [1, 2, 3, 4],
				taxChips: [],
				fleets: [{ territory: 'Trieste' }, { territory: 'Adriatic Sea' }],
				armies: [{ territory: 'Vienna' }],
			},
		},
	};
}

// Ant Design Table/Steps uses window.matchMedia
beforeAll(() => {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: jest.fn().mockImplementation((query) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: jest.fn(),
			removeListener: jest.fn(),
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
			dispatchEvent: jest.fn(),
		})),
	});
});

beforeEach(() => {
	mockDbData = {};
	mockSetupData = {};
	clearCache();
	jest.clearAllMocks();
});

describe('ManeuverPlannerApp', () => {
	test('renders loading state initially', () => {
		const gs = buildManeuverGameState();
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const div = document.createElement('div');
		renderWithContext({ game: 'testGame', name: 'Alice' }, div);

		expect(div.textContent).toContain('Loading maneuver');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders fleet and army phase sections after loading', async () => {
		const gs = buildManeuverGameState();
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice' };

		renderWithContext(ctx, div);
		await flushPromises();
		renderWithContext(ctx, div);
		await flushPromises();

		expect(div.textContent).toContain('Austria');
		expect(div.textContent).toContain('FLEET MOVES');
		expect(div.textContent).toContain('ARMY MOVES');
		expect(div.textContent).toContain('Fleet 1:');
		expect(div.textContent).toContain('Fleet 2:');
		expect(div.textContent).toContain('Army 1:');
		expect(div.textContent).toContain('Trieste');
		expect(div.textContent).toContain('Vienna');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders dictator peace vote when pendingPeace exists', async () => {
		const gs = buildManeuverGameState();
		gs.currentManeuver.pendingPeace = {
			targetCountry: 'Austria',
			unitType: 'fleet',
			origin: 'Adriatic Sea',
			destination: 'Trieste',
		};
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice' };

		renderWithContext(ctx, div);
		await flushPromises();
		renderWithContext(ctx, div);
		await flushPromises();

		expect(div.textContent).toContain('Peace Offer');
		expect(div.textContent).toContain('Austria');
		expect(div.textContent).toContain('fleet');
		expect(div.textContent).toContain('Trieste');
		expect(div.textContent).toContain('Accept');
		expect(div.textContent).toContain('Reject');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('non-dictator does not see peace vote UI', async () => {
		const gs = buildManeuverGameState();
		gs.currentManeuver.pendingPeace = {
			targetCountry: 'Austria',
			unitType: 'fleet',
			origin: 'Adriatic Sea',
			destination: 'Trieste',
		};
		// Bob is not the dictator of Austria
		gs.playerInfo.Bob = {
			money: 10,
			stock: [],
			scoreModifier: 0,
			investor: false,
			swiss: false,
			myTurn: false,
			order: 2,
		};
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Bob' };

		renderWithContext(ctx, div);
		await flushPromises();
		renderWithContext(ctx, div);
		await flushPromises();

		// Bob should see the normal planner, not the peace vote
		expect(div.textContent).not.toContain('Peace Offer');
		expect(div.textContent).toContain('FLEET MOVES');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders completed moves from previous peace vote rounds', async () => {
		const gs = buildManeuverGameState();
		gs.currentManeuver.completedFleetMoves = [['Trieste', 'Adriatic Sea', 'hostile']];
		gs.currentManeuver.completedArmyMoves = [['Vienna', 'Budapest', 'peace']];
		// Remaining units after peace vote
		gs.currentManeuver.pendingFleets = [{ territory: 'Adriatic Sea' }];
		gs.currentManeuver.pendingArmies = [];
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice' };

		renderWithContext(ctx, div);
		await flushPromises();
		renderWithContext(ctx, div);
		await flushPromises();

		expect(div.textContent).toContain('Committed Moves');
		expect(div.textContent).toContain('hostile');
		expect(div.textContent).toContain('peace');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('shows no currentManeuver message when maneuver is null', async () => {
		const gs = buildManeuverGameState();
		gs.currentManeuver = null;
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice' };

		renderWithContext(ctx, div);
		await flushPromises();
		renderWithContext(ctx, div);
		await flushPromises();

		// Should still be loading or waiting since loadData returns early
		expect(div.textContent).toContain('Loading maneuver');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders army-only maneuver without fleet section', async () => {
		const gs = buildManeuverGameState();
		gs.currentManeuver.pendingFleets = [];
		gs.currentManeuver.pendingArmies = [{ territory: 'Vienna' }, { territory: 'Budapest' }];
		gs.countryInfo.Austria.fleets = [];
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice' };

		renderWithContext(ctx, div);
		await flushPromises();
		renderWithContext(ctx, div);
		await flushPromises();

		expect(div.textContent).not.toContain('FLEET MOVES');
		expect(div.textContent).toContain('ARMY MOVES');
		expect(div.textContent).toContain('Army 1:');
		expect(div.textContent).toContain('Army 2:');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders fleet-only maneuver without army section', async () => {
		const gs = buildManeuverGameState();
		gs.currentManeuver.pendingArmies = [];
		gs.countryInfo.Austria.armies = [];
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice' };

		renderWithContext(ctx, div);
		await flushPromises();
		renderWithContext(ctx, div);
		await flushPromises();

		expect(div.textContent).toContain('FLEET MOVES');
		expect(div.textContent).not.toContain('ARMY MOVES');
		expect(div.textContent).toContain('Fleet 1:');
		expect(div.textContent).toContain('Fleet 2:');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('pre-populates plans from remainingFleetPlans after peace vote resume', async () => {
		const gs = buildManeuverGameState();
		gs.currentManeuver.pendingFleets = [{ territory: 'Adriatic Sea' }];
		gs.currentManeuver.pendingArmies = [];
		gs.currentManeuver.remainingFleetPlans = [['Adriatic Sea', 'Ionian Sea', 'hostile']];
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice' };

		renderWithContext(ctx, div);
		await flushPromises();
		renderWithContext(ctx, div);
		await flushPromises();

		// The pre-populated destination should appear
		expect(div.textContent).toContain('Fleet 1:');
		expect(div.textContent).toContain('Adriatic Sea');
		ReactDOM.unmountComponentAtNode(div);
	});
});
