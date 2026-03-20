import React from 'react';
import ReactDOM from 'react-dom';

/**
 * ImportTypePicker — Army/Fleet popup for Import map interaction.
 *
 * Shown when clicking a port territory that can receive either unit type.
 * Reuses .imp-action-picker CSS from maneuver action picker.
 * Rendered via portal to document.body so it appears over the map regardless
 * of where ImportSelect lives in the DOM (sidebar, drawer, etc.).
 *
 * @param {{ x: number, y: number } | null} position - Screen coords. Null hides.
 * @param {string[]} availableTypes - ['army'], ['fleet'], or ['army', 'fleet']
 * @param {(type: string) => void} onSelect - Called with 'army' or 'fleet'
 * @param {() => void} onDismiss - Called when clicking outside
 */
function ImportTypePicker({ position, availableTypes, onSelect, onDismiss }) {
	if (!position || !availableTypes || availableTypes.length === 0) return null;

	const labels = { army: 'Army', fleet: 'Fleet' };
	const colors = { army: '#D4A843', fleet: '#4DAADB' };

	return ReactDOM.createPortal(
		<React.Fragment>
			<div className="imp-action-picker__backdrop" onClick={onDismiss} />
			<div
				className="imp-action-picker"
				style={{ left: position.x, top: position.y }}
				onClick={(e) => e.stopPropagation()}
			>
				{availableTypes.map((type) => (
					<button
						key={type}
						className="imp-action-picker__btn"
						style={{ borderLeftColor: colors[type] || 'rgba(255,255,255,0.3)' }}
						onClick={() => onSelect(type)}
					>
						{labels[type] || type}
					</button>
				))}
			</div>
		</React.Fragment>,
		document.body
	);
}

export default ImportTypePicker;
