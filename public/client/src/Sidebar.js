import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './MapOverlay.css';
import { Tooltip, Popconfirm } from 'antd';
import {
	DollarCircleFilled,
	DollarCircleOutlined,
	FlagFilled,
	FlagOutlined,
	ThunderboltOutlined,
	TeamOutlined,
	GlobalOutlined,
	TrophyOutlined,
	HistoryOutlined,
	ReadOutlined,
} from '@ant-design/icons';
import UserContext from './UserContext.js';
import * as stateAPI from './backendFiles/stateAPI.js';
import * as helper from './backendFiles/helper.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';
import { getCountryColorPalette } from './countryColors.js';
import { CountryCard, PlayerCard } from './StateApp.js';
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

const TABS = [
	{ key: 'turn', icon: ThunderboltOutlined, label: 'Turn' },
	{ key: 'players', icon: TeamOutlined, label: 'Players' },
	{ key: 'countries', icon: GlobalOutlined, label: 'Countries' },
	{ key: 'scores', icon: TrophyOutlined, label: 'Scores' },
	{ key: 'history', icon: HistoryOutlined, label: 'History' },
	{ key: 'rules', icon: ReadOutlined, label: 'Rules' },
];

function DisplayMode({ mode, turnID }) {
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
		case 'continue-man':
			return <ManeuverPlannerApp key={turnID} />;
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

	// Tab state
	const [activeTab, setActiveTab] = useState('turn');
	const [isDefaultTab, setIsDefaultTab] = useState(true);

	// Turn metadata (Sidebar owns this)
	const [turnTitle, setTurnTitle] = useState('');
	const [mode, setMode] = useState('');
	const [turnID, setTurnID] = useState('');
	const [undoable, setUndoable] = useState(false);
	const [countryUp, setCountryUp] = useState('');
	const [myTurn, setMyTurn] = useState(false);
	const prevModeRef = useRef(null);

	// Player/country data (shared across portfolio + tabs)
	const [countries, setCountries] = useState([]);
	const [countryInfo, setCountryInfo] = useState({});
	const [playerInfo, setPlayerInfo] = useState({});
	const [playersOrdered, setPlayersOrdered] = useState([]);

	// Narrow screen drawer state
	const [drawerOpen, setDrawerOpen] = useState(false);

	const turnRef = useRef(null);

	const refreshData = useCallback(async () => {
		try {
			let [turnState, gs, countriesData, country, player, order, myTurnData] = await Promise.all([
				turnAPI.getTurnState(contextRef.current),
				miscAPI.getGameState(contextRef.current),
				helper.getCountries(contextRef.current),
				stateAPI.getCountryInfo(contextRef.current),
				stateAPI.getPlayerInfo(contextRef.current),
				helper.getPlayersInOrder(contextRef.current),
				turnAPI.getMyTurn(contextRef.current),
			]);

			setTurnTitle(turnState.turnTitle);
			if (prevModeRef.current !== null && turnState.mode !== prevModeRef.current) {
				SoundManager.playShuffle();
			}
			prevModeRef.current = turnState.mode;
			setMode(turnState.mode);
			setUndoable(turnState.undoable);
			setTurnID(turnState.turnID);
			if (gs && gs.countryUp) {
				setCountryUp(gs.countryUp);
			}
			setMyTurn(myTurnData);
			setCountries(countriesData || []);
			setCountryInfo(country || {});
			setPlayerInfo(player || {});
			setPlayersOrdered(order || []);
		} catch (e) {
			console.warn('Sidebar: failed to load data, will retry on next turn change', e);
		}
	}, []);

	// Single turnID listener for all sidebar data
	useEffect(() => {
		refreshData();
		turnRef.current = database.ref('games/' + contextRef.current.game + '/turnID');
		turnRef.current.on('value', (dataSnapshot) => {
			invalidateIfStale(contextRef.current.game, dataSnapshot.val());
			refreshData();
		});
		return () => {
			if (turnRef.current) turnRef.current.off();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Re-fetch when player name changes
	useEffect(() => {
		refreshData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [context.name]);

	// Auto-switch to Turn tab when it's the player's turn (only if on default tab)
	useEffect(() => {
		if (myTurn && isDefaultTab) {
			setActiveTab('turn');
		}
	}, [myTurn, isDefaultTab]);

	function handleTabClick(key) {
		setActiveTab(key);
		setIsDefaultTab(key === 'turn');
		// On narrow screens, if drawer was open via icon strip, keep it open
	}

	async function undo() {
		await submitAPI.undo(context);
	}

	let palette = getCountryColorPalette(context.colorblindMode);
	let accentColor = countryUp && palette.bright[countryUp] ? palette.bright[countryUp] : '#c9a84c';
	let darkColors = palette.dark;
	let brightColors = palette.bright;

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

	// --- Portfolio section (always visible) ---
	function renderPortfolio() {
		if (!context.name) return null;
		let info = playerInfo[context.name] || {};
		return (
			<div className="imp-sidebar__section imp-sidebar__portfolio">
				<div className="imp-sidebar__portfolio-header">
					<span className="imp-sidebar__portfolio-name">{context.name}</span>
					<span className="imp-sidebar__portfolio-money">${twoDec(info.money)}</span>
				</div>
				<div className="imp-sidebar__portfolio-details">
					<span className="imp-sidebar__portfolio-icons">{buildPortfolioIcons(context.name, info)}</span>
					<span className="imp-sidebar__portfolio-stocks">{formatStock(info.stock)}</span>
				</div>
			</div>
		);
	}

	function twoDec(money) {
		if (!money) return '0.00';
		return parseFloat(money).toFixed(2);
	}

	function formatStock(stock) {
		if (!stock) return null;
		let grouped = {};
		for (let entry of stock) {
			if (!grouped[entry.country]) grouped[entry.country] = [];
			grouped[entry.country].push(entry.stock);
		}
		let badges = [];
		for (let country of countries) {
			if (!grouped[country]) continue;
			for (let i = 0; i < grouped[country].length; i++) {
				badges.push(
					<span key={country + i} className="imp-sidebar__stock-badge" style={{ backgroundColor: darkColors[country] }}>
						{grouped[country][i]}
					</span>
				);
			}
		}
		return badges;
	}

	function buildPortfolioIcons(player, info) {
		let icons = [];
		if (info.investor) {
			icons.push(
				<Tooltip key="inv" title="Investor Card" mouseLeaveDelay={0} mouseEnterDelay={0.3} destroyTooltipOnHide>
					<DollarCircleFilled style={{ fontSize: 12, color: '#CCCCCC' }} />
				</Tooltip>
			);
		}
		if (info.swiss) {
			icons.push(
				<Tooltip key="swiss" title="Swiss Banking" mouseLeaveDelay={0} mouseEnterDelay={0.3} destroyTooltipOnHide>
					<DollarCircleOutlined style={{ fontSize: 12, color: '#999' }} />
				</Tooltip>
			);
		}
		for (let c in countryInfo) {
			if ((countryInfo[c].leadership || [])[0] === player) {
				icons.push(
					<Tooltip key={'l-' + c} title={c + ' Leader'} mouseLeaveDelay={0} mouseEnterDelay={0.3} destroyTooltipOnHide>
						<FlagFilled style={{ fontSize: 11, color: brightColors[c] }} />
					</Tooltip>
				);
			}
			if ((countryInfo[c] || {}).gov === 'democracy' && (countryInfo[c].leadership || [])[1] === player) {
				icons.push(
					<Tooltip
						key={'o-' + c}
						title={c + ' Opposition'}
						mouseLeaveDelay={0}
						mouseEnterDelay={0.3}
						destroyTooltipOnHide
					>
						<FlagOutlined style={{ fontSize: 11, color: brightColors[c] }} />
					</Tooltip>
				);
			}
		}
		return icons;
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
	function renderTabContent() {
		switch (activeTab) {
			case 'turn':
				return (
					<div className="imp-sidebar__tab-content">
						<StaticTurnApp key={turnID} />
						<DisplayMode mode={mode} turnID={turnID} />
					</div>
				);
			case 'players':
				return (
					<div className="imp-sidebar__tab-content">
						{playersOrdered.map((p) => {
							if (!p) return null;
							let info = playerInfo[p] || {};
							return (
								<div key={p} className="imp-player-card">
									<div>
										<span className="imp-player-card__icons">{buildPortfolioIcons(p, info)}</span>
										<span className="imp-player-card__name">{p}</span>
										<span className="imp-player-card__money">${twoDec(info.money)}</span>
									</div>
									<div className="imp-player-card__stock">{formatStock(info.stock)}</div>
								</div>
							);
						})}
					</div>
				);
			case 'countries':
				return (
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
				);
			case 'scores':
				return (
					<div className="imp-sidebar__tab-content">
						{playersOrdered.filter(Boolean).map((p) => (
							<PlayerCard
								key={p}
								player={p}
								countryColors={countries.map((c) => darkColors[c])}
								info={playerInfo[p] || {}}
								countryInfos={countryInfo}
							/>
						))}
					</div>
				);
			case 'history':
				return (
					<div className="imp-sidebar__tab-content">
						<HistoryApp />
					</div>
				);
			case 'rules':
				return (
					<div className="imp-sidebar__tab-content">
						<RulesApp />
					</div>
				);
			default:
				return null;
		}
	}

	// --- Render ---
	let sidebarContent = (
		<React.Fragment>
			{renderPortfolio()}
			<div className="imp-sidebar__divider" />
			<div className="imp-sidebar__tab-bar">
				{TABS.map((tab) => {
					let Icon = tab.icon;
					let isActive = activeTab === tab.key;
					let showIndicator = tab.key === 'turn' && myTurn && !isDefaultTab;
					return (
						<button
							key={tab.key}
							className={
								'imp-sidebar__tab-btn' +
								(isActive ? ' imp-sidebar__tab-btn--active' : '') +
								(showIndicator ? ' imp-sidebar__tab-btn--indicator' : '')
							}
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
			{/* Desktop: inline sidebar */}
			<div className="imp-sidebar imp-sidebar--desktop">{sidebarContent}</div>

			{/* Narrow: icon strip + drawer */}
			<div className="imp-sidebar-strip">
				{TABS.map((tab) => {
					let Icon = tab.icon;
					let showIndicator = tab.key === 'turn' && myTurn && !isDefaultTab;
					return (
						<button
							key={tab.key}
							className={
								'imp-sidebar-strip__btn' +
								(activeTab === tab.key ? ' imp-sidebar-strip__btn--active' : '') +
								(showIndicator ? ' imp-sidebar-strip__btn--indicator' : '')
							}
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
			<div className={'imp-sidebar imp-sidebar--drawer' + (drawerOpen ? ' imp-sidebar--drawer-open' : '')}>
				{sidebarContent}
			</div>
		</React.Fragment>
	);
}

export default Sidebar;
