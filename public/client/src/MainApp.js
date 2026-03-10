import React from 'react';
import './App.css';
import TurnApp from './TurnApp.js';
import FloatingPlayerPanel from './FloatingPlayerPanel.js';
import MapApp from './MapApp.js';
import MapViewport from './MapViewport.js';

function MainApp() {
	return (
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
	);
}

export default MainApp;
