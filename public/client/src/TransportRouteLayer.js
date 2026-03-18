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

	// Only render fleets that have a destination assigned
	let assignedFleets = fleetPlans.filter((plan) => plan.dest != null && plan.dest !== '');

	if (assignedFleets.length === 0 || Object.keys(territories).length === 0) {
		return null;
	}

	let palette = getCountryColorPalette(context.colorblindMode);
	let color = (palette.bright && palette.bright[country]) || palette.bright['Austria'] || '#c9a84c';

	let circles = [];
	for (let i = 0; i < assignedFleets.length; i++) {
		let plan = assignedFleets[i];
		let territory = territories[plan.dest];
		if (!territory || !territory.unitCoords) continue;

		let x = parsePercent(territory.unitCoords[0]);
		let y = parsePercent(territory.unitCoords[1]);

		circles.push(
			<circle
				key={'transport-' + i}
				cx={x}
				cy={y}
				r={1.5}
				fill="none"
				stroke={color}
				strokeWidth={0.25}
				strokeDasharray="1 0.5"
				opacity={0.35}
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
