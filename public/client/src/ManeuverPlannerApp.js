import React, { useState, useEffect } from 'react';
import ManeuverPlanList from './ManeuverPlanList.js';
import BottomSheet from './BottomSheet.js';

/**
 * Maneuver planning UI — thin wrapper.
 * State lives in ManeuverPlanProvider (context), which wraps the
 * entire game layout in MainApp.js so that both this component
 * and the map-level components (FAB, ActionPicker) share the same
 * provider instance.
 */
function ManeuverPlannerApp() {
	const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

	useEffect(() => {
		const handler = () => setIsMobile(window.innerWidth < 768);
		window.addEventListener('resize', handler);
		return () => window.removeEventListener('resize', handler);
	}, []);

	if (isMobile) {
		return (
			<BottomSheet
				peekContent={<span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Maneuver Plan &#9650;</span>}
			>
				<ManeuverPlanList />
			</BottomSheet>
		);
	}

	return <ManeuverPlanList />;
}

export default ManeuverPlannerApp;
