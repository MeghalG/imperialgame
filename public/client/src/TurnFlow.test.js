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
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { setCachedState, clearCache } from './backendFiles/stateCache.js';

// Stub ResizeObserver (MapViewport uses it; Sidebar doesn't but imports may)
global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

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

// ---- Mock GameApp's children so we can test it in isolation ---------------
jest.mock('./TopBar.js', () => {
	return function MockTopBar() {
		return <div data-testid="topbar">TopBar</div>;
	};
});
jest.mock('./MainApp.js', () => {
	return function MockMainApp() {
		return <div data-testid="mainapp">MainApp</div>;
	};
});
jest.mock('./TurnAnnouncement.js', () => {
	return function MockTurnAnnouncement({ countryName, subtitle }) {
		return (
			<div data-testid="announcement">
				{countryName} — {subtitle}
			</div>
		);
	};
});
jest.mock('./MapInteractionContext.js', () => {
	const React = require('react');
	return React.createContext({});
});

// ---- Imports (AFTER mocks) ------------------------------------------------
import UserContext from './UserContext.js';
import Sidebar from './Sidebar.js';
import GameApp from './GameApp.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as stateAPI from './backendFiles/stateAPI.js';
import { invalidateIfStale, readGameState } from './backendFiles/stateCache.js';
import { database } from './backendFiles/firebase.js';

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

