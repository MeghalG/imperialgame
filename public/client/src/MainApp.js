import React from 'react';
import './App.css';
import TurnApp from './TurnApp.js';
import FloatingPlayerPanel from './FloatingPlayerPanel.js';
import MapApp from './MapApp.js';
import MapViewport from './MapViewport.js';
import ManeuverPlanProvider from './ManeuverPlanProvider.js';
function MainApp() {
	return (
		<ManeuverPlanProvider>
			<div className="imp-game-layout">
				<MapViewport
					overlays={
						<React.Fragment>
							<FloatingPlayerPanel />
							<TurnApp />
						</React.Fragment>
					}
				>
					<MapApp />
				</MapViewport>
			</div>
		</ManeuverPlanProvider>
	);
}

export default MainApp;
