/**
 * Shared mutable signal for map hover coordinates.
 * MapViewport writes to this on every mousemove (same handler as drag/pan).
 * TerritoryHoverLayer reads from it via requestAnimationFrame polling.
 * Using a plain mutable object avoids React re-renders from mousemove.
 */
const hoverSignal = {
	clientX: 0,
	clientY: 0,
	active: false,
	dragging: false,
	rightClick: false, // set true on contextmenu, consumed by TerritoryHoverLayer
};

export default hoverSignal;