function renderGameApp(contextOverrides = {}) {
	let ctx = createContext(contextOverrides);
	let result = render(
		<UserContext.Provider value={ctx}>
			<GameApp />
		</UserContext.Provider>
	);
	return { ...result, ctx };
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

/**
 * After the 2026-04-16 panel rework, Countries is the sidebar's default tab
 * (except during continue-man). These tests predate that and assert that
 * mode components (BidApp, ProposalApp, etc) render in the sidebar — which
 * means the Turn tab must be active. Click Turn to activate it.
 */
async function clickTurnTab() {
	const turnBtn = document.querySelector('.imp-sidebar__tab-btn[aria-label="Turn"]');
	if (!turnBtn) throw new Error('Turn tab button not found in sidebar');
	await act(async () => {
		fireEvent.click(turnBtn);
	});
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
		await clickTurnTab();

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
		await clickTurnTab();

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
		await clickTurnTab();

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
		await clickTurnTab();
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
		// After mode change, userOverrodeTab is cleared, so Countries becomes the
		// default again. Re-click Turn to see the proposal component.
		await clickTurnTab();

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
		await clickTurnTab();
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
		await clickTurnTab();

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
		await clickTurnTab();
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
		await clickTurnTab();

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
		await clickTurnTab();

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
// NOTE: The 'portfolio display' describe block was deleted in the 2026-04-16
// panel rework. The portfolio row was removed from Sidebar; user's info now
// lives in the always-on PlayersColumn (tested in PlayersColumn.test.js).
// See DESIGN.md Decisions Log 2026-04-16 for the approved override.
describe.skip('portfolio display (REMOVED — see PlayersColumn.test.js)', () => {
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

// ===========================================================================
// "Your Turn" announcement — test the exact bugs reported:
// 1. Submitting player should NOT see "Your Turn" flash after their own submit
// 2. Other player SHOULD see "Your Turn" when it becomes their turn
// 3. Player with consecutive turns should see announcement each time
// ===========================================================================
describe('"Your Turn" announcement', () => {
	test('no announcement on initial load (even if myTurn=true)', async () => {
		// Alice loads the game and it's already her turn — no announcement
		setCachedState('testGame', 5, {
			turnID: 5,
			playerInfo: { Alice: { myTurn: true } },
		});

		renderGameApp({ name: 'Alice' });
		await flushAll();

		expect(screen.queryByTestId('announcement')).not.toBeInTheDocument();
	});

	test('announcement shows when myTurn transitions false → true', async () => {
		// Start: not Alice's turn
		setCachedState('testGame', 5, {
			turnID: 5,
			playerInfo: { Alice: { myTurn: false }, Bob: { myTurn: true } },
		});

		turnAPI.getTitle.mockResolvedValue('France up with proposal');

		renderGameApp({ name: 'Alice' });
		await flushAll();

		// Now it becomes Alice's turn
		act(() => {
			setCachedState('testGame', 6, {
				turnID: 6,
				playerInfo: { Alice: { myTurn: true }, Bob: { myTurn: false } },
			});
		});
		await flushAll();

		expect(screen.getByTestId('announcement')).toBeInTheDocument();
		expect(screen.getByTestId('announcement').textContent).toContain('Your Turn');
	});

	test('NO announcement when myTurn stays true (same player, state update)', async () => {
		// Alice's turn — she's looking at the UI, state refreshes but it's still her turn
		setCachedState('testGame', 5, {
			turnID: 5,
			playerInfo: { Alice: { myTurn: true } },
		});

		renderGameApp({ name: 'Alice' });
		await flushAll();

		// State updates but myTurn stays true (e.g. authoritative update from CF)
		act(() => {
			setCachedState('testGame', 5, {
				turnID: 5,
				playerInfo: { Alice: { myTurn: true } },
				authoritative: true,
			});
		});
		await flushAll();

		expect(screen.queryByTestId('announcement')).not.toBeInTheDocument();
	});

	test('NO announcement when submitting player transitions true → false', async () => {
		// Alice submits her turn — myTurn goes from true to false
		setCachedState('testGame', 5, {
			turnID: 5,
			playerInfo: { Alice: { myTurn: true }, Bob: { myTurn: false } },
		});

		renderGameApp({ name: 'Alice' });
		await flushAll();

		// Alice submits, now it's Bob's turn
		act(() => {
			setCachedState('testGame', 6, {
				turnID: 6,
				playerInfo: { Alice: { myTurn: false }, Bob: { myTurn: true } },
			});
		});
		await flushAll();

		// Alice should NOT see "Your Turn" — she just submitted
		expect(screen.queryByTestId('announcement')).not.toBeInTheDocument();
	});

	test('announcement fires on consecutive turns for same player', async () => {
		// Start: Alice's turn is false
		setCachedState('testGame', 5, {
			turnID: 5,
			playerInfo: { Alice: { myTurn: false } },
		});

		turnAPI.getTitle.mockResolvedValue('Austria up');

		renderGameApp({ name: 'Alice' });
		await flushAll();

		// Turn 1: becomes Alice's turn
		act(() => {
			setCachedState('testGame', 6, {
				turnID: 6,
				playerInfo: { Alice: { myTurn: true } },
			});
		});
		await flushAll();
		expect(screen.getByTestId('announcement')).toBeInTheDocument();

		// Alice submits — no longer her turn
		act(() => {
			setCachedState('testGame', 7, {
				turnID: 7,
				playerInfo: { Alice: { myTurn: false } },
			});
		});
		await flushAll();

		// Turn 2: Alice's turn again (e.g. she leads another country)
		turnAPI.getTitle.mockResolvedValue('France up');
		act(() => {
			setCachedState('testGame', 8, {
				turnID: 8,
				playerInfo: { Alice: { myTurn: true } },
			});
		});
		await flushAll();

		// Should see announcement again (second consecutive turn)
		expect(screen.getByTestId('announcement')).toBeInTheDocument();
	});
});

// ===========================================================================
// Full submit cycle — simulate what happens when a player submits a turn.
// This is the exact scenario that was broken: optimistic → authoritative → listener
// ===========================================================================
describe('full submit cycle (optimistic → authoritative → listener)', () => {
	test('sidebar updates after optimistic setCachedState from finalizeSubmit', async () => {
		// Start: bid mode, Alice's turn
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Bidding on Austria',
			mode: 'bid',
			turnID: 5,
			undoable: false,
		});

		renderSidebar({ name: 'Alice' });
		await flushAll();
		await clickTurnTab();
		expect(screen.getByTestId('mode-bid')).toBeInTheDocument();
		expect(screen.getByText('Bidding on Austria')).toBeInTheDocument();

		// Alice submits her bid. finalizeSubmit calls setCachedState with optimistic state.
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Bob buying Austria stock',
			mode: 'buy-bid',
			turnID: 6,
			undoable: true,
		});

		act(() => {
			// This is what finalizeSubmit does
			setCachedState('testGame', 6, { mode: 'buy-bid', turnID: 6 });
		});
		await flushAll();
		await clickTurnTab();

		// Sidebar should now show buy-bid mode
		expect(screen.getByTestId('mode-buy-bid')).toBeInTheDocument();
		expect(screen.queryByTestId('mode-bid')).not.toBeInTheDocument();
		expect(screen.getByText('Bob buying Austria stock')).toBeInTheDocument();
	});

	test('sidebar still works after full optimistic + authoritative + listener cycle', async () => {
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'France proposal',
			mode: 'proposal',
			turnID: 10,
			undoable: false,
		});

		renderSidebar({ name: 'Alice' });
		await flushAll();
		await clickTurnTab();
		expect(screen.getByTestId('mode-proposal')).toBeInTheDocument();

		// Step 1: finalizeSubmit — optimistic state (dictatorship executes, moves to next country)
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'England proposal',
			mode: 'proposal',
			turnID: 11,
			undoable: true,
		});

		act(() => {
			setCachedState('testGame', 11, { mode: 'proposal', turnID: 11, countryUp: 'England' });
		});
		await flushAll();
		// After mode-change, userOverrodeTab cleared — Countries is default again.
		// Click Turn to see turnTitle ("England proposal") in the tab header.
		await clickTurnTab();
		expect(screen.getByText('England proposal')).toBeInTheDocument();

		// Step 2: callCF returns — authoritative state (same turnID, possibly adjusted data)
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'England proposal',
			mode: 'proposal',
			turnID: 11,
			undoable: true,
		});

		act(() => {
			setCachedState('testGame', 11, { mode: 'proposal', turnID: 11, countryUp: 'England', authoritative: true });
		});
		await flushAll();
		await clickTurnTab();

		// Sidebar should still show the correct state (not blank, not stale)
		expect(screen.getByTestId('mode-proposal')).toBeInTheDocument();
		expect(screen.getByText('England proposal')).toBeInTheDocument();
	});

	test('sidebar updates for non-submitting player when state arrives', async () => {
		// Bob is watching. It was Alice's turn (France proposal).
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'France proposal — Alice leads',
			mode: 'proposal',
			turnID: 10,
			undoable: false,
		});

		renderSidebar({ name: 'Bob' });
		await flushAll();
		await clickTurnTab();
		expect(screen.getByText('France proposal — Alice leads')).toBeInTheDocument();

		// Alice submits. Firebase listener fires on Bob's client.
		// Bob's stateCache is invalidated and reads fresh data.
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'England proposal — Charlie leads',
			mode: 'proposal',
			turnID: 11,
			undoable: false,
		});

		act(() => {
			setCachedState('testGame', 11, { mode: 'proposal', turnID: 11, countryUp: 'England' });
		});
		await flushAll();
		await clickTurnTab();

		// Bob should now see the updated state (title in the Turn tab header)
		expect(screen.getByText('England proposal — Charlie leads')).toBeInTheDocument();
	});
});

