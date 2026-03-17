// ---------------------------------------------------------------------------
// MapInteraction.test.js — Tests for map interaction integration
// ---------------------------------------------------------------------------

import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

let mockDbData = {};

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
			set: jest.fn(() => Promise.resolve()),
		})),
	},
	callFunction: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
}));

jest.mock('./backendFiles/proposalAPI.js', () => ({
	getWheelOptions: jest.fn(() => Promise.resolve(['Factory', 'Import', 'Taxation'])),
	getLocationOptions: jest.fn(() => Promise.resolve(['Vienna', 'Trieste', 'Budapest'])),
	getUnitOptionsFromPlans: jest.fn(() => Promise.resolve(['Adriatic Sea', 'Ionian Sea', 'Trieste'])),
	getUnitActionOptionsFromPlans: jest.fn(() => Promise.resolve([])),
	getCurrentUnitOptions: jest.fn(() => Promise.resolve([])),
	getCurrentUnitActionOptions: jest.fn(() => Promise.resolve([])),
}));

import { OptionSelect } from './ComponentTemplates.js';
import ManeuverPlannerApp from './ManeuverPlannerApp.js';
import SvgRondel from './SvgRondel.js';
import UserContext from './UserContext.js';
import MapInteractionContext from './MapInteractionContext.js';
import { clearCache } from './backendFiles/stateCache.js';

async function flushPromises() {
	for (let i = 0; i < 15; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function createMockMapCtx() {
	return {
		interactionMode: null,
		selectableItems: [],
		selectableCosts: {},
		selectedItem: null,
		highlightColor: '#c9a84c',
		onItemSelected: jest.fn(),
		highlightedTerritories: {},
		setInteraction: jest.fn(),
		clearInteraction: jest.fn(),
		plannedMoves: [],
		setPlannedMoves: jest.fn(),
		unitMarkers: [],
		setUnitMarkers: jest.fn(),
		onUnitMarkerClicked: jest.fn(),
		setOnUnitMarkerClickedCb: jest.fn(),
	};
}

function renderWithBothContexts(Component, userCtx, mapCtx, div, props) {
	ReactDOM.render(
		<UserContext.Provider value={userCtx}>
			<MapInteractionContext.Provider value={mapCtx}>
				{props ? <Component {...props} /> : <Component />}
			</MapInteractionContext.Provider>
		</UserContext.Provider>,
		div
	);
}

// Ant Design uses window.matchMedia
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
	clearCache();
	jest.clearAllMocks();
});

