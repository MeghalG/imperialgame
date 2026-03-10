import React, { useState, useEffect, useContext } from 'react';
import MapInteractionContext from './MapInteractionContext.js';
import UserContext from './UserContext.js';
import { readSetup } from './backendFiles/stateCache.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import TERRITORY_BOUNDARIES, { SEED_POSITIONS } from './territoryBoundaries.js';
import TerritoryBoundaryLayer from './TerritoryBoundaryLayer.js';

function TerritoryHotspotLayer() {
	const context = useContext(UserContext);
	const mapInteraction = useContext(MapInteractionContext);
	const [territories, setTerritories] = useState({});

	let debugShowAll =
		typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('showBoundaries') === '1';

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

	// Debug mode: show all boundaries with country colors when ?showBoundaries=1
	if (debugShowAll && Object.keys(territories).length > 0) {
		const COUNTRY_COLORS = {
			Edinburgh: '#FF4444',
			Liverpool: '#FF6666',
			Sheffield: '#FF3333',
			London: '#FF5555',
			Brest: '#FF6600',
			Paris: '#00FF00',
			Dijon: '#0066FF',
			Bordeaux: '#FFFF00',
			Marseille: '#FF00FF',
			Hamburg: '#AAAACC',
			Cologne: '#9999BB',
			Berlin: '#BBBBDD',
			Munich: '#8888AA',
			Danzig: '#AAAADD',
			Prague: '#DDCC00',
			Vienna: '#EEDD22',
			Budapest: '#CCBB00',
			Trieste: '#DDDD44',
			Lemberg: '#BBAA00',
			Genoa: '#33CC33',
			Venice: '#44DD44',
			Florence: '#22BB22',
			Rome: '#55EE55',
			Naples: '#33DD33',
			'St Petersburg': '#AA44DD',
			Moscow: '#BB55EE',
			Warsaw: '#9933CC',
			Kiev: '#CC66FF',
			Odessa: '#AA55DD',
			Dublin: '#55AAAA',
			Holland: '#55AA88',
			Belgium: '#66BB99',
			Norway: '#77BBAA',
			Sweden: '#66AABB',
			Denmark: '#55BBAA',
			Portugal: '#77AA99',
			Spain: '#66BB88',
			Morocco: '#88BBAA',
			Algeria: '#77CCBB',
			Tunis: '#88CCAA',
			Romania: '#99BBAA',
			'Western Balkans': '#77AABB',
			Bulgaria: '#88BBBB',
			Greece: '#66CCAA',
			Turkey: '#77BBBB',
			Switzerland: '#FFFFFF',
			'North Atlantic': '#3366AA',
			'North Sea': '#4477BB',
			'English Channel': '#3355AA',
			'Bay of Biscay': '#2255AA',
			'Baltic Sea': '#4466BB',
			'Western Med': '#3377AA',
			'Ionian Sea': '#2266AA',
			'Eastern Med': '#4488BB',
			'Black Sea': '#3388AA',
		};

		let allNames = [...new Set([...Object.keys(territories), ...Object.keys(TERRITORY_BOUNDARIES)])];
		let polygons = [];
		let labels = [];

		for (let i = 0; i < allNames.length; i++) {
			let name = allNames[i];
			let verts = TERRITORY_BOUNDARIES[name];
			let color = COUNTRY_COLORS[name] || '#FFFFFF';
			let territory = territories[name];

			if (verts && verts.length > 0) {
				let points = verts.map((v) => v[0] + ',' + v[1]).join(' ');
				polygons.push(
					<polygon
						key={name}
						points={points}
						fill={color}
						fillOpacity={0.25}
						stroke={color}
						strokeWidth={0.2}
						strokeOpacity={0.8}
					/>
				);
			}

			if (territory && territory.unitCoords) {
				let left = territory.unitCoords[0];
				let top = territory.unitCoords[1];
				if (typeof left === 'number') left = left + '%';
				if (typeof top === 'number') top = top + '%';
				labels.push(
					<div
						key={'debug-label-' + name}
						style={{
							position: 'absolute',
							left: left,
							top: top,
							transform: 'translate(-50%, -50%)',
							whiteSpace: 'nowrap',
							fontSize: '8px',
							fontWeight: 700,
							color: color,
							textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)',
							pointerEvents: 'none',
							letterSpacing: '0.3px',
							zIndex: 5,
						}}
					>
						{name}
					</div>
				);
			}
		}

		return (
			<React.Fragment>
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
					{polygons}
					{SEED_POSITIONS &&
						Object.entries(SEED_POSITIONS).map(([name, pts]) => {
							let color = COUNTRY_COLORS[name] || '#FFFFFF';
							return pts.map((pt, pi) => (
								<circle
									key={'seed-' + name + '-' + pi}
									cx={pt[0]}
									cy={pt[1]}
									r={0.4}
									fill={pi === 0 ? '#FFFFFF' : '#000000'}
									stroke={color}
									strokeWidth={0.15}
								/>
							));
						})}
				</svg>
				<div
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						width: '100%',
						height: '100%',
						pointerEvents: 'none',
					}}
				>
					{labels}
					{SEED_POSITIONS &&
						Object.entries(SEED_POSITIONS).map(([name, pts]) => {
							let color = COUNTRY_COLORS[name] || '#FFFFFF';
							return pts.map((pt, pi) =>
								pi > 0 ? (
									<div
										key={'seed-label-' + name + '-' + pi}
										style={{
											position: 'absolute',
											left: pt[0] + '%',
											top: pt[1] + '%',
											transform: 'translate(6px, -50%)',
											whiteSpace: 'nowrap',
											fontSize: '6px',
											fontWeight: 700,
											color: color,
											textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)',
											pointerEvents: 'none',
											zIndex: 5,
										}}
									>
										{name}
									</div>
								) : null
							);
						})}
				</div>
			</React.Fragment>
		);
	}

	if (mapInteraction.interactionMode !== 'select-territory') {
		return null;
	}

	return (
		<TerritoryBoundaryLayer
			territories={territories}
			boundaries={TERRITORY_BOUNDARIES}
			selectableItems={mapInteraction.selectableItems}
			selectedItem={mapInteraction.selectedItem}
			highlightColor={mapInteraction.highlightColor}
			highlightedTerritories={mapInteraction.highlightedTerritories}
			onItemSelected={mapInteraction.onItemSelected}
			selectableCosts={mapInteraction.selectableCosts || {}}
		/>
	);
}

export default TerritoryHotspotLayer;