// ===========================================================================
// Listener-path tests — simulate what GameApp's onValue listener actually does:
// invalidateIfStale → readGameState (which may read from Firebase on cache miss)
// This exercises the readGameState dedup that setCachedState-only tests miss.
// ===========================================================================
describe('listener path: invalidateIfStale → readGameState → sidebar updates', () => {
	test('non-submitting player: sidebar updates via listener path', async () => {
		// Start: cached state from previous turn
		setCachedState('testGame', 5, { mode: 'bid', turnID: 5 });

		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Bidding on Austria',
			mode: 'bid',
			turnID: 5,
			undoable: false,
		});

		renderSidebar({ name: 'Bob' });
		await flushAll();
		await clickTurnTab();
		expect(screen.getByTestId('mode-bid')).toBeInTheDocument();

		// Another player submits. Firebase mock returns new state.
		database.ref.mockImplementation((path) => ({
			once: jest.fn(() =>
				Promise.resolve({
					val: () =>
						path === 'games/testGame'
							? { mode: 'proposal', turnID: 6, countryUp: 'Austria', playerInfo: {}, countryInfo: {} }
							: null,
				})
			),
			on: jest.fn(),
			off: jest.fn(),
			set: jest.fn(() => Promise.resolve()),
		}));

		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'Austria proposal',
			mode: 'proposal',
			turnID: 6,
			undoable: false,
		});

		// This is exactly what GameApp's onValue listener does:
		await act(async () => {
			invalidateIfStale('testGame', 6);
			await readGameState({ game: 'testGame' });
		});
		await flushAll();
		await clickTurnTab();

		// Sidebar should have updated to proposal mode
		expect(screen.getByTestId('mode-proposal')).toBeInTheDocument();
		expect(screen.queryByTestId('mode-bid')).not.toBeInTheDocument();
	});

	test('submitting player: optimistic + listener path = sidebar shows new state', async () => {
		// Start: Alice is in proposal mode
		setCachedState('testGame', 10, { mode: 'proposal', turnID: 10 });

		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'France proposal',
			mode: 'proposal',
			turnID: 10,
			undoable: false,
		});

		renderSidebar({ name: 'Alice' });
		await flushAll();
		await clickTurnTab();
		expect(screen.getByTestId('mode-proposal')).toBeInTheDocument();

		// Step 1: Alice submits. finalizeSubmit caches optimistic state.
		turnAPI.getTurnState.mockResolvedValue({
			turnTitle: 'England proposal',
			mode: 'proposal',
			turnID: 11,
			undoable: true,
		});

		act(() => {
			setCachedState('testGame', 11, { mode: 'proposal', turnID: 11, countryUp: 'England' });
		});
		await flushAll();
		await clickTurnTab();
		expect(screen.getByText('England proposal')).toBeInTheDocument();

		// Step 2: database.set() triggers onValue. Cache matches (turnID 11), so
		// invalidateIfStale is a no-op and readGameState is a cache hit.
		await act(async () => {
			invalidateIfStale('testGame', 11); // no-op: cachedTurnID === 11
			await readGameState({ game: 'testGame' }); // cache hit: returns immediately
		});
		await flushAll();

		// Sidebar should still show the updated state (not reverted, not blank)
		expect(screen.getByText('England proposal')).toBeInTheDocument();
		expect(screen.getByTestId('mode-proposal')).toBeInTheDocument();
	});
});