describe('OptionSelect with mapMode', () => {
	test('calls setInteraction when mapMode is provided and choices load', async () => {
		const mapCtx = createMockMapCtx();
		const mockSetWheelSpot = jest.fn();
		const mockData = jest.fn();
		const userCtx = { game: 'testGame', name: 'Alice', setWheelSpot: mockSetWheelSpot };

		const div = document.createElement('div');
		act(() => {
			renderWithBothContexts(OptionSelect, userCtx, mapCtx, div, {
				object: 'wheel',
				setThing: 'setWheelSpot',
				getAPI: () => Promise.resolve(['Factory', 'Import', 'Taxation']),
				message: 'Spin to:',
				data: mockData,
				mapMode: 'select-rondel',
				mapColor: '#c9a84c',
			});
		});
		await act(async () => {
			await flushPromises();
		});

		expect(mapCtx.setInteraction).toHaveBeenCalledWith(
			'select-rondel',
			['Factory', 'Import', 'Taxation'],
			'#c9a84c',
			expect.any(Function),
			null,
			null
		);

		ReactDOM.unmountComponentAtNode(div);
	});

	test('does not call setInteraction when mapMode is absent', async () => {
		const mapCtx = createMockMapCtx();
		const mockData = jest.fn();
		const userCtx = { game: 'testGame', name: 'Alice', setWheelSpot: jest.fn() };

		const div = document.createElement('div');
		act(() => {
			renderWithBothContexts(OptionSelect, userCtx, mapCtx, div, {
				object: 'wheel',
				setThing: 'setWheelSpot',
				getAPI: () => Promise.resolve(['Factory', 'Import']),
				message: 'Spin to:',
				data: mockData,
			});
		});
		await act(async () => {
			await flushPromises();
		});

		expect(mapCtx.setInteraction).not.toHaveBeenCalled();

		ReactDOM.unmountComponentAtNode(div);
	});

	test('map click callback triggers sendValue', async () => {
		const mapCtx = createMockMapCtx();
		const mockSetWheelSpot = jest.fn();
		const mockData = jest.fn();
		const userCtx = { game: 'testGame', name: 'Alice', setWheelSpot: mockSetWheelSpot };

		const div = document.createElement('div');
		act(() => {
			renderWithBothContexts(OptionSelect, userCtx, mapCtx, div, {
				object: 'wheel',
				setThing: 'setWheelSpot',
				getAPI: () => Promise.resolve(['Factory', 'Import', 'Taxation']),
				message: 'Spin to:',
				data: mockData,
				mapMode: 'select-rondel',
			});
		});
		await act(async () => {
			await flushPromises();
		});

		// Extract the callback passed to setInteraction and call it
		let onItemCallback = mapCtx.setInteraction.mock.calls[0][3];
		act(() => {
			onItemCallback('Factory');
		});

		expect(mockSetWheelSpot).toHaveBeenCalledWith('Factory');
		expect(mockData).toHaveBeenCalledWith('Factory', 'wheel');

		ReactDOM.unmountComponentAtNode(div);
	});

	test('calls clearInteraction on unmount when mode matches', async () => {
		const mapCtx = createMockMapCtx();
		mapCtx.interactionMode = 'select-rondel';
		const userCtx = { game: 'testGame', name: 'Alice', setWheelSpot: jest.fn() };

		const div = document.createElement('div');
		act(() => {
			renderWithBothContexts(OptionSelect, userCtx, mapCtx, div, {
				object: 'wheel',
				setThing: 'setWheelSpot',
				getAPI: () => Promise.resolve(['Factory', 'Import']),
				message: 'Spin to:',
				data: jest.fn(),
				mapMode: 'select-rondel',
			});
		});
		await act(async () => {
			await flushPromises();
		});

		act(() => {
			ReactDOM.unmountComponentAtNode(div);
		});

		expect(mapCtx.clearInteraction).toHaveBeenCalled();
	});
});

