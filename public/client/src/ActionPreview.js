import React, { useContext } from 'react';
import TurnControlContext from './TurnControlContext.js';

function ActionPreview() {
	const turnControl = useContext(TurnControlContext);

	if (!turnControl.previewText) return null;

	return (
		<div className="imp-action-preview">
			<div className="imp-action-preview__label">Preview</div>
			<div className="imp-action-preview__text">{turnControl.previewText}</div>
		</div>
	);
}

export default ActionPreview;
