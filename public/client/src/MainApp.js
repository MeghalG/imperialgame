import React from 'react';
import './App.css';
import MapApp from './MapApp.js';
import MapViewport from './MapViewport.js';
import ManeuverPlanProvider from './ManeuverPlanProvider.js';
import Sidebar from './Sidebar.js';
import PlayersColumn from './PlayersColumn.js';
import FloatingSubmit from './FloatingSubmit.js';

/**
 * Three-column game layout (per panel-rework design 2026-04-16):
 *   Map (dominant, with floating submit FAB overlaid) → Players column
 *   (always on) → Tabs column (Countries default; Turn during maneuver).
 *
 * FloatingSubmit mounts via MapViewport's overlay prop so it stays pinned
 * to the viewport corner regardless of map pan/zoom. Narrow-screen drawer
 * handling is Sidebar's responsibility; PlayersColumn currently hides
 * below ~900px via CSS (see MapOverlay.css).
 */
function MainApp() {
	return (
		<ManeuverPlanProvider>
			<div className="imp-game-layout">
				<MapViewport overlay={<FloatingSubmit />}>
					<MapApp />
				</MapViewport>
				<PlayersColumn />
				<Sidebar />
			</div>
		</ManeuverPlanProvider>
	);
}

export default MainApp;
