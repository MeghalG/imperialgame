// ---------------------------------------------------------------------------
// TurnFlow.test.js — Component-level tests for the turn flow rendering pipeline.
//
// These tests verify that when game state changes (via stateCache), the correct
// UI renders: right mode component shows, right title displays, right player
// sees "my turn", and re-renders happen the expected number of times.
//
// This is NOT testing game logic (that's in submitAPI.test.js / gameFlow.test.js).
// This is testing: "when the data changes, does the screen update correctly?"
// ---------------------------------------------------------------------------

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { setCachedState, clearCache } from './backendFiles/stateCache.js';

// ---- Mock Firebase --------------------------------------------------------
jest.mock('./backendFiles/firebase.js', () => ({
	database: {
		ref: jest.fn(() => ({
			once: jest.fn(() =>
				Promise.resolve({
					val: () => null,
				})
			),
			on: jest.fn(),
			off: jest.fn(),
			set: jest.fn(() => Promise.resolve()),
		})),
	},
	callFunction: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
}));

jest.mock('emailjs-com', () => ({
	init: jest.fn(),
	send: jest.fn(),
}));

// ---- Mock heavy child components to isolate rendering tests ---------------
// Each mock renders a simple div with data attributes we can query.

jest.mock('./BidApp.js', () => {
	return function MockBidApp() {
		return <div data-testid="mode-bid">BidApp</div>;
	};
});
jest.mock('./BuyBidApp.js', () => {
	return function MockBuyBidApp() {
		return <div data-testid="mode-buy-bid">BuyBidApp</div>;
	};
});
jest.mock('./BuyApp.js', () => {
	return function MockBuyApp() {
		return <div data-testid="mode-buy">BuyApp</div>;
	};
});
jest.mock('./ProposalApp.js', () => {
	return function MockProposalApp() {
		return <div data-testid="mode-proposal">ProposalApp</div>;
	};
});
jest.mock('./ProposalAppOpp.js', () => {
	return function MockProposalAppOpp() {
		return <div data-testid="mode-proposal-opp">ProposalAppOpp</div>;
	};
});
jest.mock('./VoteApp.js', () => {
	return function MockVoteApp() {
		return <div data-testid="mode-vote">VoteApp</div>;
	};
});
jest.mock('./ManeuverPlannerApp.js', () => {
	return function MockManeuverPlannerApp() {
		return <div data-testid="mode-continue-man">ManeuverPlannerApp</div>;
	};
});
jest.mock('./PeaceVoteApp.js', () => {
	return function MockPeaceVoteApp() {
		return <div data-testid="mode-peace-vote">PeaceVoteApp</div>;
	};
});
jest.mock('./StaticTurnApp.js', () => {
	return function MockStaticTurnApp() {
		return <div data-testid="static-turn">StaticTurnApp</div>;
	};
});
jest.mock('./HistoryApp.js', () => {
	return function MockHistoryApp() {
		return <div data-testid="history">HistoryApp</div>;
	};
});
jest.mock('./RulesApp.js', () => {
	return function MockRulesApp() {
		return <div data-testid="rules">RulesApp</div>;
	};
});
jest.mock('./GameOverApp.js', () => {
	return function MockGameOverApp() {
		return <div data-testid="game-over">GameOverApp</div>;
	};
});
jest.mock('./StateApp.js', () => ({
	CountryCard: () => <div>CountryCard</div>,
	PlayerCard: () => <div>PlayerCard</div>,
}));
jest.mock('./SoundManager.js', () => ({
	playShuffle: jest.fn(),
	playTurnHorn: jest.fn(),
	isMuted: jest.fn(() => false),
	toggleMute: jest.fn(() => true),
}));

// ---- Mock API functions that Sidebar calls in refreshData -----------------
jest.mock('./backendFiles/turnAPI.js', () => ({
	getTurnState: jest.fn(() =>
		Promise.resolve({
			turnTitle: 'Austria up',
			mode: 'bid',
			turnID: 1,
			undoable: false,
		})
	),
	getMyTurn: jest.fn(() => Promise.resolve(false)),
	getTitle: jest.fn(() => Promise.resolve('Austria up')),
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
	getTimer: jest.fn(() => Promise.resolve(null)),
}));

// ---- Imports (AFTER mocks) ------------------------------------------------
import UserContext from './UserContext.js';
import Sidebar from './Sidebar.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as stateAPI from './backendFiles/stateAPI.js';

// ---- Test helpers ---------------------------------------------------------

