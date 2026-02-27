// ---------------------------------------------------------------------------
// GameOverApp.test.js — Smoke tests for the game-over screen component
// ---------------------------------------------------------------------------

import React from 'react';
import ReactDOM from 'react-dom';

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
		})),
	},
}));

import GameOverApp from './GameOverApp.js';
import UserContext from './UserContext.js';

async function flushPromises() {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function buildGameState() {
	return {
		playerInfo: {
			Alice: {
				money: 15,
				stock: [
					{ country: 'Austria', stock: 5 },
					{ country: 'France', stock: 3 },
				],
				scoreModifier: 0,
				investor: false,
				swiss: false,
				order: 1,
			},
			Bob: {
				money: 30,
				stock: [{ country: 'Austria', stock: 2 }],
				scoreModifier: 0,
				investor: true,
				swiss: false,
				order: 2,
			},
		},
		countryInfo: {
			Austria: {
				points: 25,
				money: 10,
				leadership: ['Alice'],
				gov: 'dictatorship',
				factories: ['Vienna'],
				wheelSpot: 'Taxation',
				availStock: [1, 4],
				taxChips: [],
				fleets: [],
				armies: [],
			},
			France: {
				points: 10,
				money: 5,
				leadership: ['Bob'],
				gov: 'dictatorship',
				factories: ['Paris'],
				wheelSpot: 'Factory',
				availStock: [1, 2, 4, 5],
				taxChips: [],
				fleets: [],
				armies: [],
			},
		},
	};
}

// Ant Design Table uses window.matchMedia for responsive breakpoints
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
	jest.clearAllMocks();
});

describe('GameOverApp', () => {
	test('renders without crashing', () => {
		const gs = buildGameState();
		mockDbData = { games: { testGame: gs } };

		const div = document.createElement('div');
		const contextValue = { game: 'testGame', name: 'Alice' };

		ReactDOM.render(
			<UserContext.Provider value={contextValue}>
				<GameOverApp />
			</UserContext.Provider>,
			div
		);

		// Initially shows loading
		expect(div.textContent).toContain('Loading');
		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders winner and standings after loading', async () => {
		const gs = buildGameState();
		mockDbData = { games: { testGame: gs } };

		const div = document.createElement('div');
		const contextValue = { game: 'testGame', name: 'Alice' };

		// Use act-like pattern: render, flush promises, then check
		ReactDOM.render(
			<UserContext.Provider value={contextValue}>
				<GameOverApp />
			</UserContext.Provider>,
			div
		);

		await flushPromises();

		// Force a re-render after state updates
		ReactDOM.render(
			<UserContext.Provider value={contextValue}>
				<GameOverApp />
			</UserContext.Provider>,
			div
		);

		await flushPromises();

		// Alice: score = floor(25/5)*5 + floor(10/5)*3 + 15 = 25+6+15 = 46
		// Bob:   score = floor(25/5)*2 + 30 = 10 + 30 = 40
		// Alice wins
		expect(div.textContent).toContain('Game Over');
		expect(div.textContent).toContain('wins');
		expect(div.textContent).toContain('Player Standings');
		expect(div.textContent).toContain('Country Standings');

		ReactDOM.unmountComponentAtNode(div);
	});
});
