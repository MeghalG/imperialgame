import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import UserContext from './UserContext.js';
import PlayersColumn from './PlayersColumn.js';

// Mock useGameState so we control loading vs loaded
let mockGameState = null;
let mockLoading = false;
jest.mock('./useGameState.js', () => ({
	__esModule: true,
	default: () => ({ gameState: mockGameState, loading: mockLoading }),
}));

// Mock stateAPI + helper so we return deterministic player/country data
let mockCountryInfo = {};
let mockPlayerInfo = {};
let mockPlayersOrdered = [];
let mockRejectAll = false;

jest.mock('./backendFiles/stateAPI.js', () => ({
	getCountryInfo: jest.fn(() => (mockRejectAll ? Promise.reject(new Error('boom')) : Promise.resolve(mockCountryInfo))),
	getPlayerInfo: jest.fn(() => (mockRejectAll ? Promise.reject(new Error('boom')) : Promise.resolve(mockPlayerInfo))),
}));

jest.mock('./backendFiles/helper.js', () => ({
	getPlayersInOrder: jest.fn(() =>
		mockRejectAll ? Promise.reject(new Error('boom')) : Promise.resolve(mockPlayersOrdered)
	),
	computeScore: jest.fn(() => 10.5),
}));

jest.mock('./countryColors.js', () => ({
	getCountryColorPalette: () => ({
		mid: {},
		dark: {
			Austria: '#D4A843',
			Italy: '#49AA19',
			France: '#4DAADB',
			Germany: '#888888',
			Russia: '#CC79A7',
			England: '#D32029',
		},
		bright: {
			Austria: '#E8C260',
			Italy: '#73D13D',
			France: '#69B1E0',
			Germany: '#AAAAAA',
			Russia: '#EAA3C8',
			England: '#E34F4F',
		},
	}),
}));

function renderPlayersColumn(userName = '') {
	return render(
		<UserContext.Provider value={{ name: userName, colorblindMode: false }}>
			<PlayersColumn />
		</UserContext.Provider>
	);
}

beforeEach(() => {
	mockGameState = null;
	mockLoading = false;
	mockCountryInfo = {};
	mockPlayerInfo = {};
	mockPlayersOrdered = [];
	mockRejectAll = false;
});

describe('PlayersColumn', () => {
	it('renders 6 skeleton rows during initial loading', () => {
		mockLoading = true;
		// No gameState yet and playersOrdered starts as null
		const { container } = renderPlayersColumn('alice');
		const skeletons = container.querySelectorAll('.imp-players-col__row--skeleton');
		expect(skeletons.length).toBe(6);
		expect(screen.getByLabelText(/players \(loading\)/i)).toBeInTheDocument();
	});

	it('renders one row per player in order', async () => {
		mockGameState = { stub: true };
		mockPlayersOrdered = ['alice', 'bob', 'carol'];
		mockPlayerInfo = {
			alice: { money: 10, stock: [] },
			bob: { money: 5, stock: [] },
			carol: { money: 7, stock: [] },
		};
		const { container } = renderPlayersColumn('alice');
		await waitFor(() => {
			expect(screen.getByText('alice')).toBeInTheDocument();
		});
		const rows = container.querySelectorAll('.imp-players-col__row');
		// 3 real rows, no skeletons
		expect(rows.length).toBe(3);
		expect(rows[0].textContent).toContain('alice');
		expect(rows[1].textContent).toContain('bob');
		expect(rows[2].textContent).toContain('carol');
	});

	it('highlights the current user row with aria-current', async () => {
		mockGameState = { stub: true };
		mockPlayersOrdered = ['alice', 'bob'];
		mockPlayerInfo = {
			alice: { money: 10, stock: [] },
			bob: { money: 5, stock: [] },
		};
		const { container } = renderPlayersColumn('bob');
		await waitFor(() => {
			expect(screen.getByText('bob')).toBeInTheDocument();
		});
		const userRows = container.querySelectorAll('.imp-players-col__row--user');
		expect(userRows.length).toBe(1);
		expect(userRows[0].getAttribute('aria-current')).toBe('true');
		expect(userRows[0].textContent).toContain('bob');
		// alice row should NOT be highlighted
		const nonUserRows = container.querySelectorAll('.imp-players-col__row:not(.imp-players-col__row--user)');
		expect(nonUserRows.length).toBe(1);
	});

	it('does not highlight any row when spectator (no name match)', async () => {
		mockGameState = { stub: true };
		mockPlayersOrdered = ['alice', 'bob'];
		mockPlayerInfo = {
			alice: { money: 10, stock: [] },
			bob: { money: 5, stock: [] },
		};
		const { container } = renderPlayersColumn('spectator-name');
		await waitFor(() => {
			expect(screen.getByText('alice')).toBeInTheDocument();
		});
		expect(container.querySelectorAll('.imp-players-col__row--user').length).toBe(0);
	});

	it('renders eliminated/absent players with em-dash money and absent class', async () => {
		mockGameState = { stub: true };
		mockPlayersOrdered = ['alice', 'ghost'];
		mockPlayerInfo = {
			alice: { money: 10, stock: [] },
			// ghost has no entry in playerInfo → treated as absent
		};
		const { container } = renderPlayersColumn('alice');
		await waitFor(() => {
			expect(screen.getByText('ghost')).toBeInTheDocument();
		});
		const absent = container.querySelectorAll('.imp-players-col__row--absent');
		expect(absent.length).toBe(1);
		expect(absent[0].textContent).toContain('ghost');
		expect(absent[0].textContent).toContain('—');
	});

	it('renders fewer than 6 players without trailing empty rows', async () => {
		mockGameState = { stub: true };
		mockPlayersOrdered = ['alice', 'bob', null, null, null, null]; // getPlayersInOrder can return nulls
		mockPlayerInfo = {
			alice: { money: 10, stock: [] },
			bob: { money: 5, stock: [] },
		};
		const { container } = renderPlayersColumn('alice');
		await waitFor(() => {
			expect(screen.getByText('alice')).toBeInTheDocument();
		});
		expect(container.querySelectorAll('.imp-players-col__row').length).toBe(2);
	});

	it('degrades gracefully when Promise.all rejects', async () => {
		mockGameState = { stub: true };
		mockRejectAll = true;
		const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
		const { container } = renderPlayersColumn('alice');
		// After the rejection propagates, playersOrdered becomes [] → no rows
		await waitFor(() => {
			expect(warnSpy).toHaveBeenCalled();
		});
		expect(container.querySelectorAll('.imp-players-col__row').length).toBe(0);
		warnSpy.mockRestore();
	});
});
