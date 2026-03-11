import React, { useState } from 'react';
import './MapOverlay.css';

function FloatingTurnPanel({ title, accentColor, undoButton, children }) {
	const [collapsed, setCollapsed] = useState(false);

	return (
		<div className={'imp-turn-panel imp-panel imp-fade-in' + (collapsed ? ' imp-turn-panel--collapsed' : '')}>
			<div className="imp-panel__header-accent" style={{ backgroundColor: accentColor || '#c9a84c' }} />
			<div className="imp-panel__header">
				<span>
					{title}
					{undoButton && <span style={{ marginLeft: 10 }}>{undoButton}</span>}
				</span>
				<button
					className="imp-panel__collapse-btn"
					onClick={() => setCollapsed(!collapsed)}
					title={collapsed ? 'Expand' : 'Collapse'}
					aria-label={collapsed ? 'Expand turn panel' : 'Collapse turn panel'}
					aria-expanded={!collapsed}
				>
					<i className={'fas fa-chevron-' + (collapsed ? 'up' : 'down')} style={{ fontSize: 10 }}></i>
				</button>
			</div>
			<div className="imp-panel__body">{children}</div>
		</div>
	);
}

export default FloatingTurnPanel;
