import React from 'react';
import TerritoryHotspot from './TerritoryHotspot.js';
import './MapOverlay.css';

function toPointsString(vertices) {
	let parts = [];
	for (let i = 0; i < vertices.length; i++) {
		parts.push(vertices[i][0] + ',' + vertices[i][1]);
	}
	return parts.join(' ');
}

function TerritoryBoundaryLayer({
	territories,
	boundaries,
	selectableItems,
	selectedItem,
	highlightColor,
	highlightedTerritories,
	onRightClick,
	onItemSelected,
}) {
	if (!territories || !boundaries) {
		return null;
	}

	let selectableSet = {};
	if (selectableItems) {
		for (let i = 0; i < selectableItems.length; i++) {
			selectableSet[selectableItems[i]] = true;
		}
	}

	let highlights = highlightedTerritories || {};

	let polygons = [];
	let fallbackHotspots = [];

	let allNames = Object.keys(territories);
	for (let i = 0; i < allNames.length; i++) {
		let name = allNames[i];
		let territory = territories[name];
		let verts = boundaries[name];
		let isSelectable = !!selectableSet[name];
		let isSelected = selectedItem === name;
		let isHighlighted = !!highlights[name];

		// Only render if the territory has some visual relevance
		if (!isSelectable && !isSelected && !isHighlighted) {
			continue;
		}

		// If no boundary data, fall back to point hotspot
		if (!verts || verts.length === 0) {
			if (territory.unitCoords && (isSelectable || isSelected)) {
				fallbackHotspots.push(
					<TerritoryHotspot
						key={name}
						name={name}
						coords={territory.unitCoords}
						isClickable={isSelectable}
						isSelected={isSelected}
						highlightColor={isHighlighted ? highlights[name] : highlightColor}
						onClick={onItemSelected}
					/>
				);
			}
			continue;
		}

		// Determine class and colors
		let className = 'imp-boundary';
		let fill = 'transparent';
		let stroke = 'transparent';

		if (isSelected) {
			className += ' imp-boundary--selected';
			fill = highlightColor;
			stroke = highlightColor;
		} else if (isSelectable) {
			className += ' imp-boundary--selectable';
			fill = highlightColor;
			stroke = highlightColor;
		} else if (isHighlighted) {
			className += ' imp-boundary--highlighted';
			fill = highlights[name];
			stroke = highlights[name];
		}

		polygons.push(
			<polygon
				key={name}
				className={className}
				data-territory={name}
				points={toPointsString(verts)}
				fill={fill}
				stroke={stroke}
				role={isSelectable ? 'button' : undefined}
				aria-label={isSelectable ? 'Select territory ' + name : undefined}
				onClick={
					isSelectable
						? (e) => {
								e.stopPropagation();
								onItemSelected(name, e);
						  }
						: undefined
				}
				onContextMenu={
					onRightClick && (isSelectable || isHighlighted)
						? (e) => {
								e.preventDefault();
								e.stopPropagation();
								onRightClick(name, e);
						  }
						: undefined
				}
			/>
		);
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
			</svg>
			{fallbackHotspots}
		</React.Fragment>
	);
}

export default TerritoryBoundaryLayer;
