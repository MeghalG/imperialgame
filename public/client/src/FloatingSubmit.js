import React from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import useSubmitHandler from './useSubmitHandler.js';
import useGameState from './useGameState.js';
import ActionPreview from './ActionPreview.js';

/**
 * Floating submit FAB, mounted over the map via MapViewport's `overlay` prop.
 *
 * Visibility: unmounts when there's no active submit handler/action OR during
 * game-over (GameOverApp takes over the UI). Preview pill wrapper stays mounted
 * whenever the FAB is mounted so its aria-live region can announce text changes.
 * ActionPreview itself can return null when empty — the wrapper handles that.
 */
function FloatingSubmit() {
	const { canSubmit, hasHandler, handleClick, submitLabel, submitting, bgColor } = useSubmitHandler();
	const { gameState } = useGameState();
	const mode = gameState && gameState.mode;

	// Unmount entirely during game-over (GameOverApp overlay takes over the UI)
	if (mode === 'game-over') return null;
	// Unmount when there's no action to submit at all
	if (!hasHandler) return null;

	const ariaLabel = submitLabel ? 'Submit: ' + submitLabel : 'Submit';

	return (
		<div className="imp-floating-submit">
			<div className="imp-floating-submit__preview-slot" role="status" aria-live="polite">
				<ActionPreview />
			</div>
			<Tooltip title={submitLabel} placement="left" mouseEnterDelay={0.3} mouseLeaveDelay={0} destroyTooltipOnHide>
				<button
					type="button"
					className="imp-submit-fab"
					style={{ backgroundColor: bgColor }}
					disabled={!canSubmit}
					onClick={handleClick}
					aria-label={ariaLabel}
				>
					{submitting ? <LoadingOutlined /> : <span className="imp-submit-fab__label">{submitLabel}</span>}
				</button>
			</Tooltip>
		</div>
	);
}

export default FloatingSubmit;
