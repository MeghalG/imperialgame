import React, { useState, useEffect, useContext } from 'react';
import MapInteractionContext from './MapInteractionContext.js';
import UserContext from './UserContext.js';
import { readSetup } from './backendFiles/stateCache.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import './MapOverlay.css';

function UnitMarkerLayer({ mapWidth }) {
	const context = useContext(UserContext);
	const mapInteraction = useContext(MapInteractionContext);
	const [territories, setTerritories] = useState({});

	useEffect(() => {
		async function fetchTerritories() {
			let gameState = await miscAPI.getGameState(context);
			if (!gameState || !gameState.setup) return;
			let setup = await readSetup(gameState.setup + '/territories');
			if (setup) {
				setTerritories(setup);
			}
		}
		fetchTerritories();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	let markers = mapInteraction.unitMarkers;
	if (!markers || markers.length === 0) {
		return null;
	}

	// Group markers by territory for offset calculation
	let groups = {};
	for (let i = 0; i < markers.length; i++) {
		let t = markers[i].territoryName;
		if (!groups[t]) groups[t] = [];
		groups[t].push(i);
	}

	let markerSize = mapWidth ? mapWidth * 0.025 : 28;
	let markerFont = mapWidth ? mapWidth * 0.012 : 14;
	let markerSpacing = mapWidth ? mapWidth * 0.016 : 18;
	let markerOffset = markerSize / 2;

	let elements = [];
	for (let i = 0; i < markers.length; i++) {
		let marker = markers[i];
		let territory = territories[marker.territoryName];
		if (!territory || !territory.unitCoords) continue;

		let coords = territory.unitCoords;
		let groupIndices = groups[marker.territoryName];
		let posInGroup = groupIndices.indexOf(i);
		let groupSize = groupIndices.length;

		// Offset: center the group, then shift each marker
		let offsetPx = 0;
		if (groupSize > 1) {
			let totalWidth = (groupSize - 1) * markerSpacing;
			offsetPx = posInGroup * markerSpacing - totalWidth / 2;
		}

		let className = 'imp-unit-marker';
		if (marker.isActive) {
			className += ' imp-unit-marker--active';
		} else if (marker.isPlanned) {
			className += ' imp-unit-marker--planned';
		} else {
			className += ' imp-unit-marker--idle';
		}

		let icon = marker.unitType === 'fleet' ? '\u2693' : '\u2694';

		elements.push(
			<div
				key={marker.phase + '-' + marker.index}
				className={className}
				onClick={(e) => {
					e.stopPropagation();
					mapInteraction.onUnitMarkerClicked(marker.phase, marker.index);
				}}
				style={{
					left: 'calc(' + coords[0] + ' + ' + (offsetPx - markerOffset) + 'px)',
					top: 'calc(' + coords[1] + ' - ' + markerOffset + 'px)',
					width: markerSize,
					height: markerSize,
					fontSize: markerFont,
					color: marker.color || '#c9a84c',
				}}
				title={marker.unitType + ' at ' + marker.territoryName}
			>
				<span className="imp-unit-marker__icon">{icon}</span>
				{marker.isPlanned && !marker.isActive && <span className="imp-unit-marker__check">{'\u2713'}</span>}
			</div>
		);
	}

	return <React.Fragment>{elements}</React.Fragment>;
}

export default UnitMarkerLayer;
