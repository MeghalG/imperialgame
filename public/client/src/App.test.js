import React from 'react';
import ReactDOM from 'react-dom';

// Mock firebase to prevent initialization during tests
jest.mock('./backendFiles/firebase.js', () => ({
	database: {
		ref: jest.fn(() => ({
			once: jest.fn(() => Promise.resolve({ val: () => null })),
			on: jest.fn(),
			off: jest.fn(),
			set: jest.fn(),
			update: jest.fn(),
		})),
	},
	fix: jest.fn(),
}));

// Mock child components to avoid pulling in their deep dependency trees
jest.mock('./EnterApp.js', () => {
	return function MockEnterApp() {
		return <div data-testid="enter-app">EnterApp</div>;
	};
});

jest.mock('./GameApp.js', () => {
	return function MockGameApp() {
		return <div data-testid="game-app">GameApp</div>;
	};
});

jest.mock('./backendFiles/turnAPI.js', () => ({}));

import App from './App';

describe('App', () => {
	beforeEach(() => {
		// Mock localStorage for componentDidMount
		Storage.prototype.getItem = jest.fn(() => null);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	test('renders without crashing', () => {
		const div = document.createElement('div');
		ReactDOM.render(<App />, div);
		ReactDOM.unmountComponentAtNode(div);
	});

	test('renders EnterApp when no game is set', () => {
		const div = document.createElement('div');
		ReactDOM.render(<App />, div);
		expect(div.querySelector('[data-testid="enter-app"]')).not.toBeNull();
		expect(div.querySelector('[data-testid="game-app"]')).toBeNull();
		ReactDOM.unmountComponentAtNode(div);
	});
});
