import React from 'react';
import ManeuverPlanList from './ManeuverPlanList.js';

/**
 * Maneuver planning UI — thin wrapper.
 * State lives in ManeuverPlanProvider (context).
 * Plan list renders here in the turn panel.
 * Action picker and FAB render on the map (via MapApp.js).
 */
function ManeuverPlannerApp() {
	return <ManeuverPlanList />;
}

export default ManeuverPlannerApp;
