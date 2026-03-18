import React, { useState, useCallback, useEffect, useContext, useRef } from 'react';
import './App.css';
import './MapOverlay.css';
import { StateApp } from './StateApp.js';
import HistoryApp from './HistoryApp.js';
import RulesApp from './RulesApp.js';
import MainApp from './MainApp.js';
import TopBar from './TopBar.js';
import MapInteractionContext from './MapInteractionContext.js';
import TurnAnnouncement from './TurnAnnouncement.js';
import SoundManager from './SoundManager.js';
import UserContext from './UserContext.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import { database } from './backendFiles/firebase.js';
import { getCountryColorPalette } from './countryColors.js';

function SlideDrawer({ title, open, onClose, width, children }) {
	return (
		<React.Fragment>
			{open && <div className="imp-drawer__mask" onClick={onClose} />}
			<div className={'imp-drawer' + (open ? ' imp-drawer--open' : '')} style={{ width: width }}>
				<div className="imp-drawer__header">
					<span>{title}</span>
					<button className="imp-drawer__close" onClick={onClose}>
						&times;
					</button>
				</div>
				<div className="imp-drawer__body">{children}</div>
			</div>
		</React.Fragment>
	);
}

function CompassRose() {
	return (
		<svg className="imp-compass" width="48" height="48" viewBox="0 0 48 48" fill="none">
			<g opacity="0.8">
				<path d="M24 2 L26 20 L24 16 L22 20 Z" fill="#c9a84c" />
				<path d="M24 46 L26 28 L24 32 L22 28 Z" fill="rgba(255,255,255,0.4)" />
				<path d="M2 24 L20 22 L16 24 L20 26 Z" fill="rgba(255,255,255,0.4)" />
				<path d="M46 24 L28 22 L32 24 L28 26 Z" fill="rgba(255,255,255,0.4)" />
				<circle cx="24" cy="24" r="3" fill="none" stroke="#c9a84c" strokeWidth="0.5" />
				<circle cx="24" cy="24" r="1" fill="#c9a84c" />
				<text
					x="24"
					y="0"
					textAnchor="middle"
					fill="#c9a84c"
					fontSize="5"
					fontWeight="700"
					fontFamily="var(--imp-font-condensed)"
				>
					N
				</text>
			</g>
		</svg>
	);
}

