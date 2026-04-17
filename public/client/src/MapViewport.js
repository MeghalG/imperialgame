import React, { useState, useRef, useCallback, useEffect } from 'react';
import hoverSignal from './hoverSignal.js';
import './MapOverlay.css';

/**
 * Clamp pan so the map edges can't pull past the viewport edges.
 * canvasW/canvasH are the natural (unscaled) size of the map content.
 */
function clampPan(panX, panY, zoom, vw, vh, canvasW, canvasH) {
	let scaledW = canvasW * zoom;
	let scaledH = canvasH * zoom;
	// If scaled map is smaller than viewport, center it
	let minX = scaledW <= vw ? (vw - scaledW) / 2 : vw - scaledW;
	let maxX = scaledW <= vw ? (vw - scaledW) / 2 : 0;
	let minY = scaledH <= vh ? (vh - scaledH) / 2 : vh - scaledH;
	let maxY = scaledH <= vh ? (vh - scaledH) / 2 : 0;
	return {
		x: Math.min(maxX, Math.max(minX, panX)),
		y: Math.min(maxY, Math.max(minY, panY)),
	};
}

function MapViewport({ children, overlay }) {
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const dragStartRef = useRef({ x: 0, y: 0 });
	const panStartRef = useRef({ x: 0, y: 0 });
	const viewportRef = useRef(null);
	const canvasRef = useRef(null);
	const didDragRef = useRef(false);

	function getDimensions() {
		let vw = 0,
			vh = 0,
			cw = 0,
			ch = 0;
		if (viewportRef.current) {
			let r = viewportRef.current.getBoundingClientRect();
			vw = r.width;
			vh = r.height;
		}
		if (canvasRef.current) {
			// clientWidth/Height ignore overflow from absolutely-positioned
			// children (hotspots, unit markers, FABs). Using scrollWidth/Height
			// here makes centering drift as more overlays render in.
			cw = canvasRef.current.clientWidth;
			ch = canvasRef.current.clientHeight;
		}
		return { vw, vh, cw, ch };
	}

	// Center map once content has real dimensions, and re-center on resize
	useEffect(() => {
		function recenter() {
			let { vw, vh, cw, ch } = getDimensions();
			if (cw > 0 && ch > 0) {
				setPan((prev) => clampPan(prev.x, prev.y, 1, vw, vh, cw, ch));
			}
		}

		let observers = [];

		// Watch viewport for resize (e.g. window resize, sidebar toggle)
		if (viewportRef.current) {
			let vpObs = new ResizeObserver(recenter);
			vpObs.observe(viewportRef.current);
			observers.push(vpObs);
		}

		// Watch canvas for resize (triggers when the image inside loads and gets dimensions)
		if (canvasRef.current) {
			let cvObs = new ResizeObserver(recenter);
			cvObs.observe(canvasRef.current);
			observers.push(cvObs);
		}

		return () => {
			observers.forEach((obs) => obs.disconnect());
		};
	}, []);

	const handleWheel = useCallback(
		(e) => {
			e.preventDefault();
			const delta = e.deltaY > 0 ? 0.92 : 1.08;
			const newZoom = Math.min(3, Math.max(1, zoom * delta));
			const rect = viewportRef.current.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;
			const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
			const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
			let { vw, vh, cw, ch } = getDimensions();
			const clamped = clampPan(newPanX, newPanY, newZoom, vw, vh, cw, ch);
			setZoom(newZoom);
			setPan(clamped);
		},
		[zoom, pan]
	);

	const handleMouseDown = useCallback(
		(e) => {
			if (e.target.closest('.imp-panel') || e.target.closest('.imp-vp-track')) {
				return;
			}
			if (e.button === 0 && zoom > 1) {
				setIsDragging(true);
				hoverSignal.dragging = true;
				didDragRef.current = false;
				dragStartRef.current = { x: e.clientX, y: e.clientY };
				panStartRef.current = { x: pan.x, y: pan.y };
			}
		},
		[pan, zoom]
	);

	const handleMouseMove = useCallback(
		(e) => {
			// Always update hover signal so TerritoryHoverLayer can read it
			hoverSignal.clientX = e.clientX;
			hoverSignal.clientY = e.clientY;
			hoverSignal.active = true;

			if (!isDragging) return;
			const dx = e.clientX - dragStartRef.current.x;
			const dy = e.clientY - dragStartRef.current.y;
			if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
				didDragRef.current = true;
			}
			let { vw, vh, cw, ch } = getDimensions();
			const newPan = clampPan(panStartRef.current.x + dx, panStartRef.current.y + dy, zoom, vw, vh, cw, ch);
			setPan(newPan);
		},
		[isDragging, zoom]
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
		hoverSignal.dragging = false;
	}, []);

	const handleMouseLeave = useCallback(() => {
		setIsDragging(false);
		hoverSignal.active = false;
		hoverSignal.dragging = false;
	}, []);

	let mapClass = 'imp-viewport__map';
	if (isDragging) mapClass += ' imp-viewport__map--dragging';
	else if (zoom > 1) mapClass += ' imp-viewport__map--pannable';

	return (
		<div className="imp-viewport">
			<div
				ref={viewportRef}
				className={mapClass}
				onWheel={handleWheel}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseLeave}
				onContextMenu={(e) => {
					e.preventDefault();
					hoverSignal.clientX = e.clientX;
					hoverSignal.clientY = e.clientY;
					hoverSignal.rightClick = true;
				}}
			>
				<div
					ref={canvasRef}
					className="imp-canvas"
					style={{
						transform: 'translate(' + pan.x + 'px, ' + pan.y + 'px) scale(' + zoom + ')',
					}}
				>
					{children}
				</div>
				{/*
				 * Overlay: rendered as a sibling of the transformed imp-canvas. Content
				 * stays pinned to the viewport regardless of pan/zoom (does NOT inherit
				 * the transform). Used for the FloatingSubmit FAB — see design doc
				 * "Mount strategy (committed)".
				 */}
				{overlay && <div className="imp-viewport__overlay">{overlay}</div>}
			</div>
			<div id="imp-vp-track-portal" className="imp-vp-track-portal" />
		</div>
	);
}

export function useDidDrag() {
	return false;
}

export default MapViewport;
