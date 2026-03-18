import React, { useState, useEffect, useContext } from 'react';
import UserContext from './UserContext.js';
import MapInteractionContext from './MapInteractionContext.js';
import { readSetup } from './backendFiles/stateCache.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import { actionColor } from './maneuverActionUtils.js';
import './MapOverlay.css';

function parsePercent(s) {
	if (typeof s === 'number') return s;
	return parseFloat(s);
}

function computePath(x1, y1, x2, y2) {
	let dx = x2 - x1;
	let dy = y2 - y1;
	let dist = Math.sqrt(dx * dx + dy * dy);

	// For close territories, use a quadratic curve to avoid label overlap
	if (dist < 8 && dist > 0) {
		let mx = (x1 + x2) / 2;
		let my = (y1 + y2) / 2;
		let nx = -dy / dist;
		let ny = dx / dist;
		let offset = dist * 0.4;
		let cx = mx + nx * offset;
		let cy = my + ny * offset;
		return 'M ' + x1 + ' ' + y1 + ' Q ' + cx + ' ' + cy + ' ' + x2 + ' ' + y2;
	}

	return 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2;
}

function MovementArrowLayer() {
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

	let moves = mapInteraction.plannedMoves;
	if (!moves || moves.length === 0 || Object.keys(territories).length === 0) {
		return null;
	}

	// Collect unique colors for arrowhead markers
	let colorSet = {};
	for (let i = 0; i < moves.length; i++) {
		let move = moves[i];
		let c = actionColor(move.action) || move.color || '#c9a84c';
		colorSet[c] = true;
	}
	let uniqueColors = Object.keys(colorSet);

	// Count how many arrows share the same origin→dest pair for offset
	let routeCount = {};
	for (let i = 0; i < moves.length; i++) {
		let key = moves[i].origin + '→' + moves[i].dest;
		routeCount[key] = (routeCount[key] || 0) + 1;
	}
	let routeIndex = {};

	let paths = [];
	for (let i = 0; i < moves.length; i++) {
		let move = moves[i];
		let fromT = territories[move.origin];
		let toT = territories[move.dest];
		if (!fromT || !fromT.unitCoords || !toT || !toT.unitCoords) continue;

		let color = actionColor(move.action) || move.color || '#c9a84c';
		let colorIndex = uniqueColors.indexOf(color);
		let x1 = parsePercent(fromT.unitCoords[0]);
		let y1 = parsePercent(fromT.unitCoords[1]);
		let x2 = parsePercent(toT.unitCoords[0]);
		let y2 = parsePercent(toT.unitCoords[1]);

		// Offset parallel arrows so multiple units on the same route are visible
		let routeKey = move.origin + '→' + move.dest;
		let count = routeCount[routeKey] || 1;
		let idx = routeIndex[routeKey] || 0;
		routeIndex[routeKey] = idx + 1;

		if (count > 1) {
			let dx = x2 - x1;
			let dy = y2 - y1;
			let dist = Math.sqrt(dx * dx + dy * dy) || 1;
			let nx = -dy / dist;
			let ny = dx / dist;
			// Spread arrows perpendicular to direction, centered
			let offset = (idx - (count - 1) / 2) * 0.6;
			x1 += nx * offset;
			y1 += ny * offset;
			x2 += nx * offset;
			y2 += ny * offset;
		}

		// Build path through waypoints for army transport visualization
		let d;
		if (move.waypoints && move.waypoints.length > 0) {
			let points = [{ x: x1, y: y1 }];
			for (let wp of move.waypoints) {
				let wpT = territories[wp];
				if (wpT && wpT.unitCoords) {
					points.push({
						x: parsePercent(wpT.unitCoords[0]),
						y: parsePercent(wpT.unitCoords[1]),
					});
				}
			}
			points.push({ x: x2, y: y2 });
			let segments = [];
			for (let j = 0; j < points.length - 1; j++) {
				segments.push(computePath(points[j].x, points[j].y, points[j + 1].x, points[j + 1].y));
			}
			d = segments.join(' ');
		} else {
			d = computePath(x1, y1, x2, y2);
		}

		// Dashed when not locked (draft state); solid when locked or no locked field
		let dashArray = move.locked === false ? '8 4' : undefined;

		paths.push(
			<path
				key={'arrow-' + i}
				className="imp-movement-arrow"
				d={d}
				stroke={color}
				strokeWidth={0.5}
				fill="none"
				strokeLinecap="round"
				strokeDasharray={dashArray}
				markerEnd={'url(#imp-arr-' + colorIndex + ')'}
				opacity={0.9}
			/>
		);
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
			<defs>
				{uniqueColors.map((color, i) => (
					<marker
						key={i}
						id={'imp-arr-' + i}
						markerWidth="3"
						markerHeight="2.4"
						refX="2.6"
						refY="1.2"
						orient="auto"
						markerUnits="userSpaceOnUse"
					>
						<polygon points="0 0, 3 1.2, 0 2.4" fill={color} />
					</marker>
				))}
			</defs>
			{paths}
		</svg>
	);
}

export default MovementArrowLayer;
