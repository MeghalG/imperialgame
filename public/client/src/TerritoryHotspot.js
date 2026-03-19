import React from 'react';
import './MapOverlay.css';

function TerritoryHotspot({ name, coords, isClickable, isSelected, highlightColor, onClick }) {
	if (!coords) return null;

	let className = 'imp-hotspot';
	if (isSelected) {
		className += ' imp-hotspot--selected';
	} else if (isClickable) {
		className += ' imp-hotspot--selectable';
	} else {
		className += ' imp-hotspot--idle';
	}

	return (
		<div
			className={className}
			data-territory={name}
			role={isClickable ? 'button' : undefined}
			aria-label={isClickable ? 'Select territory ' + name : undefined}
			onClick={(e) => {
				if (isClickable) {
					e.stopPropagation();
					onClick(name, e);
				}
			}}
			style={{
				left: 'calc(' + coords[0] + ' - 28px)',
				top: 'calc(' + coords[1] + ' - 20px)',
				backgroundColor: isClickable || isSelected ? highlightColor : 'transparent',
				color: highlightColor,
			}}
			title={isClickable ? name : undefined}
		></div>
	);
}

export default TerritoryHotspot;
