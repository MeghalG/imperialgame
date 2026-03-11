import React from 'react';
import './App.css';
import TurnApp from './TurnApp.js';
import FloatingPlayerPanel from './FloatingPlayerPanel.js';
import MapApp from './MapApp.js';
import MapViewport from './MapViewport.js';
function MainApp() {
	return (
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
	);
}

export default MainApp;