function createContext(overrides = {}) {
	return {
		game: 'testGame',
		name: 'Alice',
		colorblindMode: false,
		setBid: jest.fn(),
		setBuyBid: jest.fn(),
		setBuyCountry: jest.fn(),
		setBuyStock: jest.fn(),
		setVote: jest.fn(),
		setWheelSpot: jest.fn(),
		setFactoryLoc: jest.fn(),
		setFleetProduce: jest.fn(),
		setArmyProduce: jest.fn(),
		setFleetMan: jest.fn(),
		setArmyMan: jest.fn(),
		setImport: jest.fn(),
		setManeuverDest: jest.fn(),
		setManeuverAction: jest.fn(),
		setPeaceVoteChoice: jest.fn(),
		setReturnStock: jest.fn(),
		resetValues: jest.fn(),
		setColorblindMode: jest.fn(),
		...overrides,
	};
}

function renderSidebar(contextOverrides = {}) {
	let ctx = createContext(contextOverrides);
	let result = render(
		<UserContext.Provider value={ctx}>
			<Sidebar />
		</UserContext.Provider>
	);
	return { ...result, ctx };
}

async function flushAll() {
	for (let i = 0; i < 5; i++) {
		await act(async () => {
			await new Promise((r) => setTimeout(r, 0));
		});
	}
}

// ---- Setup / teardown -----------------------------------------------------

beforeEach(() => {
	clearCache();
	jest.clearAllMocks();

	// Default mock responses
	turnAPI.getTurnState.mockResolvedValue({
		turnTitle: 'Austria up',
		mode: 'bid',
		turnID: 1,
		undoable: false,
	});
	turnAPI.getMyTurn.mockResolvedValue(false);
	miscAPI.getGameState.mockResolvedValue({ countryUp: 'Austria' });
	stateAPI.getCountryInfo.mockResolvedValue({});
	stateAPI.getPlayerInfo.mockResolvedValue({});
});

// ===========================================================================
// Mode display tests — verify the right mode component renders
// ===========================================================================
describe('Sidebar displays correct mode component', () => {
	test('bid mode renders BidApp', async () => {
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Bidding on Austria',
			mode: 'bid',
			turnID: 1,
			undoable: false,
		});

		renderSidebar();
		await flushAll();

		expect(screen.getByTestId('mode-bid')).toBeInTheDocument();
	});

	test('proposal mode renders ProposalApp', async () => {
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Austria proposal',
			mode: 'proposal',
			turnID: 5,
			undoable: false,
		});

		renderSidebar();
		await flushAll();

		expect(screen.getByTestId('mode-proposal')).toBeInTheDocument();
	});

	test('vote mode renders VoteApp', async () => {
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Vote on France',
			mode: 'vote',
			turnID: 8,
			undoable: false,
		});

		renderSidebar();
		await flushAll();

		expect(screen.getByTestId('mode-vote')).toBeInTheDocument();
	});

	test('game-over mode renders GameOverApp overlay', async () => {
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Game Over',
			mode: 'game-over',
			turnID: 100,
			undoable: false,
		});

		renderSidebar();
		await flushAll();

		expect(screen.getByTestId('game-over')).toBeInTheDocument();
	});
});

// ===========================================================================
// Mode transition tests — verify UI updates when state changes
// ===========================================================================
describe('Sidebar updates when game state changes via stateCache', () => {
	test('mode switches from bid to proposal after state change', async () => {
		// Start in bid mode
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Bidding on Austria',
			mode: 'bid',
			turnID: 1,
			undoable: false,
		});

		renderSidebar();
		await flushAll();
		expect(screen.getByTestId('mode-bid')).toBeInTheDocument();

		// Simulate turn change: new state arrives via stateCache
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Austria proposal',
			mode: 'proposal',
			turnID: 10,
			undoable: false,
		});

		act(() => {
			setCachedState('testGame', 10, { mode: 'proposal', turnID: 10 });
		});
		await flushAll();

		expect(screen.getByTestId('mode-proposal')).toBeInTheDocument();
		expect(screen.queryByTestId('mode-bid')).not.toBeInTheDocument();
	});

	test('title updates when mode changes', async () => {
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Bidding on Austria',
			mode: 'bid',
			turnID: 1,
			undoable: false,
		});

		renderSidebar();
		await flushAll();
		expect(screen.getByText('Bidding on Austria')).toBeInTheDocument();

		// Change to proposal
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'France proposal — Alice leads',
			mode: 'proposal',
			turnID: 10,
			undoable: false,
		});

		act(() => {
			setCachedState('testGame', 10, { mode: 'proposal', turnID: 10 });
		});
		await flushAll();

		expect(screen.getByText('France proposal — Alice leads')).toBeInTheDocument();
	});

	test('state change replaces previous mode component completely', async () => {
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Bidding',
			mode: 'bid',
			turnID: 1,
			undoable: false,
		});

		renderSidebar();
		await flushAll();
		expect(screen.getByTestId('mode-bid')).toBeInTheDocument();

		// Change to buy
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Buying',
			mode: 'buy',
			turnID: 10,
			undoable: false,
		});

		act(() => {
			setCachedState('testGame', 10, { mode: 'buy', turnID: 10 });
		});
		await flushAll();

		expect(screen.getByTestId('mode-buy')).toBeInTheDocument();
		// Old mode component should be gone
		expect(screen.queryByTestId('mode-bid')).not.toBeInTheDocument();

		// Change to vote
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Voting',
			mode: 'vote',
			turnID: 11,
			undoable: false,
		});

		act(() => {
			setCachedState('testGame', 11, { mode: 'vote', turnID: 11 });
		});
		await flushAll();

		expect(screen.getByTestId('mode-vote')).toBeInTheDocument();
		expect(screen.queryByTestId('mode-buy')).not.toBeInTheDocument();
	});
});

