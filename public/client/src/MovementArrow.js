import React from 'react';
import './MapOverlay.css';

function MovementArrow({ fromCoords, toCoords, color }) {
	if (!fromCoords || !toCoords) return null;

	let x1 = parseFloat(fromCoords[0]);
	let y1 = parseFloat(fromCoords[1]);
	let x2 = parseFloat(toCoords[0]);
	let y2 = parseFloat(toCoords[1]);

	let dx = x2 - x1;
	let dy = y2 - y1;
	let length = Math.sqrt(dx * dx + dy * dy);
	let angle = Math.atan2(dy, dx) * (180 / Math.PI);

	return (
		<div
			className="imp-arrow"
			style={{
				left: x1,
				top: y1,
				width: length,
				transform: 'rotate(' + angle + 'deg)',
				backgroundColor: color || 'rgba(255,255,255,0.5)',
				color: color || 'rgba(255,255,255,0.5)',
			}}
		/>
	);
}

export default MovementArrow;
