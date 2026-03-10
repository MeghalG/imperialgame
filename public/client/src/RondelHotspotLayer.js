import React, { useContext } from 'react';
import MapInteractionContext from './MapInteractionContext.js';
import './MapOverlay.css';

/**
 * Renders clickable hotspot rings over each rondel action on the wheel.
 * Uses allWheelCoords (all 8 positions) so every action is clickable,
 * not just ones that currently have a country marker.
 *
 * Costs are dynamic — passed through MapInteractionContext.selectableCosts
 * which maps action names to cost strings based on the country's current
 * wheel position, NOT static per-action labels.
 *
 * Coordinates from Firebase are percentage strings (e.g. "11%", "4%"),
 * so we position using those directly with a calc() offset to center.
 */
function RondelHotspotLayer({ rondelData, allWheelCoords }) {
	const mapInteraction = useContext(MapInteractionContext);

	if (!allWheelCoords || mapInteraction.interactionMode !== 'select-rondel') {
		return null;
	}

	let dynamicCosts = mapInteraction.selectableCosts || {};

	let hotspots = [];
	for (let actionName in allWheelCoords) {
		let coords = allWheelCoords[actionName];
		if (!coords) continue;

		let isClickable = mapInteraction.selectableItems.includes(actionName);
		let isSelected = mapInteraction.selectedItem === actionName;

		let className = 'imp-hotspot imp-hotspot--rondel';
		if (isSelected) {
			className += ' imp-hotspot--selected';
		} else if (isClickable) {
			className += ' imp-hotspot--selectable';
		} else {
			className += ' imp-hotspot--idle';
		}

		// Use dynamic cost from context (based on distance from current position)
		let cost = dynamicCosts[actionName] || '';

		hotspots.push(
			<div key={actionName}>
				<div
					className={className}
					onClick={(e) => {
						if (isClickable) {
							e.stopPropagation();
							mapInteraction.onItemSelected(actionName);
						}
					}}
					style={{
						left: 'calc(' + coords.x + ' - 16px)',
						top: 'calc(' + coords.y + ' - 16px)',
						color: mapInteraction.highlightColor,
					}}
					title={isClickable ? actionName : undefined}
				/>
				{cost && isClickable && (
					<span
						className="imp-rondel-cost"
						style={{
							left: 'calc(' + coords.x + ' + 18px)',
							top: 'calc(' + coords.y + ' - 6px)',
						}}
					>
						{cost}
					</span>
				)}
			</div>
		);
	}

	return <React.Fragment>{hotspots}</React.Fragment>;
}

export default RondelHotspotLayer;
