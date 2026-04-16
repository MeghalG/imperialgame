import React, { useState, useCallback, useEffect, useContext, useRef, useMemo } from 'react';
import './App.css';
import './MapOverlay.css';
import MainApp from './MainApp.js';
import TopBar from './TopBar.js';
import MapInteractionContext from './MapInteractionContext.js';
import TurnControlContext from './TurnControlContext.js';
import TurnAnnouncement from './TurnAnnouncement.js';
import SoundManager from './SoundManager.js';
import UserContext from './UserContext.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale, readGameState } from './backendFiles/stateCache.js';
import useGameState from './useGameState.js';
import { getCountryColorPalette } from './countryColors.js';

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

	// Rondel-specific interaction state (persists alongside territory interaction)
	const [rondelSelectableItems, setRondelSelectableItems] = useState([]);
	const [rondelSelectedItem, setRondelSelectedItem] = useState(null);
	const [rondelCosts, setRondelCosts] = useState({});
	const [onRondelItemSelectedCb, setOnRondelItemSelectedCb] = useState(() => () => {});

	const setRondelInteraction = useCallback((items, callback, costs) => {
		setRondelSelectableItems(items || []);
		setRondelSelectedItem(null);
		setOnRondelItemSelectedCb(() => callback || (() => {}));
		setRondelCosts(costs || {});
	}, []);

	const clearRondelInteraction = useCallback(() => {
		setRondelSelectableItems([]);
		setRondelSelectedItem(null);
		setOnRondelItemSelectedCb(() => () => {});
		setRondelCosts({});
	}, []);

	const handleRondelItemSelected = useCallback(
		(name, event) => {
			setRondelSelectedItem(name);
			if (onRondelItemSelectedCb) {
				onRondelItemSelectedCb(name, event);
			}
		},
		[onRondelItemSelectedCb]
	);

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
		rondelSelectableItems,
		rondelSelectedItem,
		rondelCosts,
		onRondelItemSelected: handleRondelItemSelected,
		setRondelInteraction,
		clearRondelInteraction,
	};

	const [turnSubmitHandler, setTurnSubmitHandler] = useState(null);
	const [turnSubmitLabel, setTurnSubmitLabel] = useState('Submit');
	const [turnSubmitEnabled, setTurnSubmitEnabled] = useState(false);
	const [turnSubmitting, setTurnSubmitting] = useState(false);
	const [turnPreviewText, setTurnPreviewText] = useState('');

	const registerSubmit = useCallback(({ handler, label, enabled, preview }) => {
		if (handler !== undefined) setTurnSubmitHandler(() => handler);
		if (label !== undefined) setTurnSubmitLabel(label);
		if (enabled !== undefined) setTurnSubmitEnabled(enabled);
		if (preview !== undefined) setTurnPreviewText(preview);
	}, []);

	const clearSubmit = useCallback(() => {
		setTurnSubmitHandler(null);
		setTurnSubmitLabel('Submit');
		setTurnSubmitEnabled(false);
		setTurnSubmitting(false);
		setTurnPreviewText('');
	}, []);

	const turnControlValue = useMemo(
		() => ({
			submitHandler: turnSubmitHandler,
			submitLabel: turnSubmitLabel,
			submitEnabled: turnSubmitEnabled,
			submitting: turnSubmitting,
			setSubmitting: setTurnSubmitting,
			previewText: turnPreviewText,
			registerSubmit,
			clearSubmit,
		}),
		[turnSubmitHandler, turnSubmitLabel, turnSubmitEnabled, turnSubmitting, turnPreviewText, registerSubmit, clearSubmit]
	);

	return (
		<MapInteractionContext.Provider value={mapInteractionValue}>
			<TurnControlContext.Provider value={turnControlValue}>
				<div style={{ background: '#0a0b0d', minHeight: '100vh' }}>
					<TopBar />
					<MainApp />
					{announcement && (
						<TurnAnnouncement
							key={announcement.key}
							countryName={announcement.country}
							countryColor={announcement.color}
							subtitle={announcement.subtitle}
						/>
					)}
				</div>
			</TurnControlContext.Provider>
		</MapInteractionContext.Provider>
	);
}

export default GameApp;
