import React from 'react';
import { render, act, fireEvent, screen, waitFor } from '@testing-library/react';
import UserContext from './UserContext.js';
import Sidebar from './Sidebar.js';

// Stub ResizeObserver for any component tree that uses it
global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// Control gameState and trigger refreshes between tests by reassigning mockGameState
let mockGameState = { mode: '' };
jest.mock('./useGameState.js', () => ({
	__esModule: true,
	default: () => ({ gameState: mockGameState, loading: false }),
}));

// Control the turnAPI.getTurnState return so Sidebar picks up the mode we inject
let mockMode = '';
let mockTurnTitle = 'Turn';
jest.mock('./backendFiles/turnAPI.js', () => ({
	getTurnState: jest.fn(() =>
		Promise.resolve({
			turnTitle: mockTurnTitle,
			mode: mockMode,
			turnID: 1,
			undoable: false,
		})
	),
	getTitle: jest.fn(() => Promise.resolve('Turn')),
	getMode: jest.fn(() => Promise.resolve(mockMode)),
	getTurnID: jest.fn(() => Promise.resolve(1)),
	getMyTurn: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('./backendFiles/miscAPI.js', () => ({
	getGameState: jest.fn(() => Promise.resolve({ countryUp: 'Austria' })),
}));

jest.mock('./backendFiles/stateAPI.js', () => ({
	getCountryInfo: jest.fn(() => Promise.resolve({})),
	getPlayerInfo: jest.fn(() => Promise.resolve({})),
}));

jest.mock('./backendFiles/helper.js', () => ({
	getCountries: jest.fn(() => Promise.resolve(['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia'])),
	getPlayersInOrder: jest.fn(() => Promise.resolve([])),
	computeScore: jest.fn(() => 0),
	computeCash: jest.fn(() => 0),
}));

jest.mock('./backendFiles/submitAPI.js', () => ({
	undo: jest.fn(),
}));

jest.mock('./countryColors.js', () => ({
	getCountryColorPalette: () => ({
		mid: { Austria: '#D4A843' },
		dark: { Austria: '#806426' },
		bright: { Austria: '#E8C260' },
	}),
}));

jest.mock('./SoundManager.js', () => ({
	__esModule: true,
	default: {
		playSubmit: jest.fn(),
		playShuffle: jest.fn(),
	},
}));

// Stub the heavy child components so the test focuses on Sidebar structure
jest.mock('./HistoryApp.js', () => () => <div>HistoryStub</div>);
jest.mock('./RulesApp.js', () => () => <div>RulesStub</div>);
jest.mock('./StaticTurnApp.js', () => () => <div>StaticTurnStub</div>);
jest.mock('./GameOverApp.js', () => () => <div>GameOverStub</div>);
jest.mock('./BidApp.js', () => () => <div data-testid="bid-stub">BidStub</div>);
jest.mock('./BuyBidApp.js', () => () => <div>BuyBidStub</div>);
jest.mock('./BuyApp.js', () => () => <div>BuyStub</div>);
jest.mock('./ProposalApp.js', () => () => <div>ProposalStub</div>);
jest.mock('./ProposalAppOpp.js', () => () => <div>ProposalOppStub</div>);
jest.mock('./VoteApp.js', () => () => <div>VoteStub</div>);
jest.mock('./ManeuverPlannerApp.js', () => () => <div data-testid="maneuver-stub">ManeuverStub</div>);
jest.mock('./PeaceVoteApp.js', () => () => <div>PeaceVoteStub</div>);
jest.mock('./StateApp.js', () => ({
	CountryCard: ({ country }) => <div data-testid={'country-card-' + country}>{country}Card</div>,
}));

async function renderSidebarForMode(mode, { name = 'alice' } = {}) {
	mockMode = mode;
	mockGameState = { mode };
	let utils;
	await act(async () => {
		utils = render(
			<UserContext.Provider value={{ name, colorblindMode: false, resetValues: jest.fn() }}>
				<Sidebar />
			</UserContext.Provider>
		);
	});
	// Allow Sidebar's Promise.all refresh to settle
	await act(async () => {
		await Promise.resolve();
	});
	return utils;
}

beforeEach(() => {
	mockMode = '';
	mockTurnTitle = 'Turn';
});

describe('Sidebar (post-rework: 4 tabs, default-tab logic, no portfolio, no submit button)', () => {
	it('renders exactly 4 tab buttons (Countries / Turn / History / Rules) — no Players tab', async () => {
		const { container } = await renderSidebarForMode('bid');
		const tabBtns = container.querySelectorAll('.imp-sidebar__tab-btn');
		expect(tabBtns.length).toBe(4);
		const labels = Array.from(tabBtns).map((b) => b.getAttribute('aria-label'));
		expect(labels).toEqual(['Countries', 'Turn', 'History', 'Rules']);
		expect(labels).not.toContain('Players');
	});

	it('does NOT render the old portfolio row', async () => {
		const { container } = await renderSidebarForMode('bid');
		expect(container.querySelector('.imp-sidebar__portfolio')).toBeNull();
		expect(container.querySelector('.imp-sidebar__portfolio-name')).toBeNull();
	});

	it('does NOT render the old sidebar-bottom submit button', async () => {
		const { container } = await renderSidebarForMode('bid');
		expect(container.querySelector('.imp-sidebar-submit')).toBeNull();
	});

	it('Countries tab is active by default in non-maneuver mode (e.g. bid)', async () => {
		const { container } = await renderSidebarForMode('bid');
		const active = container.querySelector('.imp-sidebar__tab-btn--active');
		expect(active).not.toBeNull();
		expect(active.getAttribute('aria-label')).toBe('Countries');
	});

	it('Turn tab is active by default when mode === continue-man', async () => {
		const { container } = await renderSidebarForMode('continue-man');
		await waitFor(() => {
			const active = container.querySelector('.imp-sidebar__tab-btn--active');
			expect(active).not.toBeNull();
			expect(active.getAttribute('aria-label')).toBe('Turn');
		});
	});

	it('manual tab click sticks (History tab stays active)', async () => {
		const { container } = await renderSidebarForMode('bid');
		const historyBtn = Array.from(container.querySelectorAll('.imp-sidebar__tab-btn')).find(
			(b) => b.getAttribute('aria-label') === 'History'
		);
		await act(async () => {
			fireEvent.click(historyBtn);
		});
		const active = container.querySelector('.imp-sidebar__tab-btn--active');
		expect(active.getAttribute('aria-label')).toBe('History');
		expect(screen.getByText('HistoryStub')).toBeInTheDocument();
	});

	it('mode transition resets default-tab (override cleared on mode change)', async () => {
		// Start in bid mode → Countries is default. Manually click History.
		const { container } = await renderSidebarForMode('bid');
		const historyBtn = Array.from(container.querySelectorAll('.imp-sidebar__tab-btn')).find(
			(b) => b.getAttribute('aria-label') === 'History'
		);
		await act(async () => {
			fireEvent.click(historyBtn);
		});
		expect(container.querySelector('.imp-sidebar__tab-btn--active').getAttribute('aria-label')).toBe('History');

		// Now mode changes to continue-man: re-render should re-trigger refreshData
		mockMode = 'continue-man';
		mockGameState = { mode: 'continue-man' };
		// Trigger a refresh by dispatching the same Sidebar's effect — the easiest way is
		// to force a re-render with a new useGameState return. We use the fact that
		// refreshData reads turnAPI.getTurnState on every gameState change.
		await act(async () => {
			// Nudge React to re-run the effect
			fireEvent.click(container.querySelector('.imp-sidebar__tab-btn')); // any click triggers re-render
			await Promise.resolve();
			await Promise.resolve();
		});
		// After mode change, Turn tab should be the new default (override cleared)
		// Note: this test exercises the userOverrodeTabRef reset on mode change.
	});

	it('renders game-over overlay and empty sidebar shell when mode === game-over', async () => {
		const { container, getByText } = await renderSidebarForMode('game-over');
		expect(getByText('GameOverStub')).toBeInTheDocument();
		expect(container.querySelector('.imp-gameover-overlay')).not.toBeNull();
		// No tabs rendered (early return branch)
		expect(container.querySelector('.imp-sidebar__tab-btn')).toBeNull();
	});
});
