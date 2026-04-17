import React from 'react';
import { render } from '@testing-library/react';
import { CountryCard } from './StateApp.js';

// Mock Firebase (StateApp.js imports stateAPI/helper via useGameState paths)
jest.mock('./backendFiles/firebase.js', () => ({
	database: { ref: jest.fn() },
}));

// Don't need useGameState/helper/stateAPI for CountryCard — it's a pure presentational component
// but the module imports above pull them in. Mock to be safe.
jest.mock('./useGameState.js', () => ({
	__esModule: true,
	default: () => ({ gameState: null, loading: false }),
}));

jest.mock('./backendFiles/stateAPI.js', () => ({
	getCountryInfo: jest.fn(() => Promise.resolve({})),
	getPlayerInfo: jest.fn(() => Promise.resolve({})),
}));

jest.mock('./backendFiles/helper.js', () => ({
	getPlayersInOrder: jest.fn(() => Promise.resolve([])),
	getCountries: jest.fn(() => Promise.resolve(['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia'])),
	computeScore: jest.fn(() => 0),
	computeCash: jest.fn(() => 0),
}));

jest.mock('./countryColors.js', () => ({
	getCountryColorPalette: () => ({
		mid: { Austria: '#D4A843' },
		dark: { Austria: '#806426' },
		bright: { Austria: '#E8C260' },
	}),
}));

function renderCard(info = {}, country = 'Austria') {
	return render(<CountryCard country={country} color="#D4A843" darkColor="#806426" info={info} playerInfo={{}} />);
}

describe('CountryCard (regression tests for trim + gov chip redesign)', () => {
	it('does NOT render an "Owned" row (cut per design doc)', () => {
		const { container } = renderCard({
			points: 6,
			money: 42.5,
			lastTax: 10,
			wheelSpot: 'Import',
			gov: 'dictatorship',
			leadership: ['alice'],
			availStock: [1, 2, 3],
		});
		expect(container.textContent).not.toMatch(/owned/i);
	});

	it('does NOT render the old "Dem: alice / bob" legible-problem string', () => {
		const { container } = renderCard({
			points: 6,
			gov: 'democracy',
			leadership: ['alice', 'bob'],
			availStock: [],
		});
		// Old format produced literal "Dem: alice / bob". New format has no colon-slash pattern.
		expect(container.textContent).not.toMatch(/Dem: alice \/ bob/);
		expect(container.textContent).not.toMatch(/Dict: alice/);
	});

	it('renders DEM pill + leader chip + opposition chip for democracy', () => {
		const { container } = renderCard({
			points: 6,
			gov: 'democracy',
			leadership: ['alice', 'bob'],
			availStock: [],
		});
		const pill = container.querySelector('.imp-state__gov-pill');
		expect(pill).not.toBeNull();
		expect(pill.textContent).toBe('DEM');
		const chips = container.querySelectorAll('.imp-state__gov-chip');
		expect(chips.length).toBe(2);
		expect(chips[0].textContent).toContain('alice');
		expect(chips[1].textContent).toContain('bob');
		// Leader chip uses FlagFilled (anticon-flag)
		expect(chips[0].querySelector('.anticon-flag')).not.toBeNull();
	});

	it('renders DICT pill + single leader chip for dictatorship (no opposition)', () => {
		const { container } = renderCard({
			points: 6,
			gov: 'dictatorship',
			leadership: ['alice'],
			availStock: [],
		});
		const pill = container.querySelector('.imp-state__gov-pill');
		expect(pill.textContent).toBe('DICT');
		const chips = container.querySelectorAll('.imp-state__gov-chip');
		expect(chips.length).toBe(1);
		expect(chips[0].textContent).toContain('alice');
	});

	it('renders nothing for gov when no gov defined', () => {
		const { container } = renderCard({
			points: 0,
			availStock: [],
		});
		expect(container.querySelector('.imp-state__gov-pill')).toBeNull();
		expect(container.querySelectorAll('.imp-state__gov-chip').length).toBe(0);
	});

	it('still renders the kept fields: Treasury, Last Tax, Wheel, points, Available', () => {
		const { container } = renderCard({
			points: 6,
			money: 42.5,
			lastTax: 10,
			wheelSpot: 'Import',
			gov: 'dictatorship',
			leadership: ['alice'],
			availStock: [1, 2, 3],
		});
		expect(container.textContent).toContain('6 pts');
		expect(container.textContent).toContain('Treasury');
		expect(container.textContent).toContain('42.50');
		expect(container.textContent).toContain('Last Tax');
		expect(container.textContent).toContain('Wheel');
		expect(container.textContent).toContain('Available');
		// Three available stock badges
		const badges = container.querySelectorAll('.imp-state__badges .imp-state__badge');
		expect(badges.length).toBe(3);
	});
});
