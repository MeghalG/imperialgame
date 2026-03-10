import React, { useState, useRef, useCallback } from 'react';
import './MapOverlay.css';

function MapViewport({ children, overlays }) {
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const dragStartRef = useRef({ x: 0, y: 0 });
	const panStartRef = useRef({ x: 0, y: 0 });
	const viewportRef = useRef(null);
	const didDragRef = useRef(false);

	const handleWheel = useCallback(
		(e) => {
			e.preventDefault();
			const delta = e.deltaY > 0 ? 0.92 : 1.08;
			const newZoom = Math.min(3, Math.max(0.4, zoom * delta));
			const rect = viewportRef.current.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;
			const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
			const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
			setZoom(newZoom);
			setPan({ x: newPanX, y: newPanY });
		},
		[zoom, pan]
	);

	const handleMouseDown = useCallback(
		(e) => {
			if (e.target.closest('.imp-panel') || e.target.closest('.imp-vp-track')) {
				return;
			}
			if (e.button === 0) {
				setIsDragging(true);
				didDragRef.current = false;
				dragStartRef.current = { x: e.clientX, y: e.clientY };
				panStartRef.current = { x: pan.x, y: pan.y };
			}
		},
		[pan]
	);

	const handleMouseMove = useCallback(
		(e) => {
			if (!isDragging) return;
			const dx = e.clientX - dragStartRef.current.x;
			const dy = e.clientY - dragStartRef.current.y;
			if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
				didDragRef.current = true;
			}
			setPan({
				x: panStartRef.current.x + dx,
				y: panStartRef.current.y + dy,
			});
		},
		[isDragging]
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	const handleMouseLeave = useCallback(() => {
		setIsDragging(false);
	}, []);

	return (
		<div
			ref={viewportRef}
			className={'imp-viewport' + (isDragging ? ' imp-viewport--dragging' : '')}
			onWheel={handleWheel}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseLeave}
		>
			<div
				className="imp-canvas"
				style={{
					transform: 'translate(' + pan.x + 'px, ' + pan.y + 'px) scale(' + zoom + ')',
				}}
			>
				{children}
			</div>
			<div id="imp-vp-track-portal" />
			{overlays}
		</div>
	);
}

export function useDidDrag() {
	return false;
}

export default MapViewport;
