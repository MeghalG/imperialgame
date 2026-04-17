import { useContext, useCallback } from 'react';
import TurnControlContext from './TurnControlContext.js';
import UserContext from './UserContext.js';
import { getCountryColorPalette } from './countryColors.js';
import SoundManager from './SoundManager.js';

/**
 * Shared submit-action hook. Consumed by both SidebarSubmit (legacy, during
 * transition) and FloatingSubmit (new FAB over the map).
 *
 * Returns:
 *   - hasHandler: true when TurnControlContext has a registered submit handler
 *   - canSubmit: true when a click would actually submit (handler present +
 *                enabled + not already submitting)
 *   - handleClick: async click handler that guards against double-submit
 *   - submitLabel, submitting, bgColor: display state
 */
function useSubmitHandler() {
	const turnControl = useContext(TurnControlContext);
	const context = useContext(UserContext);

	const hasHandler = !!turnControl.submitHandler;
	const canSubmit = hasHandler && turnControl.submitEnabled && !turnControl.submitting;

	const palette = getCountryColorPalette(context.colorblindMode);
	let bgColor = '#13a8a8';
	if (context.country && palette.mid[context.country]) {
		bgColor = palette.mid[context.country];
	}

	const handleClick = useCallback(async () => {
		if (!turnControl.submitEnabled || turnControl.submitting) return;
		turnControl.setSubmitting(true);
		SoundManager.playSubmit();
		try {
			await turnControl.submitHandler(context);
		} finally {
			turnControl.setSubmitting(false);
		}
	}, [turnControl, context]);

	return {
		hasHandler,
		canSubmit,
		handleClick,
		submitLabel: turnControl.submitLabel,
		submitting: turnControl.submitting,
		bgColor,
	};
}

export default useSubmitHandler;
