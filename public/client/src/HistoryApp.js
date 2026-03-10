import React, { useState, useContext, useEffect, useRef } from 'react';
import './App.css';
import './MapOverlay.css';
import UserContext from './UserContext.js';
import { database } from './backendFiles/firebase.js';

/* Map action text to a country color for the timeline dot.
   We detect country names in the history string. */
const COUNTRY_COLORS = {
	Austria: '#d8bd14',
	Italy: '#49aa19',
	France: '#177ddc',
	England: '#d32029',
	Germany: '#666666',
	Russia: '#8b5cf6',
};

const COUNTRY_TAG_RE = /^\[([A-Za-z]+)\]\s*/;

function getCountryColor(text) {
	if (text) {
		let tagMatch = text.match(COUNTRY_TAG_RE);
		if (tagMatch && COUNTRY_COLORS[tagMatch[1]]) {
			return COUNTRY_COLORS[tagMatch[1]];
		}
	}
	for (let country in COUNTRY_COLORS) {
		if (text && text.includes(country)) {
			return COUNTRY_COLORS[country];
		}
	}
	return 'rgba(255,255,255,0.3)';
}

function stripCountryTag(text) {
	return text ? text.replace(COUNTRY_TAG_RE, '') : text;
}

function HistoryApp() {
	const context = useContext(UserContext);
	const [history, setHistory] = useState([]);
	const historyRef = useRef(null);

	useEffect(() => {
		historyRef.current = database.ref('games/' + context.game + '/history');
		historyRef.current.on('value', (dataSnapshot) => {
			let h = dataSnapshot.val();
			setHistory(h.reverse());
		});
		return () => {
			if (historyRef.current) {
				historyRef.current.off();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="imp-timeline">
			{history.map((item, index) => {
				let turnNum = history.length - index;
				let dotColor = getCountryColor(item);
				return (
					<div key={index} className="imp-timeline__item">
						<div className="imp-timeline__dot" style={{ color: dotColor, backgroundColor: dotColor }} />
						<div className="imp-timeline__turn-num">Turn {turnNum}</div>
						<div className="imp-timeline__text">{stripCountryTag(item)}</div>
					</div>
				);
			})}
		</div>
	);
}

export default HistoryApp;
