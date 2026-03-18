import React, { useState, useEffect } from 'react';
import ManeuverPlanProvider from './ManeuverPlanProvider.js';
import ManeuverPlanList from './ManeuverPlanList.js';
import BottomSheet from './BottomSheet.js';

/**
 * Maneuver planning UI — thin wrapper.
 * State lives in ManeuverPlanProvider (context).
 * Plan list renders here in the turn panel (desktop) or in a
 * bottom sheet (mobile).
 * Action picker and FAB render on the map (via MapApp.js).
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
			<ManeuverPlanProvider>
				<BottomSheet
					peekContent={
						<span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
							Maneuver Plan &#9650;
						</span>
					}
				>
					<ManeuverPlanList />
				</BottomSheet>
			</ManeuverPlanProvider>
		);
	}

	return (
		<ManeuverPlanProvider>
			<ManeuverPlanList />
		</ManeuverPlanProvider>
	);
}

export default ManeuverPlannerApp;
