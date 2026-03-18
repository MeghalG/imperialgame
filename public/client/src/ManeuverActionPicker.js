import React from 'react';
import { formatActionLabel, actionColor } from './maneuverActionUtils.js';

/**
 * ManeuverActionPicker
 *
 * A popup that appears near a clicked territory when multiple maneuver actions
 * are available (e.g. peace, war, hostile, blow up). Renders buttons vertically
 * for flat action arrays, or grouped by country for multi-country action objects.
 *
 * @param {object} props
 * @param {{x: number, y: number} | null} props.position - Screen coordinates. Null hides the picker.
 * @param {string[] | {countries: Array<{country: string, units: any, actions: string[]}>, otherActions: string[]} | null} props.actions
 * @param {(country: string|null, action: string) => void} props.onSelect
 * @param {() => void} props.onDismiss
 */
function ManeuverActionPicker({ position, actions, onSelect, onDismiss }) {
	if (!position || !actions) return null;

	const isFlatArray = Array.isArray(actions);

	if (isFlatArray) {
		if (actions.length <= 1) return null;

		return (
			<div
				className="imp-action-picker"
				style={{ left: position.x, top: position.y }}
				onClick={(e) => e.stopPropagation()}
			>
				{actions.map((action) => {
					const color = actionColor(action);
					return (
						<button
							key={action}
							className="imp-action-picker__btn"
							style={{ borderLeftColor: color || 'rgba(255,255,255,0.3)' }}
							onClick={() => onSelect(null, action)}
						>
							{formatActionLabel(action)}
						</button>
					);
				})}
			</div>
		);
	}

	// Multi-country grouped format: { countries: [{country, units, actions}], otherActions }
	const { countries = [], otherActions = [] } = actions;
	const totalActions =
		countries.reduce((sum, g) => sum + (g.actions ? g.actions.length : 0), 0) +
		otherActions.length;

	if (totalActions <= 1) return null;

	return (
		<div
			className="imp-action-picker"
			style={{ left: position.x, top: position.y }}
			onClick={(e) => e.stopPropagation()}
		>
			{countries.map((group) => {
				if (!group.actions || group.actions.length === 0) return null;
				return (
					<div key={group.country} className="imp-action-picker__group">
						<div className="imp-action-picker__label">{group.country}</div>
						{group.actions.map((action) => {
							const color = actionColor(action);
							return (
								<button
									key={action}
									className="imp-action-picker__btn"
									style={{ borderLeftColor: color || 'rgba(255,255,255,0.3)' }}
									onClick={() => onSelect(group.country, action)}
								>
									{formatActionLabel(action)}
								</button>
							);
						})}
					</div>
				);
			})}
			{otherActions.length > 0 && (
				<div className="imp-action-picker__group">
					{otherActions.map((action) => {
						const color = actionColor(action);
						return (
							<button
								key={action}
								className="imp-action-picker__btn"
								style={{ borderLeftColor: color || 'rgba(255,255,255,0.3)' }}
								onClick={() => onSelect(null, action)}
							>
								{formatActionLabel(action)}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}

export default ManeuverActionPicker;
