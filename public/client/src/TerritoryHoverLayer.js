import { useState, useEffect, useRef, useContext } from 'react';
import hoverSignal from './hoverSignal.js';
import TERRITORY_BOUNDARIES from './territoryBoundaries.js';
import UserContext from './UserContext.js';
import useGameState from './useGameState.js';
import { readSetup } from './backendFiles/stateCache.js';
import { getCountryColorPalette } from './countryColors.js';
import './MapOverlay.css';

/**
 * Point-in-polygon test using ray casting algorithm.
 * Coords are percentage-based (0-100).
 */
function pointInPolygon(px, py, verts) {
	let inside = false;
	for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
		let xi = verts[i][0],
			yi = verts[i][1];
		let xj = verts[j][0],
			yj = verts[j][1];
		let aboveI = yi > py;
		let aboveJ = yj > py;
		if (aboveI !== aboveJ && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}

/**
 * Find which territory contains the given percentage coordinates.
 */
function hitTest(pctX, pctY) {
	for (let name in TERRITORY_BOUNDARIES) {
		let verts = TERRITORY_BOUNDARIES[name];
		if (verts && verts.length > 2 && pointInPolygon(pctX, pctY, verts)) {
			return name;
		}
	}
	return null;
}

function TerritoryHoverLayer() {
	const context = useContext(UserContext);
	const { gameState } = useGameState();
	const [hoveredName, setHoveredName] = useState(null);
	const hoveredNameRef = useRef(null);
	const tooltipRef = useRef(null);
	const [territorySetup, setTerritorySetup] = useState(null);
	const palette = getCountryColorPalette(context.colorblindMode);

	// Load territory setup once
	useEffect(() => {
		async function load() {
			if (!gameState || !gameState.setup) return;
			let setup = await readSetup(gameState.setup + '/territories');
			setTerritorySetup(setup);
		}
		load();
	}, [gameState && gameState.setup]); // eslint-disable-line react-hooks/exhaustive-deps

	// rAF poll loop — reads hoverSignal, does hit-test, updates tooltip position
	useEffect(() => {
		let rafId;
		function poll() {
			rafId = requestAnimationFrame(poll);

			if (!hoverSignal.active || hoverSignal.dragging) {
				if (hoveredNameRef.current) {
					hoveredNameRef.current = null;
					setHoveredName(null);
				}
				if (tooltipRef.current) {
					tooltipRef.current.style.display = 'none';
				}
				return;
			}

			// Find the canvas element to convert coords
			let canvas = document.querySelector('.imp-canvas');
			if (!canvas) return;

			let canvasRect = canvas.getBoundingClientRect();
			let pctX = ((hoverSignal.clientX - canvasRect.left) / canvasRect.width) * 100;
			let pctY = ((hoverSignal.clientY - canvasRect.top) / canvasRect.height) * 100;

			// Suppress hover when over the rondel SVG
			let rondel = document.querySelector('.imp-rondel-svg');
			let overRondel = false;
			if (rondel) {
				let rr = rondel.getBoundingClientRect();
				overRondel =
					hoverSignal.clientX >= rr.left &&
					hoverSignal.clientX <= rr.right &&
					hoverSignal.clientY >= rr.top &&
					hoverSignal.clientY <= rr.bottom;
			}

			let name = overRondel ? null : hitTest(pctX, pctY);

			if (name !== hoveredNameRef.current) {
				hoveredNameRef.current = name;
				setHoveredName(name);
			}

			// Update tooltip position directly via DOM (no React re-render)
			if (tooltipRef.current) {
				if (name) {
					let viewport = document.querySelector('.imp-viewport__map');
					let vpRect = viewport ? viewport.getBoundingClientRect() : { left: 0, top: 0, width: 9999, height: 9999 };
					let tipX = hoverSignal.clientX - vpRect.left + 16;
					let tipY = hoverSignal.clientY - vpRect.top - 10;
					// Keep tooltip within viewport bounds
					let tip = tooltipRef.current;
					let tipW = tip.offsetWidth || 150;
					let tipH = tip.offsetHeight || 40;
					if (tipX + tipW > vpRect.width - 8) tipX = hoverSignal.clientX - vpRect.left - tipW - 8;
					if (tipY + tipH > vpRect.height - 8) tipY = vpRect.height - tipH - 8;
					if (tipY < 4) tipY = 4;
					tip.style.left = tipX + 'px';
					tip.style.top = tipY + 'px';
					tip.style.display = '';
				} else {
					tooltipRef.current.style.display = 'none';
				}
			}
		}
		rafId = requestAnimationFrame(poll);
		return () => cancelAnimationFrame(rafId);
	}, []);

	if (!gameState) return null;

	let countryInfo = gameState.countryInfo || {};
	let countries = Object.keys(countryInfo);
	let name = hoveredName;

	if (!name) {
		return <div ref={tooltipRef} className="imp-territory-hover" style={{ display: 'none' }} />;
	}

	let setup = territorySetup && territorySetup[name];
	let ownerCountry = setup && setup.country;
	let isSea = setup && setup.sea;
	let isPort = setup && setup.port;

	// Find units in this territory
	let units = [];
	for (let country of countries) {
		let ci = countryInfo[country];
		if (!ci) continue;
		let fleets = ci.fleets || [];
		let armies = ci.armies || [];
		for (let f of fleets) {
			if (f.territory === name) units.push({ type: 'Fleet', country });
		}
		for (let a of armies) {
			if (a.territory === name) {
				let hostile = a.hostile === undefined || a.hostile === '' || a.hostile;
				units.push({ type: 'Army', country, hostile });
			}
		}
	}

	// Check for factory
	let factory = null;
	for (let country of countries) {
		let ci = countryInfo[country];
		if (!ci || !ci.factories) continue;
		if (ci.factories.includes(name)) {
			factory = country;
			break;
		}
	}

	// Check for tax chip
	let taxChip = null;
	for (let country of countries) {
		let ci = countryInfo[country];
		if (!ci || !ci.taxChips) continue;
		if (ci.taxChips.includes(name)) {
			taxChip = country;
			break;
		}
	}

	let ownerColor = ownerCountry ? palette.bright[ownerCountry] || '#888' : null;
	if (ownerColor === '#000000') ownerColor = '#8c8c8c';

	return (
		<div ref={tooltipRef} className="imp-territory-hover">
			<div className="imp-territory-hover__name">
				{ownerColor && <span className="imp-territory-hover__dot" style={{ backgroundColor: ownerColor }} />}
				{name}
				{isSea && <span className="imp-territory-hover__tag">Sea</span>}
				{isPort && !isSea && <span className="imp-territory-hover__tag">Port</span>}
			</div>
			{ownerCountry && (
				<div className="imp-territory-hover__row" style={{ color: ownerColor }}>
					{ownerCountry}
				</div>
			)}
			{factory && <div className="imp-territory-hover__row">Factory ({factory})</div>}
			{taxChip && <div className="imp-territory-hover__row">Tax chip ({taxChip})</div>}
			{units.length > 0 && (
				<div className="imp-territory-hover__units">
					{units.map((u, i) => {
						let c = palette.bright[u.country] || '#888';
						if (c === '#000000') c = '#8c8c8c';
						return (
							<div key={i} className="imp-territory-hover__row">
								<span className="imp-territory-hover__dot" style={{ backgroundColor: c }} />
								{u.type}
								{u.type === 'Army' && !u.hostile ? ' (peaceful)' : ''}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

export default TerritoryHoverLayer;
