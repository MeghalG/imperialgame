import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './MapOverlay.css';
import { Popconfirm } from 'antd';
import { ThunderboltOutlined, GlobalOutlined, HistoryOutlined, ReadOutlined } from '@ant-design/icons';
import UserContext from './UserContext.js';
import * as stateAPI from './backendFiles/stateAPI.js';
import * as helper from './backendFiles/helper.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import useGameState from './useGameState.js';
import { getCountryColorPalette } from './countryColors.js';
import { CountryCard } from './StateApp.js';
import HistoryApp from './HistoryApp.js';
import RulesApp from './RulesApp.js';
import StaticTurnApp from './StaticTurnApp.js';
import GameOverApp from './GameOverApp.js';
import BidApp from './BidApp.js';
import BuyBidApp from './BuyBidApp.js';
import BuyApp from './BuyApp.js';
import ProposalApp from './ProposalApp.js';
import ProposalAppOpp from './ProposalAppOpp.js';
import VoteApp from './VoteApp.js';
import ManeuverPlannerApp from './ManeuverPlannerApp.js';
import PeaceVoteApp from './PeaceVoteApp.js';
import SoundManager from './SoundManager.js';

/**
 * Tabs in the right-hand sidebar column. Players tab removed — players info
 * lives in the always-on PlayersColumn (sibling of MapViewport + Sidebar).
 * Portfolio row also removed — user's info is visually highlighted in
 * PlayersColumn (accent-bar + elevated background).
 */
const TABS = [
	{ key: 'countries', icon: GlobalOutlined, label: 'Countries' },
	{ key: 'turn', icon: ThunderboltOutlined, label: 'Turn' },
	{ key: 'history', icon: HistoryOutlined, label: 'History' },
	{ key: 'rules', icon: ReadOutlined, label: 'Rules' },
];

/**
 * Given the current mode, return the default tab.
 * Countries default except during maneuver (continue-man → Turn) so the
 * maneuver planner isn't buried behind a tab.
 * No default during game-over (GameOverApp overlay covers the UI).
 */
function getDefaultTab(mode) {
	if (mode === 'continue-man') return 'turn';
	return 'countries';
}

function DisplayMode({ mode, turnID, gameState }) {
	switch (mode) {
		case 'bid':
			return <BidApp />;
		case 'buy-bid':
			return <BuyBidApp />;
		case 'buy':
			return <BuyApp />;
		case 'proposal':
			return <ProposalApp />;
		case 'proposal-opp':
			return <ProposalAppOpp />;
		case 'vote':
			return <VoteApp />;
		case 'continue-man': {
			// Composite key: preserve state within a maneuver (same country),
			// but remount when a new maneuver starts for a different country.
			let manCountry = gameState && gameState.currentManeuver ? gameState.currentManeuver.country : '';
			let manKey = 'man-' + manCountry;
			return <ManeuverPlannerApp key={manKey} />;
		}
		case 'peace-vote':
			return <PeaceVoteApp />;
		default:
			return null;
	}
}

