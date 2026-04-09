import { useEffect, useRef, useContext } from 'react';
import MapInteractionContext from './MapInteractionContext.js';

/**
 * useMapTerritorySelect — shared hook for map territory/rondel interaction.
 *
 *   Component                 MapInteractionContext
 *   ─────────                 ─────────────────────
 *   items, color, onSelect ──▶ setInteraction(mode, items, color, callback)
 *   unmount ──────────────────▶ clearInteraction()
 *   items/color change ───────▶ re-call setInteraction()
 *
 * For rondel interactions (mapMode === 'select-rondel'), uses a separate
 * rondel-specific channel so rondel stays clickable even when a territory
 * selection is also active.
 *
 * @param {string|null} mapMode - Interaction mode ('select-territory', 'select-rondel'), or null to skip
 * @param {string[]} items - Selectable item names (territory or rondel positions)
 * @param {string} color - Highlight color for selectable items
 * @param {Function} onSelect - Callback(name, event) when an item is left-clicked on the map
 * @param {Object|null} [costs] - Optional { itemName: costLabel } map for display
 * @param {Object|null} [highlights] - Optional { territoryName: color } for passive highlights
 * @param {Function|null} [onRightClick] - Optional callback(name, event) when an item is right-clicked
 */
function useMapTerritorySelect(mapMode, items, color, onSelect, costs, highlights, onRightClick) {
	const mapInteraction = useContext(MapInteractionContext);
	const onSelectRef = useRef(onSelect);
	onSelectRef.current = onSelect;
	const onRightClickRef = useRef(onRightClick);
	onRightClickRef.current = onRightClick;
	const mapModeRef = useRef(mapMode);
	mapModeRef.current = mapMode;

	useEffect(() => {
		if (!mapMode || !items || items.length === 0) return;

		let callback = (name, event) => {
			if (onSelectRef.current) onSelectRef.current(name, event);
		};

		if (mapMode === 'select-rondel') {
			mapInteraction.setRondelInteraction(items, callback, costs != null ? costs : null);
			return () => {
				mapInteraction.clearRondelInteraction();
			};
		}

		mapInteraction.setInteraction(
			mapMode,
			items,
			color || '#c9a84c',
			callback,
			highlights || null,
			costs != null ? costs : null
		);

		if (onRightClickRef.current) {
			mapInteraction.setOnItemRightClickedCb(() => (name, event) => {
				if (onRightClickRef.current) onRightClickRef.current(name, event);
			});
		}

		return () => {
			if (mapInteraction.interactionMode === mapModeRef.current) {
				mapInteraction.clearInteraction();
			}
			if (onRightClickRef.current) {
				mapInteraction.setOnItemRightClickedCb(null);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mapMode, items, color, highlights]);
}

export default useMapTerritorySelect;
