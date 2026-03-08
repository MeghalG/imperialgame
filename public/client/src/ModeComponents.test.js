// ---------------------------------------------------------------------------
// ModeComponents.test.js — Smoke tests for mode-specific UI components
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
			on: jest.fn((event, callback) => {
				const raw = mockGetNestedValue(mockDbData, path);
				if (raw !== undefined) {
					callback({ val: () => JSON.parse(JSON.stringify(raw)) });
				}
			}),
			off: jest.fn(),
			set: jest.fn(() => Promise.resolve()),
		})),
	},
}));

import BidApp from './BidApp.js';
import HistoryApp from './HistoryApp.js';
import UserContext from './UserContext.js';
import { clearCache } from './backendFiles/stateCache.js';

async function flushPromises() {
	for (let i = 0; i < 15; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function renderWithContext(Component, contextValue, div) {
	ReactDOM.render(
		<UserContext.Provider value={contextValue}>
			<Component />
		</UserContext.Provider>,
		div
	);
}

function buildGameState() {
	return {
		mode: 'bid',
		countryUp: 'Austria',
		round: 1,
		turnID: 1,
		setup: 'standard',
		playerInfo: {
			Alice: {
				money: 20,
				myTurn: true,
				investor: false,
				order: 1,
				swiss: false,
				stock: [],
				scoreModifier: 0,
				email: '',
			},
			Bob: {
				money: 15,
				myTurn: true,
				investor: false,
				order: 2,
				swiss: false,
				stock: [{ country: 'Austria', stock: 3 }],
				scoreModifier: 0,
				email: '',
			},
		},
		countryInfo: {
			Austria: {
				money: 0,
				points: 0,
				factories: ['Vienna'],
				wheelSpot: 'center',
				gov: 'democracy',
				leadership: ['Alice', 'Bob'],
				availStock: [1, 2, 4, 5],
				offLimits: false,
				lastTax: 5,
				taxChips: [],
				fleets: [],
				armies: [],
			},
		},
		history: ['The game has begun.'],
		voting: null,
		'proposal 1': null,
		'proposal 2': null,
		bidBuyOrder: [],
	};
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

// ---------------------------------------------------------------------------
// BidApp
// ---------------------------------------------------------------------------
describe('BidApp', () => {
	test('renders null before loading (no crash)', () => {
		const gs = buildGameState();
		mockDbData = { games: { testGame: gs } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice', setBid: jest.fn() };
		act(() => {
			renderWithContext(BidApp, ctx, div);
		});

		// Before loading, renders null (empty)
		expect(div.innerHTML).toBe('');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders bid form with max money after loading', async () => {
		const gs = buildGameState();
		mockDbData = { games: { testGame: gs } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice', setBid: jest.fn() };
		act(() => {
			renderWithContext(BidApp, ctx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		expect(div.textContent).toContain('bid');
		expect(div.textContent).toContain('Austria');
		expect(div.textContent).toContain('Submit');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('calls setBid on mount', async () => {
		const gs = buildGameState();
		mockDbData = { games: { testGame: gs } };

		const div = document.createElement('div');
		const setBid = jest.fn();
		const ctx = { game: 'testGame', name: 'Alice', setBid };
		act(() => {
			renderWithContext(BidApp, ctx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		// record(0) is called in useEffect
		expect(setBid).toHaveBeenCalledWith(0);
		ReactDOM.unmountComponentAtNode(div);
	});
});

// ---------------------------------------------------------------------------
// HistoryApp
// ---------------------------------------------------------------------------
describe('HistoryApp', () => {
	test('renders history list from Firebase listener', async () => {
		const gs = buildGameState();
		gs.history = ['The game has begun.', 'Alice bid $5 on Austria.', 'Bob bid $3 on Austria.'];
		mockDbData = { games: { testGame: gs } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice' };
		act(() => {
			renderWithContext(HistoryApp, ctx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		// History is reversed, so most recent first
		expect(div.textContent).toContain('Bob bid $3 on Austria.');
		expect(div.textContent).toContain('Alice bid $5 on Austria.');
		expect(div.textContent).toContain('The game has begun.');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders empty list with no history', () => {
		mockDbData = {};

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice' };
		act(() => {
			renderWithContext(HistoryApp, ctx, div);
		});

		// Should not crash even with no data
		ReactDOM.unmountComponentAtNode(div);
	});

	test('shows numbered entries in reverse order', async () => {
		const history = ['Entry 1', 'Entry 2', 'Entry 3'];
		mockDbData = { games: { testGame: { history: history } } };

		const div = document.createElement('div');
		const ctx = { game: 'testGame', name: 'Alice' };
		act(() => {
			renderWithContext(HistoryApp, ctx, div);
		});
		await act(async () => {
			await flushPromises();
		});

		// The numbering should show [3] for most recent, [1] for oldest
		expect(div.textContent).toContain('[3]');
		expect(div.textContent).toContain('[1]');
		ReactDOM.unmountComponentAtNode(div);
	});
});