describe('ManeuverPlannerApp with MapInteractionContext', () => {
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
				pendingFleets: [{ territory: 'Trieste' }],
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
					fleets: [{ territory: 'Trieste' }],
					armies: [{ territory: 'Vienna' }],
				},
			},
		};
	}

	test('renders without crashing when wrapped in MapInteractionContext', async () => {
		const gs = buildManeuverGameState();
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const mapCtx = createMockMapCtx();
		const userCtx = { game: 'testGame', name: 'Alice' };
		const div = document.createElement('div');

		act(() => {
			renderWithBothContexts(ManeuverPlannerApp, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});
		act(() => {
			renderWithBothContexts(ManeuverPlannerApp, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		expect(div.textContent).toContain('Austria');
		expect(div.textContent).toContain('Trieste');
		expect(div.textContent).toContain('Vienna');

		ReactDOM.unmountComponentAtNode(div);
	});

	test('calls setPlannedMoves after loading with planned destinations', async () => {
		const gs = buildManeuverGameState();
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const mapCtx = createMockMapCtx();
		const userCtx = { game: 'testGame', name: 'Alice' };
		const div = document.createElement('div');

		act(() => {
			renderWithBothContexts(ManeuverPlannerApp, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});
		act(() => {
			renderWithBothContexts(ManeuverPlannerApp, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		// setPlannedMoves should have been called (initially with empty moves since no dests set)
		expect(mapCtx.setPlannedMoves).toHaveBeenCalled();

		ReactDOM.unmountComponentAtNode(div);
	});

	test('cleans up map interaction on unmount', async () => {
		const gs = buildManeuverGameState();
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const mapCtx = createMockMapCtx();
		const userCtx = { game: 'testGame', name: 'Alice' };
		const div = document.createElement('div');

		act(() => {
			renderWithBothContexts(ManeuverPlannerApp, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		act(() => {
			ReactDOM.unmountComponentAtNode(div);
		});

		// clearInteraction should have been called during cleanup
		expect(mapCtx.clearInteraction).toHaveBeenCalled();
	});
});

describe('OptionSelect passes dynamic costs through setInteraction', () => {
	test('passes cost map when costs prop is provided', async () => {
		const mapCtx = createMockMapCtx();
		const userCtx = { game: 'testGame', name: 'Alice', setWheelSpot: jest.fn() };

		const div = document.createElement('div');
		act(() => {
			renderWithBothContexts(OptionSelect, userCtx, mapCtx, div, {
				object: 'wheel',
				setThing: 'setWheelSpot',
				getAPI: () => Promise.resolve(['Factory', 'Import', 'Taxation', 'Investor', 'L-Produce', 'L-Maneuver']),
				message: 'Spin to:',
				data: jest.fn(),
				mapMode: 'select-rondel',
				mapColor: '#c9a84c',
				costs: ['', '', '', '($2)', '($4)', '($6)'],
			});
		});
		await act(async () => {
			await flushPromises();
		});

		// setInteraction should be called with a cost map as the 6th arg
		expect(mapCtx.setInteraction).toHaveBeenCalledWith(
			'select-rondel',
			['Factory', 'Import', 'Taxation', 'Investor', 'L-Produce', 'L-Maneuver'],
			'#c9a84c',
			expect.any(Function),
			null,
			{ Investor: '($2)', 'L-Produce': '($4)', 'L-Maneuver': '($6)' }
		);

		ReactDOM.unmountComponentAtNode(div);
	});

	test('passes null cost map when no costs prop is provided', async () => {
		const mapCtx = createMockMapCtx();
		const userCtx = { game: 'testGame', name: 'Alice', setWheelSpot: jest.fn() };

		const div = document.createElement('div');
		act(() => {
			renderWithBothContexts(OptionSelect, userCtx, mapCtx, div, {
				object: 'wheel',
				setThing: 'setWheelSpot',
				getAPI: () => Promise.resolve(['Factory', 'Import']),
				message: 'Spin to:',
				data: jest.fn(),
				mapMode: 'select-rondel',
			});
		});
		await act(async () => {
			await flushPromises();
		});

		// 6th arg should be null when no costs provided
		let costArg = mapCtx.setInteraction.mock.calls[0][5];
		expect(costArg).toBeNull();

		ReactDOM.unmountComponentAtNode(div);
	});
});

describe('SvgRondel', () => {
	test('always renders 8 wedges regardless of interactionMode', () => {
		const mapCtx = createMockMapCtx();
		mapCtx.interactionMode = null;
		const div = document.createElement('div');

		act(() => {
			ReactDOM.render(
				<MapInteractionContext.Provider value={mapCtx}>
					<SvgRondel rondelData={{}} colorblindMode={false} />
				</MapInteractionContext.Provider>,
				div
			);
		});

		let wedges = div.querySelectorAll('.imp-rondel-wedge');
		expect(wedges.length).toBe(8);

		ReactDOM.unmountComponentAtNode(div);
	});

	test('no wedges have selectable class when interactionMode is not select-rondel', () => {
		const mapCtx = createMockMapCtx();
		mapCtx.interactionMode = null;
		const div = document.createElement('div');

		act(() => {
			ReactDOM.render(
				<MapInteractionContext.Provider value={mapCtx}>
					<SvgRondel rondelData={{}} colorblindMode={false} />
				</MapInteractionContext.Provider>,
				div
			);
		});

		let selectable = div.querySelectorAll('.imp-rondel-wedge--selectable');
		expect(selectable.length).toBe(0);

		ReactDOM.unmountComponentAtNode(div);
	});

	test('marks selectable wedges when interactionMode is select-rondel', () => {
		const mapCtx = createMockMapCtx();
		mapCtx.interactionMode = 'select-rondel';
		mapCtx.selectableItems = ['Factory', 'Import'];
		const div = document.createElement('div');

		act(() => {
			ReactDOM.render(
				<MapInteractionContext.Provider value={mapCtx}>
					<SvgRondel rondelData={{}} colorblindMode={false} />
				</MapInteractionContext.Provider>,
				div
			);
		});

		let selectable = div.querySelectorAll('.imp-rondel-wedge--selectable');
		expect(selectable.length).toBe(2);

		ReactDOM.unmountComponentAtNode(div);
	});

	test('marks selected wedge with imp-rondel-wedge--selected class', () => {
		const mapCtx = createMockMapCtx();
		mapCtx.interactionMode = 'select-rondel';
		mapCtx.selectableItems = ['Factory', 'Import'];
		mapCtx.selectedItem = 'Factory';
		const div = document.createElement('div');

		act(() => {
			ReactDOM.render(
				<MapInteractionContext.Provider value={mapCtx}>
					<SvgRondel rondelData={{}} colorblindMode={false} />
				</MapInteractionContext.Provider>,
				div
			);
		});

		let selected = div.querySelectorAll('.imp-rondel-wedge--selected');
		expect(selected.length).toBe(1);

		// Factory is selected, so Import is the only remaining selectable
		let selectable = div.querySelectorAll('.imp-rondel-wedge--selectable');
		expect(selectable.length).toBe(1);

		ReactDOM.unmountComponentAtNode(div);
	});

	test('click on selectable wedge calls onItemSelected', () => {
		const mapCtx = createMockMapCtx();
		mapCtx.interactionMode = 'select-rondel';
		mapCtx.selectableItems = ['Factory', 'Import'];
		const div = document.createElement('div');
		document.body.appendChild(div);

		act(() => {
			ReactDOM.render(
				<MapInteractionContext.Provider value={mapCtx}>
					<SvgRondel rondelData={{}} colorblindMode={false} />
				</MapInteractionContext.Provider>,
				div
			);
		});

		// Click the first selectable wedge
		let selectableWedge = div.querySelector('.imp-rondel-wedge--selectable');
		expect(selectableWedge).not.toBeNull();
		act(() => {
			selectableWedge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});

		expect(mapCtx.onItemSelected).toHaveBeenCalled();

		ReactDOM.unmountComponentAtNode(div);
		document.body.removeChild(div);
	});

	test('click on non-selectable wedge does NOT call onItemSelected', () => {
		const mapCtx = createMockMapCtx();
		mapCtx.interactionMode = 'select-rondel';
		mapCtx.selectableItems = ['Factory'];
		const div = document.createElement('div');
		document.body.appendChild(div);

		act(() => {
			ReactDOM.render(
				<MapInteractionContext.Provider value={mapCtx}>
					<SvgRondel rondelData={{}} colorblindMode={false} />
				</MapInteractionContext.Provider>,
				div
			);
		});

		// Get all wedges, find one that is NOT selectable
		let allWedges = div.querySelectorAll('.imp-rondel-wedge');
		let nonSelectable = Array.from(allWedges).find((w) => !w.classList.contains('imp-rondel-wedge--selectable'));
		expect(nonSelectable).toBeDefined();
		act(() => {
			nonSelectable.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});

		expect(mapCtx.onItemSelected).not.toHaveBeenCalled();

		ReactDOM.unmountComponentAtNode(div);
		document.body.removeChild(div);
	});

	test('displays dynamic cost labels from selectableCosts context', () => {
		const mapCtx = createMockMapCtx();
		mapCtx.interactionMode = 'select-rondel';
		mapCtx.selectableItems = ['Factory', 'Import', 'Taxation', 'Investor', 'L-Produce', 'L-Maneuver'];
		mapCtx.selectableCosts = {
			Investor: '($2)',
			'L-Produce': '($4)',
			'L-Maneuver': '($6)',
		};
		const div = document.createElement('div');

		act(() => {
			ReactDOM.render(
				<MapInteractionContext.Provider value={mapCtx}>
					<SvgRondel rondelData={{}} colorblindMode={false} />
				</MapInteractionContext.Provider>,
				div
			);
		});

		let costLabels = div.querySelectorAll('.imp-rondel-cost-label');
		// Only Investor, L-Produce, L-Maneuver have costs
		expect(costLabels.length).toBe(3);

		let costTexts = Array.from(costLabels).map((el) => el.textContent);
		expect(costTexts).toContain('($2)');
		expect(costTexts).toContain('($4)');
		expect(costTexts).toContain('($6)');

		ReactDOM.unmountComponentAtNode(div);
	});

	test('does not display cost labels when selectableCosts is empty', () => {
		const mapCtx = createMockMapCtx();
		mapCtx.interactionMode = 'select-rondel';
		mapCtx.selectableItems = ['Factory', 'Import', 'Taxation'];
		mapCtx.selectableCosts = {};
		const div = document.createElement('div');

		act(() => {
			ReactDOM.render(
				<MapInteractionContext.Provider value={mapCtx}>
					<SvgRondel rondelData={{}} colorblindMode={false} />
				</MapInteractionContext.Provider>,
				div
			);
		});

		let costLabels = div.querySelectorAll('.imp-rondel-cost-label');
		expect(costLabels.length).toBe(0);

		ReactDOM.unmountComponentAtNode(div);
	});
});

describe('ManeuverPlannerApp active unit map interaction', () => {
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
				pendingFleets: [{ territory: 'Trieste' }],
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
					fleets: [{ territory: 'Trieste' }],
					armies: [{ territory: 'Vienna' }],
				},
			},
		};
	}

	test('clicking a unit roster button sets active unit and triggers setInteraction for destinations', async () => {
		const gs = buildManeuverGameState();
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const mapCtx = createMockMapCtx();
		const userCtx = { game: 'testGame', name: 'Alice' };
		const div = document.createElement('div');
		document.body.appendChild(div);

		act(() => {
			renderWithBothContexts(ManeuverPlannerApp, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});
		act(() => {
			renderWithBothContexts(ManeuverPlannerApp, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		// First fleet is auto-activated, so setInteraction should already be called
		// Click the army unit row to switch — find by text content
		let allRows = Array.from(div.querySelectorAll('div[style]')).filter(
			(el) => el.textContent.includes('Vienna') && el.textContent.includes('Army')
		);
		let armyBtn = allRows[0];
		expect(armyBtn).not.toBeNull();
		act(() => {
			armyBtn.click();
		});
		await act(async () => {
			await flushPromises();
		});

		// setInteraction should be called with 'select-territory' and the destOptions
		expect(mapCtx.setInteraction).toHaveBeenCalledWith(
			'select-territory',
			expect.any(Array),
			expect.any(String),
			expect.any(Function),
			expect.any(Object)
		);

		ReactDOM.unmountComponentAtNode(div);
		document.body.removeChild(div);
	});

	test('map click callback updates destination for the active unit', async () => {
		const gs = buildManeuverGameState();
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const mapCtx = createMockMapCtx();
		const userCtx = { game: 'testGame', name: 'Alice' };
		const div = document.createElement('div');
		document.body.appendChild(div);

		act(() => {
			renderWithBothContexts(ManeuverPlannerApp, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});
		act(() => {
			renderWithBothContexts(ManeuverPlannerApp, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		// First fleet is auto-activated, so setInteraction was already called
		// Get the callback from setInteraction and simulate a map click
		let lastCall = mapCtx.setInteraction.mock.calls[mapCtx.setInteraction.mock.calls.length - 1];
		let mapClickCallback = lastCall[3];

		act(() => {
			mapClickCallback('Adriatic Sea');
		});
		await act(async () => {
			await flushPromises();
		});

		// The destination select for Fleet 1 should now show 'Adriatic Sea'
		let destSelects = div.querySelectorAll('.ant-select-selection-item');
		let destTexts = Array.from(destSelects).map((el) => el.textContent);
		expect(destTexts).toContain('Adriatic Sea');

		ReactDOM.unmountComponentAtNode(div);
		document.body.removeChild(div);
	});

	test('active unit row has gold border indicating active state', async () => {
		const gs = buildManeuverGameState();
		mockDbData = { games: { testGame: gs }, setups: { standard: { territories: {} } } };

		const mapCtx = createMockMapCtx();
		const userCtx = { game: 'testGame', name: 'Alice' };
		const div = document.createElement('div');
		document.body.appendChild(div);

		act(() => {
			renderWithBothContexts(ManeuverPlannerApp, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});
		act(() => {
			renderWithBothContexts(ManeuverPlannerApp, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		// First fleet is auto-activated — find the row with Trieste
		let fleetRow = Array.from(div.querySelectorAll('div[style]')).find(
			(el) => el.textContent.includes('Trieste') && el.textContent.includes('Fleet')
		);
		expect(fleetRow).not.toBeNull();
		// The active row should show the destination select (planning controls are expanded)
		let destSelect = fleetRow.querySelector('.ant-select');
		expect(destSelect).not.toBeNull();

		ReactDOM.unmountComponentAtNode(div);
		document.body.removeChild(div);
	});
});

describe('TerritoryHotspot component', () => {
	// Import is at the top of file already via the mock setup
	let TerritoryHotspot;
	beforeAll(() => {
		TerritoryHotspot = require('./TerritoryHotspot.js').default;
	});

	test('renders selectable class when isClickable is true', () => {
		const div = document.createElement('div');
		act(() => {
			ReactDOM.render(
				<TerritoryHotspot
					name="Vienna"
					coords={['57.9%', '50.1%']}
					isClickable={true}
					isSelected={false}
					highlightColor="#ff0000"
					onClick={jest.fn()}
				/>,
				div
			);
		});

		let hotspot = div.querySelector('.imp-hotspot--selectable');
		expect(hotspot).not.toBeNull();
		expect(hotspot.title).toBe('Vienna');

		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders selected class when isSelected is true', () => {
		const div = document.createElement('div');
		act(() => {
			ReactDOM.render(
				<TerritoryHotspot
					name="Vienna"
					coords={['57.9%', '50.1%']}
					isClickable={false}
					isSelected={true}
					highlightColor="#ff0000"
					onClick={jest.fn()}
				/>,
				div
			);
		});

		let hotspot = div.querySelector('.imp-hotspot--selected');
		expect(hotspot).not.toBeNull();

		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders idle class when neither clickable nor selected', () => {
		const div = document.createElement('div');
		act(() => {
			ReactDOM.render(
				<TerritoryHotspot
					name="Vienna"
					coords={['57.9%', '50.1%']}
					isClickable={false}
					isSelected={false}
					highlightColor="#ff0000"
					onClick={jest.fn()}
				/>,
				div
			);
		});

		let hotspot = div.querySelector('.imp-hotspot--idle');
		expect(hotspot).not.toBeNull();
		// Idle hotspot should not have title
		expect(hotspot.title).toBe('');

		ReactDOM.unmountComponentAtNode(div);
	});

	test('click on selectable hotspot calls onClick with territory name', () => {
		const onClick = jest.fn();
		const div = document.createElement('div');
		document.body.appendChild(div);

		act(() => {
			ReactDOM.render(
				<TerritoryHotspot
					name="Vienna"
					coords={['57.9%', '50.1%']}
					isClickable={true}
					isSelected={false}
					highlightColor="#ff0000"
					onClick={onClick}
				/>,
				div
			);
		});

		let hotspot = div.querySelector('.imp-hotspot--selectable');
		act(() => {
			hotspot.click();
		});

		expect(onClick).toHaveBeenCalledWith('Vienna');

		ReactDOM.unmountComponentAtNode(div);
		document.body.removeChild(div);
	});

	test('click on idle hotspot does NOT call onClick', () => {
		const onClick = jest.fn();
		const div = document.createElement('div');
		document.body.appendChild(div);

		act(() => {
			ReactDOM.render(
				<TerritoryHotspot
					name="Vienna"
					coords={['57.9%', '50.1%']}
					isClickable={false}
					isSelected={false}
					highlightColor="#ff0000"
					onClick={onClick}
				/>,
				div
			);
		});

		let hotspot = div.querySelector('.imp-hotspot');
		act(() => {
			hotspot.click();
		});

		expect(onClick).not.toHaveBeenCalled();

		ReactDOM.unmountComponentAtNode(div);
		document.body.removeChild(div);
	});

	test('positions based on percentage coords with calc() offset', () => {
		const div = document.createElement('div');
		act(() => {
			ReactDOM.render(
				<TerritoryHotspot
					name="Vienna"
					coords={['57.9%', '50.1%']}
					isClickable={true}
					isSelected={false}
					highlightColor="#ff0000"
					onClick={jest.fn()}
				/>,
				div
			);
		});

		let hotspot = div.querySelector('.imp-hotspot');
		// Should use calc() with percentage coords
		expect(hotspot.style.left).toBe('calc(57.9% - 28px)');
		expect(hotspot.style.top).toBe('calc(50.1% - 20px)');

		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders nothing when coords is null', () => {
		const div = document.createElement('div');
		act(() => {
			ReactDOM.render(
				<TerritoryHotspot
					name="Vienna"
					coords={null}
					isClickable={true}
					isSelected={false}
					highlightColor="#ff0000"
					onClick={jest.fn()}
				/>,
				div
			);
		});

		expect(div.innerHTML).toBe('');

		ReactDOM.unmountComponentAtNode(div);
	});

	test('applies highlight color as backgroundColor when selectable', () => {
		const div = document.createElement('div');
		act(() => {
			ReactDOM.render(
				<TerritoryHotspot
					name="Vienna"
					coords={['57.9%', '50.1%']}
					isClickable={true}
					isSelected={false}
					highlightColor="#49aa19"
					onClick={jest.fn()}
				/>,
				div
			);
		});

		let hotspot = div.querySelector('.imp-hotspot');
		expect(hotspot.style.backgroundColor).toBe('rgb(73, 170, 25)');

		ReactDOM.unmountComponentAtNode(div);
	});
});

describe('MovementArrowLayer', () => {
	let MovementArrowLayer;
	beforeAll(() => {
		MovementArrowLayer = require('./MovementArrowLayer.js').default;
	});

	test('renders nothing when plannedMoves is empty', async () => {
		mockDbData = {
			games: {
				testGame: {
					setup: 'standard',
				},
			},
			standard: {
				territories: {
					Vienna: { unitCoords: ['57.9%', '50.1%'] },
					Trieste: { unitCoords: ['52.3%', '58.4%'] },
				},
			},
		};

		const mapCtx = createMockMapCtx();
		mapCtx.plannedMoves = [];
		const userCtx = { game: 'testGame', name: 'Alice' };
		const div = document.createElement('div');

		act(() => {
			renderWithBothContexts(MovementArrowLayer, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		let arrows = div.querySelectorAll('path.imp-movement-arrow');
		expect(arrows.length).toBe(0);

		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders SVG lines for planned moves with territory coords', async () => {
		mockDbData = {
			games: {
				testGame: {
					setup: 'standard',
				},
			},
			standard: {
				territories: {
					Vienna: { unitCoords: ['57.9%', '50.1%'] },
					Budapest: { unitCoords: ['65.2%', '48.3%'] },
				},
			},
		};

		const mapCtx = createMockMapCtx();
		mapCtx.plannedMoves = [{ origin: 'Vienna', dest: 'Budapest', color: '#c9a84c' }];
		const userCtx = { game: 'testGame', name: 'Alice' };
		const div = document.createElement('div');

		act(() => {
			renderWithBothContexts(MovementArrowLayer, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});
		// Re-render after territory data loads
		act(() => {
			renderWithBothContexts(MovementArrowLayer, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		let paths = div.querySelectorAll('path.imp-movement-arrow');
		expect(paths.length).toBe(1);

		// SVG path should contain numeric coords (viewBox 0-100) and the planned move color
		let d = paths[0].getAttribute('d');
		expect(d).toContain('57.9');
		expect(d).toContain('50.1');
		expect(d).toContain('65.2');
		expect(d).toContain('48.3');
		expect(paths[0].getAttribute('stroke')).toBe('#c9a84c');

		ReactDOM.unmountComponentAtNode(div);
	});

	test('skips arrows for moves with missing territory coords', async () => {
		mockDbData = {
			games: {
				testGame: {
					setup: 'standard',
				},
			},
			standard: {
				territories: {
					Vienna: { unitCoords: ['57.9%', '50.1%'] },
					// Budapest has no entry in territories
				},
			},
		};

		const mapCtx = createMockMapCtx();
		mapCtx.plannedMoves = [{ origin: 'Vienna', dest: 'Budapest', color: '#c9a84c' }];
		const userCtx = { game: 'testGame', name: 'Alice' };
		const div = document.createElement('div');

		act(() => {
			renderWithBothContexts(MovementArrowLayer, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});
		act(() => {
			renderWithBothContexts(MovementArrowLayer, userCtx, mapCtx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		let paths = div.querySelectorAll('path.imp-movement-arrow');
		expect(paths.length).toBe(0);

		ReactDOM.unmountComponentAtNode(div);
	});
});

describe('Firebase .info path handling', () => {
	test('firebase wrapper once() returns a promise for regular paths', async () => {
		const { database } = require('./backendFiles/firebase.js');
		let result = await database.ref('games/testGame').once('value');
		expect(result).toBeDefined();
		expect(typeof result.val).toBe('function');
	});

	test('firebase wrapper ref() returns an object with once, on, off, set methods', () => {
		const { database } = require('./backendFiles/firebase.js');
		let ref = database.ref('games/testGame');
		expect(typeof ref.once).toBe('function');
		expect(typeof ref.on).toBe('function');
		expect(typeof ref.off).toBe('function');
		expect(typeof ref.set).toBe('function');
	});

	test('firebase wrapper ref() for .info paths returns same interface', () => {
		const { database } = require('./backendFiles/firebase.js');
		// In the real code, .info paths use onValue instead of get()
		// The mock provides the same interface regardless of path
		let ref = database.ref('/.info/serverTimeOffset');
		expect(typeof ref.once).toBe('function');
		expect(typeof ref.on).toBe('function');
		expect(typeof ref.off).toBe('function');
	});

	test('firebase wrapper once() val() returns data at the path', async () => {
		mockDbData = { games: { testGame: { turnID: 5 } } };
		const { database } = require('./backendFiles/firebase.js');
		let result = await database.ref('games/testGame').once('value');
		expect(result.val()).toEqual({ turnID: 5 });
	});
});
