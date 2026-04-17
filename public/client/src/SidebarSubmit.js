import React from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import useSubmitHandler from './useSubmitHandler.js';

function SidebarSubmit() {
	const { hasHandler, canSubmit, handleClick, submitLabel, submitting, bgColor } = useSubmitHandler();

	if (!hasHandler) return null;

	return (
		<div className="imp-sidebar-submit">
			<button
				className="imp-sidebar-submit__btn"
				style={{ backgroundColor: bgColor }}
				disabled={!canSubmit}
				onClick={handleClick}
			>
				{submitting ? <LoadingOutlined style={{ marginRight: 8 }} /> : null}
				{submitLabel}
			</button>
		</div>
	);
}

export default SidebarSubmit;
