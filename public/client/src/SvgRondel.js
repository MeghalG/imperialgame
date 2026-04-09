import React, { useContext } from 'react';
import MapInteractionContext from './MapInteractionContext.js';
import UserContext from './UserContext.js';
import { getCountryColorPalette } from './countryColors.js';
import './MapOverlay.css';

const DEFAULT_WHEEL_ORDER = [
	'Taxation',
	'Factory',
	'R-Produce',
	'R-Maneuver',
	'Investor',
	'Import',
	'L-Produce',
	'L-Maneuver',
];

const WHEEL_LABELS = {
	Factory: 'Factory',
	'L-Produce': 'Produce',
	'L-Maneuver': 'Maneuver',
	Taxation: 'Tax',
	'R-Produce': 'Produce',
	Investor: 'Investor',
	Import: 'Import',
	'R-Maneuver': 'Maneuver',
};

const COUNTRY_ABBREV = {
	Austria: 'AT',
	Italy: 'IT',
	France: 'FR',
	England: 'EN',
	Germany: 'DE',
	Russia: 'RU',
};

// Colors matching the original Imperial board game rondel
const WEDGE_FILLS = {
	Factory: '#1a3a6e', // blue
	'L-Produce': '#1a1a1a', // black
	'L-Maneuver': '#1a5c2a', // green
	Taxation: '#8a7a18', // yellow
	'R-Produce': '#1a1a1a', // black
	Investor: '#3a7a9e', // light blue
	Import: '#8b1a1a', // red
	'R-Maneuver': '#1a5c2a', // green
};

const CX = 50;
const CY = 50;
const OUTER_R = 46;
const INNER_R = 15;
const LABEL_R = 32;

function wedgePath(index) {
	let startDeg = index * 45 - 90;
	let endDeg = (index + 1) * 45 - 90;
	let startAngle = (startDeg * Math.PI) / 180;
	let endAngle = (endDeg * Math.PI) / 180;

	let ox1 = CX + OUTER_R * Math.cos(startAngle);
	let oy1 = CY + OUTER_R * Math.sin(startAngle);
	let ox2 = CX + OUTER_R * Math.cos(endAngle);
	let oy2 = CY + OUTER_R * Math.sin(endAngle);
	let ix2 = CX + INNER_R * Math.cos(endAngle);
	let iy2 = CY + INNER_R * Math.sin(endAngle);
	let ix1 = CX + INNER_R * Math.cos(startAngle);
	let iy1 = CY + INNER_R * Math.sin(startAngle);

	return (
		'M ' +
		ox1.toFixed(2) +
		' ' +
		oy1.toFixed(2) +
		' A ' +
		OUTER_R +
		' ' +
		OUTER_R +
		' 0 0 1 ' +
		ox2.toFixed(2) +
		' ' +
		oy2.toFixed(2) +
		' L ' +
		ix2.toFixed(2) +
		' ' +
		iy2.toFixed(2) +
		' A ' +
		INNER_R +
		' ' +
		INNER_R +
		' 0 0 0 ' +
		ix1.toFixed(2) +
		' ' +
		iy1.toFixed(2) +
		' Z'
	);
}

function labelPos(index) {
	let midDeg = (index + 0.5) * 45 - 90;
	let angle = (midDeg * Math.PI) / 180;
	return {
		x: CX + LABEL_R * Math.cos(angle),
		y: CY + LABEL_R * Math.sin(angle),
		deg: midDeg + 90,
	};
}

