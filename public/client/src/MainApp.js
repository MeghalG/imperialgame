import React from 'react';
import './App.css';
import MapApp from './MapApp.js';
import MapViewport from './MapViewport.js';
import ManeuverPlanProvider from './ManeuverPlanProvider.js';
import Sidebar from './Sidebar.js';
function MainApp() {
	return (
		<ManeuverPlanProvider>
			<div className="imp-game-layout">
				<MapViewport>
					<MapApp />
				</MapViewport>
				<Sidebar />
			</div>
		</ManeuverPlanProvider>
	);
}

export default MainApp;
