import React from 'react';
import './MapOverlay.css';

function TerritoryHotspot({ name, coords, isClickable, isSelected, highlightColor, onClick, cost }) {
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
			role={isClickable ? 'button' : undefined}
			aria-label={isClickable ? 'Select territory ' + name + (cost ? ' ' + cost : '') : undefined}
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
		>
			{(isClickable || isSelected) && (
				<span className="imp-hotspot__label">
					{name}
					{cost && <span className="imp-hotspot__cost">{cost}</span>}
				</span>
			)}
		</div>
	);
}

export default TerritoryHotspot;
