import React, { useContext } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import TurnControlContext from './TurnControlContext.js';
import UserContext from './UserContext.js';
import { getCountryColorPalette } from './countryColors.js';
import SoundManager from './SoundManager.js';

function SidebarSubmit() {
	const turnControl = useContext(TurnControlContext);
	const context = useContext(UserContext);
	const palette = getCountryColorPalette(context.colorblindMode);

	if (!turnControl.submitHandler) return null;

	let bgColor = '#13a8a8'; // default teal
	if (context.country && palette.mid[context.country]) {
		bgColor = palette.mid[context.country];
	}

	async function handleClick() {
		if (!turnControl.submitEnabled || turnControl.submitting) return;
		turnControl.setSubmitting(true);
		SoundManager.playSubmit();
		try {
			await turnControl.submitHandler(context);
		} finally {
			turnControl.setSubmitting(false);
		}
	}

	return (
		<div className="imp-sidebar-submit">
			<button
				className="imp-sidebar-submit__btn"
				style={{ backgroundColor: bgColor }}
				disabled={!turnControl.submitEnabled || turnControl.submitting}
				onClick={handleClick}
			>
				{turnControl.submitting ? <LoadingOutlined style={{ marginRight: 8 }} /> : null}
				{turnControl.submitLabel}
			</button>
		</div>
	);
}

export default SidebarSubmit;
