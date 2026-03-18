import React, { useState, useEffect, useContext } from 'react';
import UserContext from './UserContext.js';
import ManeuverPlanContext from './ManeuverPlanContext.js';
import { readSetup } from './backendFiles/stateCache.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import { getCountryColorPalette } from './countryColors.js';
import './MapOverlay.css';

function parsePercent(s) {
	if (typeof s === 'number') return s;
	return parseFloat(s);
}

function TransportRouteLayer() {
	const context = useContext(UserContext);
	const planContext = useContext(ManeuverPlanContext);
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

	let { loaded, fleetPlans, country } = planContext;

	// Don't render if context isn't loaded or no plans exist
	if (!loaded || !fleetPlans || fleetPlans.length === 0) {
		return null;
	}

	// Only render circles for fleets that provide army transport
	// (destination is a sea territory with peace or normal-move action)
	let transportFleets = fleetPlans.filter((plan) => {
		if (!plan.dest || plan.dest === '') return false;
		let territory = territories[plan.dest];
		if (!territory || !territory.sea) return false;
		// Only peaceful/normal fleets provide transport
		let action = plan.action || '';
		let split = action.split(' ');
		return split[0] === '' || split[0] === 'peace';
	});

	if (transportFleets.length === 0 || Object.keys(territories).length === 0) {
		return null;
	}

	let palette = getCountryColorPalette(context.colorblindMode);
	let color = (palette.bright && palette.bright[country]) || '#c9a84c';

	let circles = [];
	for (let i = 0; i < transportFleets.length; i++) {
		let plan = transportFleets[i];
		let territory = territories[plan.dest];
		if (!territory || !territory.unitCoords) continue;

		let coords = territory.unitCoords;
		if (!Array.isArray(coords) || coords.length < 2) continue;
		let x = parsePercent(coords[0]);
		let y = parsePercent(coords[1]);
		if (isNaN(x) || isNaN(y)) continue;

		// Transport bridge indicator: anchor icon-like circle
		circles.push(
			<circle
				key={'transport-' + i}
				cx={x}
				cy={y}
				r={1.2}
				fill={color}
				fillOpacity={0.08}
				stroke={color}
				strokeWidth={0.2}
				strokeDasharray="0.8 0.4"
				opacity={0.5}
			/>
		);
	}

	if (circles.length === 0) {
		return null;
	}

	return (
		<svg
			viewBox="0 0 100 100"
			preserveAspectRatio="none"
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				width: '100%',
				height: '100%',
				pointerEvents: 'none',
				overflow: 'visible',
			}}
		>
			{circles}
		</svg>
	);
}

export default TransportRouteLayer;
