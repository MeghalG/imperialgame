import React from 'react';
import './App.css';
import UserContext from './UserContext.js';
import { Card, Collapse, Divider, Alert } from 'antd';
import { CountryCard, PlayerCard } from './StateApp.js';
import * as miscAPI from './backendFiles/miscAPI.js';

const { Panel } = Collapse;

class StaticTurnApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {};
	}

	componentDidMount() {
		this.getGameState();
	}

	async getGameState() {
		let gameState = await miscAPI.getGameState(this.context);
		this.setState({ gameState: gameState });
	}

	twoDec(money) {
		if (!money) {
			return 0;
		} else {
			return parseFloat(money).toFixed(2).toString();
		}
	}

	formatAvailStock(availStock, color) {
		let t = [];
		for (let i = 0; i < availStock.length; i++) {
			t.push(<mark style={{ backgroundColor: color, color: 'white', borderRadius: 3 }}>{availStock[i]}</mark>);
			t.push(<span>&nbsp;</span>);
		}
		return t;
	}

	leadershipText(countryInfo) {
		if (!countryInfo.gov) {
			return '';
		}
		if (countryInfo.gov === 'dictatorship') {
			return countryInfo.leadership[0];
		}
		if (countryInfo.gov === 'democracy') {
			return countryInfo.leadership[0] + ' / ' + countryInfo.leadership[1];
		}
	}

	clean(x) {
		if (x) {
			return x;
		} else {
			return {};
		}
	}

	// fix
	buildComponents = () => {
		if (!this.state.gameState) {
			return null;
		}

		let colors = {
			Austria: '#aa9514',
			Italy: '#306317',
			France: '#164c7e',
			England: '#791a1f',
			Germany: '#202020',
			Russia: '#3e2069',
		};
		let countryColors = ['#7c6e14', '#306317', '#164c7e', '#791a1f', '#292929', '#3e2069'];
		let country = this.state.gameState.countryUp;
		// if in players only
		let pc = (
			<Panel header={'View your details'} key="player">
				<div style={{ marginLeft: 9 }}>
					<PlayerCard
						w="100%"
						h="100%"
						bg="black"
						p="15px 20px 0px 20px"
						br={0.001}
						ml={9}
						b="#707070"
						player={''}
						countryColors={countryColors}
						info={this.clean(this.state.gameState.playerInfo[this.context.name])}
						countryInfos={this.state.gameState.countryInfo}
					/>
				</div>
			</Panel>
		);
		let cc = (
			<Panel header={'View ' + country + ' details'} key="country">
				<CountryCard
					w="100%"
					h="100%"
					bg="black"
					country={''}
					p="15px 20px 0px 20px"
					br={0.001}
					ml={9}
					b={colors[country]}
					color={colors[country]}
					darkColor={colors[country]}
					info={this.clean(this.state.gameState.countryInfo[country])}
				/>
			</Panel>
		);
		switch (this.state.gameState.mode) {
			case 'bid':
			case 'buy':
				return (
					<div>
						<Collapse ghost style={{ marginLeft: -18, marginBottom: -20, marginTop: -10 }}>
							{pc}
						</Collapse>
						<Divider />
					</div>
				);
			case 'buy-bid':
				let bids = (this.state.gameState.bidBuyOrder || []).map((x) => [x, this.state.gameState.playerInfo[x].bid]);
				let s = bids.join(', ');
				let t = [];
				for (let bid of bids) {
					t.push(
						<p style={{ textAlign: 'left' }}>
							&nbsp;&nbsp;{bid[0]}:<span style={{ float: 'right' }}>${bid[1]}&nbsp;&nbsp;</span>
						</p>
					);
				}
				return (
					<div>
						<Collapse ghost style={{ marginLeft: -18, marginBottom: -20, marginTop: -10 }}>
							{pc}
							<Panel header={'View bids in order'} key="1">
								<div style={{ marginLeft: 9 }}>
									<Card
										style={{
											marginLeft: 'auto',
											marginRight: 'auto',
											lineHeight: '0.8',
											borderColor: colors[country],
											backgroundColor: 'black',
										}}
										bodyStyle={{ padding: '15px 20px 0px 20px' }}
									>
										{t}
									</Card>
								</div>
							</Panel>
						</Collapse>
						<Divider />
					</div>
				);
			case 'proposal-opp':
			case 'proposal':
			case 'vote':
				let pr = null;
				if (this.state.gameState.mode === 'proposal-opp') {
					pr = (
						<Alert
							style={{ marginBottom: 10, width: '100%' }}
							message={this.state.gameState.history[this.state.gameState.history.length - 1]}
							type="info"
						/>
					);
				}
				return (
					<div>
						{pr}
						<Collapse ghost style={{ marginLeft: -18, marginTop: -10, marginBottom: -20 }}>
							{pc}
							{cc}
						</Collapse>
						<Divider />
					</div>
				);
		}
		return '';
	};

	render() {
		return <div>{this.buildComponents()}</div>;
	}
}
StaticTurnApp.contextType = UserContext;

export default StaticTurnApp;