function GameApp() {
	const context = useContext(UserContext);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [infoOpen, setInfoOpen] = useState(false);
	const [rulesOpen, setRulesOpen] = useState(false);
	const [announcement, setAnnouncement] = useState(null);
	const turnListenerRef = useRef(null);
	const isFirstLoadRef = useRef(true);
	const contextRef = useRef(context);
	contextRef.current = context;

	// Listen for turn changes to show announcement
	useEffect(() => {
		if (!context.game) return;
		turnListenerRef.current = database.ref('games/' + context.game + '/turnID');
		turnListenerRef.current.on('value', async () => {
			if (isFirstLoadRef.current) {
				isFirstLoadRef.current = false;
				return;
			}
			try {
				let myTurn = await turnAPI.getMyTurn(contextRef.current);
				if (myTurn) {
					let title = await turnAPI.getTitle(contextRef.current);
					let country = (title || '').split(' ')[0];
					let colors = getCountryColorPalette(contextRef.current.colorblindMode).bright;
					SoundManager.playTurnHorn();
					setAnnouncement({
						key: Date.now(),
						country: country,
						color: colors[country] || '#c9a84c',
						subtitle: 'Your Turn',
					});
				}
			} catch (e) {
				/* ignore */
			}
		});
		return () => {
			if (turnListenerRef.current) turnListenerRef.current.off();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [context.game]);

	// Map interaction state
	const [interactionMode, setInteractionMode] = useState(null);
	const [selectableItems, setSelectableItems] = useState([]);
	const [selectedItem, setSelectedItem] = useState(null);
	const [highlightColor, setHighlightColor] = useState('#c9a84c');
	const [onItemSelectedCb, setOnItemSelectedCb] = useState(() => () => {});
	const [highlightedTerritories, setHighlightedTerritories] = useState({});
	const [plannedMoves, setPlannedMoves] = useState([]);
	const [selectableCosts, setSelectableCosts] = useState({});
	const [unitMarkers, setUnitMarkers] = useState([]);
	const [onUnitMarkerClickedCb, setOnUnitMarkerClickedCb] = useState(() => () => {});
	const [onItemRightClickedCb, setOnItemRightClickedCb] = useState(null);

	const setInteraction = useCallback((mode, items, color, callback, highlights, costs) => {
		setInteractionMode(mode);
		setSelectableItems(items || []);
		setSelectedItem(null);
		setHighlightColor(color || '#c9a84c');
		setOnItemSelectedCb(() => callback || (() => {}));
		setHighlightedTerritories(highlights || {});
		setSelectableCosts(costs || {});
	}, []);

	const clearInteraction = useCallback(() => {
		setInteractionMode(null);
		setSelectableItems([]);
		setSelectedItem(null);
		setOnItemSelectedCb(() => () => {});
		setHighlightedTerritories({});
		setSelectableCosts({});
		setUnitMarkers([]);
	}, []);

	const handleItemSelected = useCallback(
		(name, event) => {
			setSelectedItem(name);
			if (onItemSelectedCb) {
				onItemSelectedCb(name, event);
			}
		},
		[onItemSelectedCb]
	);

	const handleItemRightClicked = useCallback(
		(name, event) => {
			if (onItemRightClickedCb) {
				onItemRightClickedCb(name, event);
			}
		},
		[onItemRightClickedCb]
	);

	const handleUnitMarkerClicked = useCallback(
		(phase, index) => {
			if (onUnitMarkerClickedCb) {
				onUnitMarkerClickedCb(phase, index);
			}
		},
		[onUnitMarkerClickedCb]
	);

	const mapInteractionValue = {
		interactionMode,
		selectableItems,
		selectableCosts,
		selectedItem,
		highlightColor,
		onItemSelected: handleItemSelected,
		onItemRightClicked: onItemRightClickedCb ? handleItemRightClicked : null,
		highlightedTerritories,
		setInteraction,
		clearInteraction,
		plannedMoves,
		setPlannedMoves,
		unitMarkers,
		setUnitMarkers,
		onUnitMarkerClicked: handleUnitMarkerClicked,
		setOnUnitMarkerClickedCb,
		setOnItemRightClickedCb,
	};

	return (
		<MapInteractionContext.Provider value={mapInteractionValue}>
			<div style={{ background: '#0a0b0d', minHeight: '100vh' }}>
				<TopBar
					onToggleHistory={() => setHistoryOpen(!historyOpen)}
					onToggleInfo={() => setInfoOpen(!infoOpen)}
					onToggleRules={() => setRulesOpen(!rulesOpen)}
				/>
				<MainApp />
				<CompassRose />
				{announcement && (
					<TurnAnnouncement
						key={announcement.key}
						countryName={announcement.country}
						countryColor={announcement.color}
						subtitle={announcement.subtitle}
					/>
				)}
				<SlideDrawer title="Game History" open={historyOpen} onClose={() => setHistoryOpen(false)} width={420}>
					<HistoryApp />
				</SlideDrawer>
				<SlideDrawer
					title="Detailed Info"
					open={infoOpen}
					onClose={() => setInfoOpen(false)}
					width={Math.min(window.innerWidth * 0.85, 960)}
				>
					<StateApp />
				</SlideDrawer>
				<SlideDrawer title="Game Rules" open={rulesOpen} onClose={() => setRulesOpen(false)} width={600}>
					<RulesApp />
				</SlideDrawer>
			</div>
		</MapInteractionContext.Provider>
	);
}

export default GameApp;
