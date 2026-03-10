import React, { useState, useEffect } from 'react';
import './MapOverlay.css';

function TurnAnnouncement({ countryName, countryColor, subtitle }) {
	const [visible, setVisible] = useState(true);

	useEffect(() => {
		const timer = setTimeout(() => setVisible(false), 2200);
		return () => clearTimeout(timer);
	}, []);

	if (!visible) return null;

	return (
		<div className="imp-turn-announce">
			<div className="imp-turn-announce__content">
				<div className="imp-turn-announce__country" style={{ color: countryColor || '#c9a84c' }}>
					{countryName}
				</div>
				<div className="imp-turn-announce__divider" />
				<div className="imp-turn-announce__subtitle">{subtitle || 'Your Turn'}</div>
			</div>
		</div>
	);
}

export default TurnAnnouncement;
