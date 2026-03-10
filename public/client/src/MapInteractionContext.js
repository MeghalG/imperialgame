import React from 'react';

const MapInteractionContext = React.createContext({
	interactionMode: null, // null | 'select-territory' | 'select-rondel'
	selectableItems: [], // territory or rondel position names that are clickable
	selectableCosts: {}, // { itemName: '($2)' } dynamic cost labels per selectable item
	selectedItem: null, // what was last clicked
	highlightColor: '#c9a84c', // color for highlighting selectable items
	onItemSelected: () => {}, // callback when an item is clicked
	highlightedTerritories: {}, // { territoryName: color } for passive highlights
	setInteraction: () => {}, // set interaction state (mode, items, color, callback, highlights, costs)
	clearInteraction: () => {}, // reset to idle
	plannedMoves: [], // [{ origin, dest, color }] for movement arrows
	setPlannedMoves: () => {}, // update planned moves
	unitMarkers: [], // [{ territoryName, unitType, phase, index, isActive, isPlanned, color }]
	setUnitMarkers: () => {}, // update unit markers
	onUnitMarkerClicked: () => {}, // callback (phase, index) when a unit marker is clicked
});

export default MapInteractionContext;
