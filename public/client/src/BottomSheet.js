import React, { useState, useRef } from 'react';

/**
 * BottomSheet — a mobile-friendly panel that slides up from the bottom.
 *
 * Props:
 *   children     — content inside the expanded sheet
 *   peekContent  — content shown in the collapsed handle area
 *   defaultState — 'collapsed' | 'half' | 'full'  (default: 'collapsed')
 */
function BottomSheet({ children, peekContent, defaultState = 'collapsed' }) {
	const [state, setState] = useState(defaultState);
	const startY = useRef(null);

	const onTouchStart = (e) => {
		startY.current = e.touches[0].clientY;
	};

	const onTouchEnd = (e) => {
		if (startY.current === null) return;
		const diff = startY.current - e.changedTouches[0].clientY;
		if (diff > 50) {
			// Swipe up: expand
			setState((s) => (s === 'collapsed' ? 'half' : 'full'));
		} else if (diff < -50) {
			// Swipe down: collapse
			setState((s) => (s === 'full' ? 'half' : 'collapsed'));
		}
		startY.current = null;
	};

	const handleClick = () => {
		setState((s) => {
			if (s === 'collapsed') return 'half';
			if (s === 'half') return 'collapsed';
			return 'half'; // full → half (step down, don't skip)
		});
	};

	return (
		<div className={'imp-bottom-sheet imp-bottom-sheet--' + state}>
			<div
				className="imp-bottom-sheet__handle"
				onClick={handleClick}
				onTouchStart={onTouchStart}
				onTouchEnd={onTouchEnd}
			>
				<div className="imp-bottom-sheet__handle-bar" />
				{peekContent}
			</div>
			<div className="imp-bottom-sheet__content">{children}</div>
		</div>
	);
}

export default BottomSheet;
