import React from 'react';
import './App.css';
import './MapOverlay.css';

import { FlagFilled, FlagOutlined } from '@ant-design/icons';

// Previously this file also exported a StateApp component (full countries +
// players grid) and a PlayerCard component. Both were removed in the 2026-04-16
// panel rework: Players moved to PlayersColumn, and Sidebar's Countries tab
// renders CountryCard directly. CountryCard is the only remaining export.

function clean(x) {
	if (x) {
		return x;
	} else {
		return {};
	}
}

function twoDec(money) {
	if (!money) {
		return 0;
	} else {
		return parseFloat(money).toFixed(2).toString();
	}
}

function CountryCard(props) {
	function formatAvailStock(availStock) {
		let t = [];
		for (let i = 0; i < availStock.length; i++) {
			t.push(
				<span key={i} className="imp-state__badge" style={{ backgroundColor: props.darkColor }}>
					{availStock[i]}
				</span>
			);
		}
		return t;
	}

	function renderGov(info) {
		if (!info.gov || !info.leadership || info.leadership.length === 0) {
			return null;
		}
		const pill = info.gov === 'democracy' ? 'DEM' : 'DICT';
		const leader = info.leadership[0];
		const opposition = info.gov === 'democracy' ? info.leadership[1] : null;
		return (
			<span className="imp-state__gov">
				<span className="imp-state__gov-pill">{pill}</span>
				{leader && (
					<span className="imp-state__gov-chip">
						<FlagFilled style={{ color: props.color, fontSize: 10, marginRight: 3 }} />
						{leader}
					</span>
				)}
				{opposition && (
					<span className="imp-state__gov-chip">
						<FlagOutlined style={{ color: props.color, fontSize: 10, marginRight: 3 }} />
						{opposition}
					</span>
				)}
			</span>
		);
	}

	return (
		<div className="imp-state__card">
			<div className="imp-state__card-banner" style={{ background: props.color }} />
			<div className="imp-state__card-header" style={{ background: props.color }}>
				<span>{props.country}</span>
				<span className="imp-state__card-header-extra">{props.info.points} pts</span>
			</div>
			<div className="imp-state__card-body">
				<div className="imp-state__stats">
					<div className="imp-state__stat">
						<span className="imp-state__label">Treasury</span>
						<span className="imp-state__value imp-state__key-stat imp-state__key-stat--gold">
							${twoDec(props.info.money)}
						</span>
					</div>
					<div className="imp-state__stat">
						<span className="imp-state__label">Last Tax</span>
						<span className="imp-state__value">{props.info.lastTax}</span>
					</div>
					<div className="imp-state__stat">
						<span className="imp-state__label">Wheel</span>
						<span className="imp-state__value">{props.info.wheelSpot}</span>
					</div>
				</div>
				<div className="imp-state__row">
					<span className="imp-state__label">Gov</span>
					{renderGov(props.info)}
				</div>
				<div className="imp-state__row">
					<span className="imp-state__label">Available</span>
					<span className="imp-state__badges">{formatAvailStock(clean(props.info.availStock))}</span>
				</div>
			</div>
		</div>
	);
}

export { CountryCard };