function SvgRondel({ rondelData, colorblindMode, wheelOrder }) {
	const mapInteraction = useContext(MapInteractionContext);
	const userContext = useContext(UserContext);

	// Use rondel-specific interaction channel
	let rondelItems = mapInteraction.rondelSelectableItems || [];
	let isRondelInteractive = rondelItems.length > 0;
	let rondelSelected = mapInteraction.rondelSelectedItem;
	let dynamicCosts = mapInteraction.rondelCosts || {};

	let order = wheelOrder || DEFAULT_WHEEL_ORDER;

	// Find the current country's wedge position
	let currentCountry = userContext.country;
	let currentWedge = null;
	if (currentCountry && rondelData) {
		for (let actionName in rondelData) {
			let countriesAtPos = rondelData[actionName] && rondelData[actionName][1];
			if (countriesAtPos && countriesAtPos.includes(currentCountry)) {
				currentWedge = actionName;
				break;
			}
		}
	}

	let palette = getCountryColorPalette(colorblindMode);
	let currentCountryColor = currentCountry ? palette.bright[currentCountry] || '#c9a84c' : '#c9a84c';
	if (currentCountryColor === '#000000') currentCountryColor = '#8c8c8c';

	function renderMarkers() {
		if (!rondelData) return null;
		let markers = [];

		for (let actionName in rondelData) {
			let index = order.indexOf(actionName);
			if (index < 0) continue;
			let countriesAtPos = rondelData[actionName][1];
			if (!countriesAtPos || countriesAtPos.length === 0) continue;

			// Place country badges along the outer edge of the wedge
			let midDeg = (index + 0.5) * 45 - 90;
			let baseAngle = (midDeg * Math.PI) / 180;
			let badgeR = OUTER_R - 5;

			countriesAtPos.forEach((country, j) => {
				let spread = countriesAtPos.length > 1 ? 0.22 : 0;
				let offsetAngle = baseAngle + (j - (countriesAtPos.length - 1) / 2) * spread;
				let bx = CX + badgeR * Math.cos(offsetAngle);
				let by = CY + badgeR * Math.sin(offsetAngle);
				let color = palette.bright[country] || '#888';
				if (color === '#000000') color = '#8c8c8c';
				let abbrev = COUNTRY_ABBREV[country] || country.slice(0, 2).toUpperCase();

				// Compute rotation so text is readable
				let textDeg = midDeg + 90;
				if (textDeg > 90 && textDeg < 270) {
					textDeg += 180;
				}

				markers.push(
					<g key={'marker-' + country}>
						{/* Badge background */}
						<rect
							x={bx - 4.5}
							y={by - 3}
							width={9}
							height={6}
							rx={1.5}
							fill={color}
							stroke="#000"
							strokeWidth={0.4}
							transform={'rotate(' + textDeg + ', ' + bx + ', ' + by + ')'}
						/>
						{/* Country abbreviation */}
						<text
							x={bx}
							y={by}
							textAnchor="middle"
							dominantBaseline="central"
							className="imp-rondel-marker-text"
							transform={'rotate(' + textDeg + ', ' + bx + ', ' + by + ')'}
						>
							{abbrev}
						</text>
					</g>
				);
			});
		}
		return markers;
	}

	return (
		<svg
			viewBox="0 0 100 100"
			className="imp-rondel-svg"
			style={{
				position: 'absolute',
				left: '2%',
				top: '3%',
				width: '17.5%',
				height: '23%',
			}}
		>
			<defs>
				<radialGradient id="imp-rondel-center-grad" cx="45%" cy="40%">
					<stop offset="0%" stopColor="#2a2b30" />
					<stop offset="100%" stopColor="#0e0f12" />
				</radialGradient>
				<filter id="imp-rondel-glow">
					<feGaussianBlur in="SourceGraphic" stdDeviation="0.6" />
				</filter>
			</defs>

			{/* Outer ring glow */}
			<circle cx={CX} cy={CY} r={OUTER_R + 0.8} fill="none" stroke="rgba(201,168,76,0.12)" strokeWidth={1.5} />

			{order.map((action, i) => {
				let isClickable = isRondelInteractive && rondelItems.includes(action);
				let isSelected = isRondelInteractive && rondelSelected === action;
				let isCurrent = currentWedge === action;
				let cost = dynamicCosts[action];

				// Check if any countries are on this wedge
				let hasCountries =
					rondelData && rondelData[action] && rondelData[action][1] && rondelData[action][1].length > 0;

				let baseFill = WEDGE_FILLS[action] || '#2a2520';
				let fillColor = baseFill;
				if (isSelected) fillColor = '#4a3d1a';
				else if (isClickable) fillColor = baseFill;

				let lp = labelPos(i);
				let textRotation = lp.deg;
				if (textRotation > 90 && textRotation < 270) {
					textRotation += 180;
				}

				return (
					<g key={action}>
						{/* Current position glow ring (behind the wedge) */}
						{isCurrent && (
							<path
								d={wedgePath(i)}
								fill="none"
								stroke={currentCountryColor}
								strokeWidth={2}
								className="imp-rondel-wedge--current-glow"
								style={{ pointerEvents: 'none' }}
							/>
						)}
						<path
							d={wedgePath(i)}
							fill={fillColor}
							stroke={isCurrent ? currentCountryColor : 'rgba(201,168,76,0.25)'}
							strokeWidth={isCurrent ? 1.2 : 0.4}
							className={
								'imp-rondel-wedge' +
								(isSelected
									? ' imp-rondel-wedge--selected'
									: isClickable
									? ' imp-rondel-wedge--selectable'
									: isCurrent
									? ' imp-rondel-wedge--current'
									: hasCountries
									? ' imp-rondel-wedge--occupied'
									: '')
							}
							onClick={(e) => {
								if (isClickable) {
									e.stopPropagation();
									mapInteraction.onRondelItemSelected(action);
								}
							}}
							style={{ cursor: isClickable ? 'pointer' : 'default' }}
						/>
						<text
							x={lp.x}
							y={lp.y}
							textAnchor="middle"
							dominantBaseline="central"
							className="imp-rondel-label"
							style={{
								fill: isSelected
									? '#e8c85a'
									: isCurrent
									? '#ffffff'
									: isClickable
									? 'rgba(255,255,255,0.92)'
									: 'rgba(255,255,255,0.6)',
								pointerEvents: 'none',
								fontWeight: isSelected || isClickable || isCurrent ? 700 : 600,
							}}
							transform={'rotate(' + textRotation + ', ' + lp.x + ', ' + lp.y + ')'}
						>
							{WHEEL_LABELS[action]}
						</text>
						{cost && isClickable && (
							<text
								x={lp.x}
								y={lp.y + 5}
								textAnchor="middle"
								dominantBaseline="central"
								className="imp-rondel-cost-label"
								style={{ pointerEvents: 'none' }}
								transform={'rotate(' + textRotation + ', ' + lp.x + ', ' + (lp.y + 5) + ')'}
							>
								{cost}
							</text>
						)}
					</g>
				);
			})}

			{/* Inner circle — polished center hub */}
			<circle
				cx={CX}
				cy={CY}
				r={INNER_R}
				fill="url(#imp-rondel-center-grad)"
				stroke="rgba(201,168,76,0.3)"
				strokeWidth={0.6}
			/>
			<circle cx={CX} cy={CY} r={INNER_R - 2} fill="none" stroke="rgba(201,168,76,0.1)" strokeWidth={0.3} />

			{renderMarkers()}
		</svg>
	);
}

export default SvgRondel;
