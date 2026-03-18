import React, { useContext } from 'react';
import ManeuverPlanContext from './ManeuverPlanContext.js';
import { getCountryColorPalette } from './countryColors.js';
import UserContext from './UserContext.js';

/**
 * ManeuverSubmitFAB
 *
 * A floating action button rendered on the map that contextually advances the
 * maneuver. When a peace action is pending, it shows the peace button for the
 * target country. Otherwise it shows the final "Submit Maneuver" button.
 */
function ManeuverSubmitFAB() {
	const { loaded, nextPeace, canSubmit, requestPeace, submitManeuver, submitting } = useContext(ManeuverPlanContext);
	const { colorblindMode } = useContext(UserContext);

	if (!loaded) return null;

	const palette = getCountryColorPalette(colorblindMode);

	let label;
	let backgroundColor;
	let onClick;
	let disabled;

	if (nextPeace) {
		const countryColor = (palette.bright && palette.bright[nextPeace.country]) || '#13a8a8';
		label = submitting ? 'Submitting\u2026' : `\u262E Peace: ${nextPeace.country}`;
		backgroundColor = countryColor;
		onClick = () => requestPeace(nextPeace.phase, nextPeace.index);
		disabled = submitting;
	} else {
		label = submitting ? 'Submitting\u2026' : 'Submit Maneuver';
		backgroundColor = '#13a8a8';
		onClick = submitManeuver;
		disabled = submitting || !canSubmit;
	}

	return (
		<button className="imp-submit-fab" style={{ backgroundColor }} onClick={onClick} disabled={disabled}>
			{label}
		</button>
	);
}

export default ManeuverSubmitFAB;
