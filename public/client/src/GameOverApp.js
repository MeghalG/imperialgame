import React from 'react';
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
class GameOverApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			winner: '',
			playerRows: [],
			countryRows: [],
			loaded: false,
		};
	}

	async componentDidMount() {
		try {
			let playerInfo = await stateAPI.getPlayerInfo(this.context);
			let countryInfo = await stateAPI.getCountryInfo(this.context);

			// Determine winner
			let winner = helper.getWinner({ playerInfo, countryInfo });

			// Build player rows sorted by score descending
			let playerRows = [];
			for (let name in playerInfo) {
				let info = playerInfo[name];
				let score = helper.computeScore(info, countryInfo);
				let cash = helper.computeCash(info, countryInfo);
				let stocks = (info.stock || []).map((s) => s.country + ' ' + s.stock).join(', ') || 'None';
				playerRows.push({
					key: name,
					name: name,
					score: parseFloat(score.toFixed(2)),
					money: parseFloat((info.money || 0).toFixed(2)),
					cashValue: parseFloat(cash.toFixed(2)),
					stocks: stocks,
					isWinner: name === winner,
				});
			}
			playerRows.sort((a, b) => b.score - a.score || b.cashValue - a.cashValue || b.money - a.money);

			// Build country rows sorted by points descending
			let countryRows = [];
			for (let country in countryInfo) {
				let info = countryInfo[country];
				countryRows.push({
					key: country,
					country: country,
					points: info.points || 0,
					treasury: parseFloat((info.money || 0).toFixed(2)),
					leadership: (info.leadership || []).join(', ') || 'None',
					gov: info.gov || '',
				});
			}
			countryRows.sort((a, b) => b.points - a.points);

			this.setState({ winner, playerRows, countryRows, loaded: true });
		} catch (e) {
			console.error('GameOverApp failed to load:', e);
		}
	}

	render() {
		if (!this.state.loaded) {
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
				<Result status="success" title={'Game Over'} subTitle={this.state.winner + ' wins!'} />
				<Card title="Player Standings" style={{ marginBottom: 16 }}>
					<Table
						dataSource={this.state.playerRows}
						columns={playerColumns}
						pagination={false}
						size="small"
						rowClassName={(record) => (record.isWinner ? 'winner-row' : '')}
					/>
				</Card>
				<Card title="Country Standings">
					<Table dataSource={this.state.countryRows} columns={countryColumns} pagination={false} size="small" />
				</Card>
			</div>
		);
	}
}
GameOverApp.contextType = UserContext;

export default GameOverApp;