// ===========================================================================
// Re-render counting — verify components don't render too many times
// ===========================================================================
describe('re-render counting', () => {
	test('single state change causes Sidebar refreshData to be called once', async () => {
		renderSidebar();
		await flushAll();

		let callsBefore = turnAPI.getTurnState.mock.calls.length;

		// One state change
		act(() => {
			setCachedState('testGame', 10, { mode: 'proposal', turnID: 10 });
		});
		await flushAll();

		let callsAfter = turnAPI.getTurnState.mock.calls.length;
		// Should have refreshed exactly once (1 new call to getTurnState)
		expect(callsAfter - callsBefore).toBe(1);
	});

	test('setCachedState with same turnID still notifies (authoritative update)', async () => {
		renderSidebar();
		await flushAll();

		let callsBefore = turnAPI.getTurnState.mock.calls.length;

		// Two setCachedState calls with same turnID (optimistic + authoritative)
		act(() => {
			setCachedState('testGame', 10, { mode: 'proposal', turnID: 10 });
		});
		await flushAll();

		act(() => {
			setCachedState('testGame', 10, { mode: 'proposal', turnID: 10, authoritative: true });
		});
		await flushAll();

		let callsAfter = turnAPI.getTurnState.mock.calls.length;
		// Both should trigger refreshData (2 calls)
		expect(callsAfter - callsBefore).toBe(2);
	});
});

// ===========================================================================
// UserContext cleanup on mode change
// ===========================================================================
describe('UserContext cleanup on mode transitions', () => {
	test('resetValues is called when mode changes', async () => {
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Bidding',
			mode: 'bid',
			turnID: 1,
			undoable: false,
		});

		let { ctx } = renderSidebar();
		await flushAll();

		expect(ctx.resetValues).not.toHaveBeenCalled();

		// Change mode
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Proposing',
			mode: 'proposal',
			turnID: 10,
			undoable: false,
		});

		act(() => {
			setCachedState('testGame', 10, { mode: 'proposal', turnID: 10 });
		});
		await flushAll();

		expect(ctx.resetValues).toHaveBeenCalled();
	});

	test('resetValues is NOT called when mode stays the same', async () => {
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Bidding',
			mode: 'bid',
			turnID: 1,
			undoable: false,
		});

		let { ctx } = renderSidebar();
		await flushAll();

		// Same mode, different turnID (e.g. another player submitted)
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Still Bidding',
			mode: 'bid',
			turnID: 2,
			undoable: false,
		});

		act(() => {
			setCachedState('testGame', 2, { mode: 'bid', turnID: 2 });
		});
		await flushAll();

		expect(ctx.resetValues).not.toHaveBeenCalled();
	});
});

// ===========================================================================
// Portfolio display — verify player info renders
// ===========================================================================
describe('portfolio display', () => {
	test('shows player name and money', async () => {
		stateAPI.getPlayerInfo.mockResolvedValue({
			Alice: { money: 42.5, stock: [], investor: false, swiss: false },
		});

		renderSidebar({ name: 'Alice' });
		await flushAll();

		expect(screen.getByText('Alice')).toBeInTheDocument();
		expect(screen.getByText('$42.50')).toBeInTheDocument();
	});

	test('updates money when state changes', async () => {
		stateAPI.getPlayerInfo.mockResolvedValue({
			Alice: { money: 42.5, stock: [], investor: false, swiss: false },
		});

		renderSidebar({ name: 'Alice' });
		await flushAll();
		expect(screen.getByText('$42.50')).toBeInTheDocument();

		// State change — Alice spent money
		stateAPI.getPlayerInfo.mockResolvedValue({
			Alice: { money: 30.0, stock: [], investor: false, swiss: false },
		});

		act(() => {
			setCachedState('testGame', 10, { turnID: 10 });
		});
		await flushAll();

		expect(screen.getByText('$30.00')).toBeInTheDocument();
	});
});
