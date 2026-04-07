import React, { useState, useCallback, useEffect, useContext, useRef } from 'react';
import './App.css';
import './MapOverlay.css';
import MainApp from './MainApp.js';
import TopBar from './TopBar.js';
import MapInteractionContext from './MapInteractionContext.js';
import TurnAnnouncement from './TurnAnnouncement.js';
import SoundManager from './SoundManager.js';
import UserContext from './UserContext.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale, readGameState } from './backendFiles/stateCache.js';
import useGameState from './useGameState.js';
import { getCountryColorPalette } from './countryColors.js';

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
	const [announcement, setAnnouncement] = useState(null);
	const contextRef = useRef(context);
	contextRef.current = context;

	// Centralized turnID listener — drives stateCache for all subscribers.
	// Pure data: no side effects besides cache management.
	const centralListenerRef = useRef(null);
	useEffect(() => {
		if (!context.game) return;
		centralListenerRef.current = database.ref('games/' + context.game + '/turnID');
		centralListenerRef.current.on('value', (snap) => {
			invalidateIfStale(context.game, snap.val());
			readGameState({ game: context.game });
		});
		return () => {
			if (centralListenerRef.current) centralListenerRef.current.off();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [context.game]);

	// "Your Turn" announcement — triggered by myTurn transitioning from false → true.
	// Uses the centralized gameState so it sees authoritative data, not optimistic.
	const { gameState } = useGameState();
	const prevMyTurnRef = useRef(null);
	useEffect(() => {
		if (!gameState || !context.name) return;
		let playerInfo = gameState.playerInfo && gameState.playerInfo[context.name];
		let myTurn = playerInfo && playerInfo.myTurn;
		let wasMyTurn = prevMyTurnRef.current;
		prevMyTurnRef.current = myTurn;

		// Only announce on false → true transition (not on initial load)
		if (myTurn && wasMyTurn === false) {
			(async () => {
				try {
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
				} catch (e) {
					/* ignore */
				}
			})();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [gameState]);

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
				<TopBar />
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
			</div>
		</MapInteractionContext.Provider>
	);
}

export default GameApp;
