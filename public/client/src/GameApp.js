import React, { useState, useCallback } from 'react';
import './App.css';
import './MapOverlay.css';
import { StateApp } from './StateApp.js';
import HistoryApp from './HistoryApp.js';
import RulesApp from './RulesApp.js';
import MainApp from './MainApp.js';
import TopBar from './TopBar.js';
import MapInteractionContext from './MapInteractionContext.js';

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

function GameApp() {
	const [historyOpen, setHistoryOpen] = useState(false);
	const [infoOpen, setInfoOpen] = useState(false);
	const [rulesOpen, setRulesOpen] = useState(false);

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
		(name) => {
			setSelectedItem(name);
			if (onItemSelectedCb) {
				onItemSelectedCb(name);
			}
		},
		[onItemSelectedCb]
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
		highlightedTerritories,
		setInteraction,
		clearInteraction,
		plannedMoves,
		setPlannedMoves,
		unitMarkers,
		setUnitMarkers,
		onUnitMarkerClicked: handleUnitMarkerClicked,
		setOnUnitMarkerClickedCb,
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
