import React, { useState, useContext, useEffect } from 'react';
import './App.css';
import { Result, Table, Card } from 'antd';
import UserContext from './UserContext.js';
import * as stateAPI from './backendFiles/stateAPI.js';
import * as helper from './backendFiles/helper.js';

/**
 * Displays the game-over screen when a country reaches 25 points.
 * Shows the winner, a player scoreboard sorted by score, and country standings.
 *
 * Uses Ant Design Result for the winner announcement and Table for standings.
 */
function GameOverApp() {
	const context = useContext(UserContext);
	const [winner, setWinner] = useState('');
	const [playerRows, setPlayerRows] = useState([]);
	const [countryRows, setCountryRows] = useState([]);
	const [loaded, setLoaded] = useState(false);

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
					let stocks = (info.stock || []).map((s) => s.country + ' ' + s.stock).join(', ') || 'None';
					pRows.push({
						key: name,
						name: name,
						score: parseFloat(score.toFixed(2)),
						money: parseFloat((info.money || 0).toFixed(2)),
						cashValue: parseFloat(cash.toFixed(2)),
						stocks: stocks,
						isWinner: name === w,
					});
				}
				pRows.sort((a, b) => b.score - a.score || b.cashValue - a.cashValue || b.money - a.money);

				// Build country rows sorted by points descending
				let cRows = [];
				for (let country in countryInfo) {
					let info = countryInfo[country];
					cRows.push({
						key: country,
						country: country,
						points: info.points || 0,
						treasury: parseFloat((info.money || 0).toFixed(2)),
						leadership: (info.leadership || []).join(', ') || 'None',
						gov: info.gov || '',
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

	const playerColumns = [
		{
			title: 'Rank',
			key: 'rank',
			render: (text, record, index) => index + 1,
			width: 60,
		},
		{
			title: 'Player',
			dataIndex: 'name',
			key: 'name',
			render: (text, record) => (record.isWinner ? <strong>{text}</strong> : text),
		},
		{
			title: 'Score',
			dataIndex: 'score',
			key: 'score',
			sorter: (a, b) => a.score - b.score,
			defaultSortOrder: 'descend',
		},
		{
			title: 'Money',
			dataIndex: 'money',
			key: 'money',
			render: (val) => '$' + val.toFixed(2),
		},
		{
			title: 'Cash Value',
			dataIndex: 'cashValue',
			key: 'cashValue',
			render: (val) => '$' + val.toFixed(2),
		},
		{
			title: 'Stocks',
			dataIndex: 'stocks',
			key: 'stocks',
		},
	];

	const countryColumns = [
		{
			title: 'Country',
			dataIndex: 'country',
			key: 'country',
		},
		{
			title: 'Points',
			dataIndex: 'points',
			key: 'points',
			sorter: (a, b) => a.points - b.points,
			defaultSortOrder: 'descend',
		},
		{
			title: 'Treasury',
			dataIndex: 'treasury',
			key: 'treasury',
			render: (val) => '$' + val.toFixed(2),
		},
		{
			title: 'Government',
			dataIndex: 'gov',
			key: 'gov',
		},
		{
			title: 'Leadership',
			dataIndex: 'leadership',
			key: 'leadership',
		},
	];

	return (
		<div>
			<Result status="success" title={'Game Over'} subTitle={winner + ' wins!'} />
			<Card title="Player Standings" style={{ marginBottom: 16 }}>
				<Table
					dataSource={playerRows}
					columns={playerColumns}
					pagination={false}
					size="small"
					rowClassName={(record) => (record.isWinner ? 'winner-row' : '')}
				/>
			</Card>
			<Card title="Country Standings">
				<Table dataSource={countryRows} columns={countryColumns} pagination={false} size="small" />
			</Card>
		</div>
	);
}

export default GameOverApp;