function Sidebar() {
	const context = useContext(UserContext);
	const contextRef = useRef(context);
	contextRef.current = context;

	// Tab state. Default tab is derived from mode (see getDefaultTab); a
	// manual click sets userOverrodeTab so the default doesn't clobber the
	// user's choice. userOverrodeTab resets on every mode change.
	const [activeTab, setActiveTab] = useState(() => getDefaultTab(''));
	const userOverrodeTabRef = useRef(false);

	// Turn metadata (Sidebar owns this)
	const [turnTitle, setTurnTitle] = useState('');
	const [mode, setMode] = useState('');
	const [turnID, setTurnID] = useState('');
	const [undoable, setUndoable] = useState(false);
	const [countryUp, setCountryUp] = useState('');
	const prevModeRef = useRef(null);

	// Country data (used by Countries tab)
	const [countries, setCountries] = useState([]);
	const [countryInfo, setCountryInfo] = useState({});
	const [playerInfo, setPlayerInfo] = useState({});

	// Narrow screen drawer state
	const [drawerOpen, setDrawerOpen] = useState(false);

	// Subscribe to centralized game state (driven by GameApp's single listener)
	const { gameState } = useGameState();

	const refreshData = useCallback(async () => {
		try {
			let [turnState, gs, countriesData, country, player] = await Promise.all([
				turnAPI.getTurnState(contextRef.current),
				miscAPI.getGameState(contextRef.current),
				helper.getCountries(contextRef.current),
				stateAPI.getCountryInfo(contextRef.current),
				stateAPI.getPlayerInfo(contextRef.current),
			]);

			setTurnTitle(turnState.turnTitle);
			if (turnState.mode !== prevModeRef.current) {
				// Mode changed (includes initial mount where prevModeRef.current was null).
				// On real transitions (not initial), play shuffle + reset form values.
				if (prevModeRef.current !== null) {
					SoundManager.playShuffle();
					contextRef.current.resetValues();
				}
				// Clear manual-override flag and re-derive default tab from new mode
				userOverrodeTabRef.current = false;
				setActiveTab(getDefaultTab(turnState.mode));
			}
			prevModeRef.current = turnState.mode;
			setMode(turnState.mode);
			setUndoable(turnState.undoable);
			setTurnID(turnState.turnID);
			if (gs && gs.countryUp) {
				setCountryUp(gs.countryUp);
			}
			setCountries(countriesData || []);
			setCountryInfo(country || {});
			setPlayerInfo(player || {});
		} catch (e) {
			console.warn('Sidebar: failed to load data, will retry on next turn change', e);
		}
	}, []);

	// Refresh display data whenever the centralized game state changes.
	useEffect(() => {
		refreshData();
	}, [gameState, context.name, refreshData]);

	function handleTabClick(key) {
		setActiveTab(key);
		userOverrodeTabRef.current = true;
	}

	async function undo() {
		await submitAPI.undo(context);
	}

	let palette = getCountryColorPalette(context.colorblindMode);
	let accentColor = countryUp && palette.bright[countryUp] ? palette.bright[countryUp] : '#c9a84c';
	let darkColors = palette.dark;

	// Game over gets a full-screen overlay
	if (mode === 'game-over') {
		return (
			<React.Fragment>
				<div className="imp-gameover-overlay imp-fade-in">
					<GameOverApp />
				</div>
				<div className="imp-sidebar" />
			</React.Fragment>
		);
	}

	// --- Tab header ---
	function renderTabHeader() {
		if (activeTab === 'turn') {
			return (
				<div className="imp-sidebar__tab-header">
					<div className="imp-sidebar__tab-header-accent" style={{ backgroundColor: accentColor }} />
					<span className="imp-sidebar__tab-header-title">{turnTitle}</span>
					{undoable && (
						<Popconfirm title="Undo last move?" onConfirm={() => undo()} okText="Yes" cancelText="No">
							<span className="imp-undo-link">Undo</span>
						</Popconfirm>
					)}
				</div>
			);
		}
		let tab = TABS.find((t) => t.key === activeTab);
		return (
			<div className="imp-sidebar__tab-header">
				<span className="imp-sidebar__tab-header-title">{tab ? tab.label : ''}</span>
			</div>
		);
	}

	// --- Tab content ---
	// The Turn tab content stays mounted on every tab so its turn-mode
	// component (DisplayMode) keeps setting up mapInteraction (hotspots,
	// rondel selectables, etc). That way the user can act on the map
	// while looking at Countries/History/Rules. Inactive tabs just hide
	// the visual UI; the side effects keep running.
	function renderTabContent() {
		const turnHidden = activeTab !== 'turn';
		return (
			<>
				<div
					className="imp-sidebar__tab-content"
					style={turnHidden ? { display: 'none' } : undefined}
					aria-hidden={turnHidden || undefined}
				>
					<StaticTurnApp key={turnID} />
					<DisplayMode mode={mode} turnID={turnID} gameState={gameState} />
				</div>
				{activeTab === 'countries' && (
					<div className="imp-sidebar__tab-content">
						{countries.map((c) => (
							<CountryCard
								key={c}
								country={c}
								color={palette.mid[c]}
								darkColor={darkColors[c]}
								info={countryInfo[c] || {}}
								playerInfo={playerInfo}
							/>
						))}
					</div>
				)}
				{activeTab === 'history' && (
					<div className="imp-sidebar__tab-content">
						<HistoryApp />
					</div>
				)}
				{activeTab === 'rules' && (
					<div className="imp-sidebar__tab-content">
						<RulesApp />
					</div>
				)}
			</>
		);
	}

	// --- Render ---
	let sidebarContent = (
		<React.Fragment>
			<div className="imp-sidebar__tab-bar">
				{TABS.map((tab) => {
					let Icon = tab.icon;
					let isActive = activeTab === tab.key;
					return (
						<button
							key={tab.key}
							className={'imp-sidebar__tab-btn' + (isActive ? ' imp-sidebar__tab-btn--active' : '')}
							onClick={() => handleTabClick(tab.key)}
							aria-label={tab.label}
						>
							<Icon />
						</button>
					);
				})}
			</div>
			{renderTabHeader()}
			<div className="imp-sidebar__content-scroll">{renderTabContent()}</div>
		</React.Fragment>
	);

	return (
		<React.Fragment>
			{/* Single sidebar instance — inline on desktop, slides in as drawer on narrow */}
			<div className={'imp-sidebar imp-sidebar--desktop' + (drawerOpen ? ' imp-sidebar--drawer-open' : '')}>
				{sidebarContent}
			</div>

			{/* Narrow: icon strip + drawer — drawer is a CSS overlay that repositions
			    the desktop sidebar content via the imp-sidebar--desktop element.
			    We do NOT duplicate sidebarContent here to avoid dual component
			    instances fighting over MapInteractionContext callbacks. */}
			<div className="imp-sidebar-strip">
				{TABS.map((tab) => {
					let Icon = tab.icon;
					return (
						<button
							key={tab.key}
							className={'imp-sidebar-strip__btn' + (activeTab === tab.key ? ' imp-sidebar-strip__btn--active' : '')}
							onClick={() => {
								setDrawerOpen(true);
								handleTabClick(tab.key);
							}}
						>
							<Icon />
						</button>
					);
				})}
			</div>
			{drawerOpen && <div className="imp-sidebar-drawer__mask" onClick={() => setDrawerOpen(false)} />}
		</React.Fragment>
	);
}

export default Sidebar;
