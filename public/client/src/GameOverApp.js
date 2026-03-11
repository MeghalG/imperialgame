import React, { useState, useContext, useEffect } from 'react';
import './App.css';
import './MapOverlay.css';
import UserContext from './UserContext.js';
import * as stateAPI from './backendFiles/stateAPI.js';
import * as helper from './backendFiles/helper.js';
import { getCountryColorPalette } from './countryColors.js';

/**
 * Displays the game-over screen when a country reaches 25 points.
 * Shows the winner (wealthiest investor), ranked player cards with
 * portfolio wealth breakdowns, and country standings.
 */
function GameOverApp() {
	const context = useContext(UserContext);
	const [winner, setWinner] = useState('');
	const [playerRows, setPlayerRows] = useState([]);
	const [countryRows, setCountryRows] = useState([]);
	const [loaded, setLoaded] = useState(false);
	const [collapsed, setCollapsed] = useState(false);

	useEffect(() => {
		async function loadData() {
			try {
				let playerInfo = await stateAPI.getPlayerInfo(context);
				let countryInfo = await stateAPI.getCountryInfo(context);

				// Determine winner
				let w = helper.getWinner({ playerInfo, countryInfo });

				// Build player rows sorted by score descending
				let pRows = [];
				for (let name in playerInfo) {
					let info = playerInfo[name];
					let score = helper.computeScore(info, countryInfo);
					let cash = helper.computeCash(info, countryInfo);

					// Compute per-country bond value contribution to score
					let bondValues = {};
					for (let s of info.stock || []) {
						let countryPts = countryInfo[s.country] ? countryInfo[s.country].points : 0;
						let value = Math.floor(countryPts / 5) * s.stock;
						bondValues[s.country] = (bondValues[s.country] || 0) + value;
					}

					let stocks = (info.stock || []).map((s) => s.country + ' ' + s.stock).join(', ') || 'None';
					pRows.push({
						key: name,
						name: name,
						score: parseFloat(score.toFixed(2)),
						money: parseFloat((info.money || 0).toFixed(2)),
						cashValue: parseFloat(cash.toFixed(2)),
						stocks: stocks,
						bondValues: bondValues,
						isWinner: name === w,
					});
				}
				pRows.sort((a, b) => b.score - a.score || b.cashValue - a.cashValue || b.money - a.money);

				// Build country rows sorted by points descending, with per-player bond values
				let cRows = [];
				for (let country in countryInfo) {
					let info = countryInfo[country];
					let valuePerBond = Math.floor((info.points || 0) / 5);
					// Compute each player's total bond $$ in this country
					let playerBondValues = {};
					for (let pName in playerInfo) {
						let pInfo = playerInfo[pName];
						let total = 0;
						for (let s of pInfo.stock || []) {
							if (s.country === country) {
								total += valuePerBond * s.stock;
							}
						}
						if (total > 0) playerBondValues[pName] = total;
					}
					cRows.push({
						key: country,
						country: country,
						points: info.points || 0,
						treasury: parseFloat((info.money || 0).toFixed(2)),
						leadership: (info.leadership || []).join(', ') || 'None',
						gov: info.gov || '',
						playerBondValues: playerBondValues,
					});
				}
				cRows.sort((a, b) => b.points - a.points);

				setWinner(w);
				setPlayerRows(pRows);
				setCountryRows(cRows);
				setLoaded(true);
			} catch (e) {
				console.error('GameOverApp failed to load:', e);
			}
		}
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	if (!loaded) {
		return <div style={{ textAlign: 'center', padding: 40 }}>Loading results...</div>;
	}

	let palette = getCountryColorPalette(context.colorblindMode);
	let winnerRow = playerRows.find((r) => r.isWinner);
	let maxScore = playerRows.length > 0 ? Math.max(...playerRows.map((r) => r.score)) : 1;
	if (maxScore <= 0) maxScore = 1;

	return (
		<div className={'imp-gameover' + (collapsed ? ' imp-gameover--collapsed' : '')}>
			{/* Winner announcement + collapse toggle */}
			<div className="imp-gameover__header" onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer' }}>
				<div className="imp-gameover__winner-label">Game Over</div>
				<div className="imp-gameover__winner-name">{winner} wins!</div>
				<div className="imp-gameover__winner-score">Score: ${winnerRow ? winnerRow.score.toFixed(2) : '0.00'}</div>
				<button
					className="imp-gameover__toggle"
					onClick={(e) => {
						e.stopPropagation();
						setCollapsed(!collapsed);
					}}
					title={collapsed ? 'Expand standings' : 'Collapse standings'}
					aria-label={collapsed ? 'Expand standings' : 'Collapse standings'}
					aria-expanded={!collapsed}
				>
					<i className={'fas fa-chevron-' + (collapsed ? 'down' : 'up')} style={{ fontSize: 10 }}></i>
				</button>
			</div>

			{/* Two-column layout */}
			{!collapsed && (
				<div className="imp-gameover__columns">
					{/* Left: Player rankings */}
					<div className="imp-gameover__col">
						<div className="imp-gameover__section-label">Investor Rankings</div>
						{playerRows.map((row, idx) => (
							<div
								key={row.key}
								className={'imp-gameover__player-card' + (row.isWinner ? ' imp-gameover__player-card--winner' : '')}
							>
								<div className="imp-gameover__rank">{idx + 1}</div>
								<div className="imp-gameover__player-info">
									<div className="imp-gameover__player-name">{row.name}</div>
									<div className="imp-gameover__player-score">${row.score.toFixed(2)}</div>
									{maxScore > 0 && (
										<div className="imp-gameover__wealth-bar">
											{row.money > 0 && (
												<div
													className="imp-gameover__wealth-segment"
													style={{
														width: (row.money / maxScore) * 100 + '%',
														backgroundColor: 'rgba(255,255,255,0.25)',
													}}
													title={'Cash: $' + row.money.toFixed(2)}
												/>
											)}
											{Object.entries(row.bondValues || {}).map(
												([country, value]) =>
													value > 0 && (
														<div
															key={country}
															className="imp-gameover__wealth-segment"
															style={{
																width: (value / maxScore) * 100 + '%',
																backgroundColor: palette.bright[country] || '#555',
															}}
															title={country + ': $' + value.toFixed(2)}
														/>
													)
											)}
										</div>
									)}
									{Object.keys(row.bondValues || {}).length > 0 && (
										<div className="imp-gameover__bond-breakdown">
											{Object.entries(row.bondValues).map(
												([country, value]) =>
													value > 0 && (
														<span key={country} className="imp-gameover__bond-item">
															<span
																className="imp-gameover__bond-dot"
																style={{
																	backgroundColor: palette.bright[country] || '#555',
																}}
															/>
															{country}: ${value.toFixed(0)}
														</span>
													)
											)}
											<span className="imp-gameover__bond-item">Cash: ${row.money.toFixed(0)}</span>
										</div>
									)}
									<div className="imp-gameover__player-detail">
										Bonds: {row.stocks !== 'None' ? row.stocks : 'None'}
									</div>
								</div>
							</div>
						))}
					</div>

					{/* Right: Country standings */}
					<div className="imp-gameover__col">
						<div className="imp-gameover__section-label">Country Standings</div>
						{countryRows.map((row) => {
							let valuePerBond = Math.floor(row.points / 5);
							let owners = Object.entries(row.playerBondValues || {}).sort((a, b) => b[1] - a[1]);
							return (
								<div key={row.key} className="imp-gameover__country-card">
									<div className="imp-gameover__country-header">
										<div
											className="imp-gameover__country-dot"
											style={{
												backgroundColor: palette.bright[row.country] || '#555',
											}}
										/>
										<div className="imp-gameover__country-name">{row.country}</div>
										<div className="imp-gameover__country-bond-value">${valuePerBond}/bond</div>
										<div className="imp-gameover__country-pts">{row.points} pts</div>
									</div>
									{owners.length > 0 && (
										<div className="imp-gameover__country-owners">
											{owners.map(([pName, val]) => (
												<span key={pName} className="imp-gameover__country-owner">
													{pName}: ${val}
												</span>
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

export default GameOverApp;
