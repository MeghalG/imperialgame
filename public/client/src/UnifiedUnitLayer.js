import React, { useState, useEffect, useContext } from 'react';
import MapInteractionContext from './MapInteractionContext.js';
import UserContext from './UserContext.js';
import { readSetup } from './backendFiles/stateCache.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as mapAPI from './backendFiles/mapAPI.js';
import * as helper from './backendFiles/helper.js';
import { getCountryColorPalette } from './countryColors.js';
import './MapOverlay.css';

/**
 * UnifiedUnitLayer — renders ALL units on the map in both normal and maneuver modes.
 *
 * Normal mode: all countries' units as Font Awesome icons (non-interactive).
 * Maneuver mode: maneuvering country's units become interactive markers
 *   (anchor/swords with active/planned/idle states); other countries' units
 *   stay as Font Awesome icons but slightly dimmed.
 *
 * Replaces: MapApp's inline unit rendering + UnitMarkerLayer.
 */
function UnifiedUnitLayer({ mapWidth }) {
	const context = useContext(UserContext);
	const mapInteraction = useContext(MapInteractionContext);
	const [territories, setTerritories] = useState({});
	const [units, setUnits] = useState([]);
	const [countries, setCountries] = useState([]);

	// Fetch territory setup and unit data
	useEffect(() => {
		async function fetchData() {
			let gameState = await miscAPI.getGameState(context);
			if (!gameState || !gameState.setup) return;
			let setup = await readSetup(gameState.setup + '/territories');
			if (setup) setTerritories(setup);
			let c = await helper.getCountries(context);
			if (c) setCountries(c);
			let u = await mapAPI.getUnits(context);
			if (u) setUnits(u);
		}
		fetchData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [context.turnID, context.game]);

	let interactiveMarkers = mapInteraction.unitMarkers || [];
	let isManeuverMode = interactiveMarkers.length > 0;

	let colorPalette = getCountryColorPalette(context.colorblindMode);
	let countryColors = {};
	for (let i = 0; i < countries.length; i++) {
		countryColors[countries[i]] = colorPalette.map[countries[i]] || '#888';
	}

	// Get the maneuvering country (if any) to skip its non-interactive icons
	// (they're rendered as interactive markers instead).
	let maneuveringCountry = null;
	if (isManeuverMode && interactiveMarkers.length > 0) {
		maneuveringCountry = interactiveMarkers[0].countryName || null;
	}

	let elements = [];

	// === Part 1: Non-interactive units (all countries, or other countries in maneuver mode) ===
	let unitFont = mapWidth ? mapWidth * 0.015 : 15;
	let unitBoxW = mapWidth ? mapWidth * 0.11 : 110;
	let boxSize = mapWidth ? mapWidth * 0.055 : 55;

	for (let i = 0; i < units.length; i++) {
		let unitData = units[i];
		let coord = unitData[0];
		let countryUnits = unitData[1];

		let icons = [];
		for (let j = 0; j < countryUnits.length; j++) {
			let countryName = countries[j];
			let color = countryColors[countryName] || '#888';

			// In maneuver mode, skip the maneuvering country's units here —
			// they're rendered as interactive markers below.
			if (isManeuverMode && countryName === maneuveringCountry) continue;

			let opacity = 1.0;

			// Fleets
			for (let k = 0; k < countryUnits[j][0]; k++) {
				icons.push(
					<i
						key={'fl-' + j + '-' + k}
						style={{ color: color, opacity: opacity }}
						className="fas fa-play fa-rotate-90"
					></i>
				);
			}
			// Hostile armies
			for (let k = 0; k < countryUnits[j][1]; k++) {
				icons.push(
					<i key={'ha-' + j + '-' + k} style={{ color: color, opacity: opacity }} className="fas fa-circle fa"></i>
				);
			}
			// Peaceful armies
			for (let k = 0; k < countryUnits[j][2]; k++) {
				icons.push(
					<i key={'pa-' + j + '-' + k} style={{ color: color, opacity: opacity }} className="fas fa-plus-circle fa"></i>
				);
			}
		}

		if (icons.length > 0) {
			elements.push(
				<div
					key={'unit-' + i}
					className="imp-map-unit"
					style={{
						position: 'absolute',
						left: coord[0],
						top: coord[1],
						width: unitBoxW,
						height: boxSize,
						fontSize: unitFont,
						pointerEvents: 'none',
						textShadow: '-0.5px 0 #000, 0 0.5px #255, 0.5px 0 #000, 0 -0.5px #000',
					}}
				>
					{icons}
				</div>
			);
		}
	}

	// === Part 2: Interactive markers (maneuver mode only) ===
	if (isManeuverMode) {
		// Group markers by territory for offset calculation
		let groups = {};
		for (let i = 0; i < interactiveMarkers.length; i++) {
			let t = interactiveMarkers[i].territoryName;
			if (!groups[t]) groups[t] = [];
			groups[t].push(i);
		}

		let markerSize = mapWidth ? mapWidth * 0.025 : 28;
		let markerFont = mapWidth ? mapWidth * 0.012 : 14;
		let markerSpacing = mapWidth ? mapWidth * 0.016 : 18;
		let markerOffset = markerSize / 2;

		for (let i = 0; i < interactiveMarkers.length; i++) {
			let marker = interactiveMarkers[i];
			let territory = territories[marker.territoryName];
			if (!territory || !territory.unitCoords) continue;

			let coords = territory.unitCoords;
			let groupIndices = groups[marker.territoryName];
			let posInGroup = groupIndices.indexOf(i);
			let groupSize = groupIndices.length;

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

			let iconClass = marker.unitType === 'fleet' ? 'fas fa-play fa-rotate-90' : 'fas fa-circle';

			elements.push(
				<div
					key={'marker-' + marker.phase + '-' + marker.index}
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
					<span className="imp-unit-marker__icon">
						<i className={iconClass}></i>
					</span>
					{marker.isPlanned && !marker.isActive && <span className="imp-unit-marker__check">{'\u2713'}</span>}
				</div>
			);
		}
	}

	return <React.Fragment>{elements}</React.Fragment>;
}

export default UnifiedUnitLayer;
