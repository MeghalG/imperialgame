import React from 'react';
import './App.css';

import { Card, Space, Tooltip } from 'antd';
import UserContext from './UserContext.js';
import * as stateAPI from './backendFiles/stateAPI.js';
import * as helper from './backendFiles/helper.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';

// note this file hardcodes countries + ordering

class StateApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			colors: {
				Austria: '#aa9514',
				Italy: '#3c8618',
				France: '#1765ad',
				England: '#a61d24',
				Germany: '#292929',
				Russia: '#51258f',
			},
			darkColors: {
				Austria: '#7c6e14',
				Italy: '#306317',
				France: '#164c7e',
				England: '#791a1f',
				Germany: '#292929',
				Russia: '#3e2069',
			},
			countries: [],
			countryInfo: {},
			playerInfo: {},
			playersOrdered: [],
		};
	}

	componentDidMount() {
		this.reinitialize();
		this.turnRef = database.ref('games/' + this.context.game + '/turnID');
		this.turnRef.on('value', (dataSnapshot) => {
			invalidateIfStale(this.context.game, dataSnapshot.val());
			this.reinitialize();
		});
	}

	componentWillUnmount() {
		if (this.turnRef) {
			this.turnRef.off();
		}
	}

	reinitialize = async () => {
		let [countries, countryInfo, playerInfo, playersOrdered] = await Promise.all([
			helper.getCountries(this.context),
			stateAPI.getCountryInfo(this.context),
			stateAPI.getPlayerInfo(this.context),
			helper.getPlayersInOrder(this.context),
		]);
		this.setState({ countries, countryInfo, playerInfo, playersOrdered });
	};

	order(d) {
		return this.state.countries.map((x) => d[x]);
	}

	render() {
		return (
			<div style={{ display: 'flex' }}>
				<Card
					style={{ width: '46vw', height: 'calc(100vh + -135px)', overflow: 'auto', marginRight: '2vw' }}
					bodyStyle={{ padding: '0 2vw' }}
				>
					<Space size="middle" direction="vertical">
						<Space size="large" style={{ display: 'flex' }}>
							<CountryCard
								country={this.state.countries[0]}
								color={this.state.colors[this.state.countries[0]]}
								darkColor={this.state.darkColors[this.state.countries[0]]}
								info={clean(this.state.countryInfo[this.state.countries[0]])}
								playerInfo={this.state.playerInfo}
							/>
							<CountryCard
								country={this.state.countries[1]}
								color={this.state.colors[this.state.countries[1]]}
								darkColor={this.state.darkColors[this.state.countries[1]]}
								info={clean(this.state.countryInfo[this.state.countries[1]])}
								playerInfo={this.state.playerInfo}
							/>
						</Space>
						<Space size="large" style={{ display: 'flex' }}>
							<CountryCard
								country={this.state.countries[2]}
								color={this.state.colors[this.state.countries[2]]}
								darkColor={this.state.darkColors[this.state.countries[2]]}
								info={clean(this.state.countryInfo[this.state.countries[2]])}
								playerInfo={this.state.playerInfo}
							/>
							<CountryCard
								country={this.state.countries[3]}
								color={this.state.colors[this.state.countries[3]]}
								darkColor={this.state.darkColors[this.state.countries[3]]}
								info={clean(this.state.countryInfo[this.state.countries[3]])}
								playerInfo={this.state.playerInfo}
							/>
						</Space>
						<Space size="large" style={{ display: 'flex' }}>
							<CountryCard
								country={this.state.countries[4]}
								color={this.state.colors[this.state.countries[4]]}
								darkColor={this.state.darkColors[this.state.countries[4]]}
								info={clean(this.state.countryInfo[this.state.countries[4]])}
								playerInfo={this.state.playerInfo}
							/>
							<CountryCard
								country={this.state.countries[5]}
								color={this.state.colors[this.state.countries[5]]}
								darkColor={this.state.darkColors[this.state.countries[5]]}
								info={clean(this.state.countryInfo[this.state.countries[5]])}
								playerInfo={this.state.playerInfo}
							/>
						</Space>
					</Space>
				</Card>
				<Card
					style={{ width: '46vw', height: 'calc(100vh + -135px)', overflow: 'auto' }}
					bodyStyle={{ padding: '0 2vw' }}
				>
					<Space size="middle" direction="vertical">
						<Space size="large" style={{ display: 'flex' }}>
							<PlayerCard
								player={this.state.playersOrdered[0]}
								countryColors={this.order(this.state.darkColors)}
								info={clean(this.state.playerInfo[this.state.playersOrdered[0]])}
								countryInfos={this.state.countryInfo}
							/>
							<PlayerCard
								player={this.state.playersOrdered[1]}
								countryColors={this.order(this.state.darkColors)}
								info={clean(this.state.playerInfo[this.state.playersOrdered[1]])}
								countryInfos={this.state.countryInfo}
							/>
						</Space>
						<Space size="large" style={{ display: 'flex' }}>
							<PlayerCard
								player={this.state.playersOrdered[2]}
								countryColors={this.order(this.state.darkColors)}
								info={clean(this.state.playerInfo[this.state.playersOrdered[2]])}
								countryInfos={this.state.countryInfo}
							/>
							<PlayerCard
								player={this.state.playersOrdered[3]}
								countryColors={this.order(this.state.darkColors)}
								info={clean(this.state.playerInfo[this.state.playersOrdered[3]])}
								countryInfos={this.state.countryInfo}
							/>
						</Space>
						<Space size="large" style={{ display: 'flex' }}>
							<PlayerCard
								player={this.state.playersOrdered[4]}
								countryColors={this.order(this.state.darkColors)}
								info={clean(this.state.playerInfo[this.state.playersOrdered[4]])}
								countryInfos={this.state.countryInfo}
							/>
							<PlayerCard
								player={this.state.playersOrdered[5]}
								countryColors={this.order(this.state.darkColors)}
								info={clean(this.state.playerInfo[this.state.playersOrdered[5]])}
								countryInfos={this.state.countryInfo}
							/>
						</Space>
					</Space>
				</Card>
			</div>
		);
	}
}
StateApp.contextType = UserContext;

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

class CountryCard extends React.Component {
	constructor(props) {
		super(props);
		this.state = {};
	}

	formatAvailStock(availStock) {
		let t = [];
		for (let i = 0; i < availStock.length; i++) {
			t.push(
				<mark style={{ backgroundColor: this.props.darkColor, color: 'white', borderRadius: 3 }}>{availStock[i]}</mark>
			);
			t.push(<span>&nbsp;</span>);
		}
		return t;
	}

	formatOwnership() {
		let playerInfo = this.props.playerInfo || {};
		let owners = {};
		for (let player in playerInfo) {
			let stock = playerInfo[player].stock || [];
			for (let s of stock) {
				if (s.country === this.props.country) {
					if (!owners[player]) owners[player] = [];
					owners[player].push(s.stock);
				}
			}
		}
		let t = [];
		for (let player in owners) {
			t.push(
				<span key={player}>
					{player}: {owners[player].join(', ')}
				</span>
			);
			t.push(<span key={player + '-sep'}>&nbsp;&nbsp;</span>);
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

	render() {
		return (
			<Card
				hoverable={true}
				style={{
					width: this.props.w || '20vw',
					height: this.props.h || '24vh',
					lineHeight: '0.8',
					minHeight: this.props.h || 185,
					minWidth: 250,
					borderRadius: this.props.br || 5,
					borderColor: this.props.b,
					backgroundColor: this.props.bg,
					marginLeft: this.props.ml,
				}}
				headStyle={{ backgroundColor: this.props.color, borderTopLeftRadius: 5, borderTopRightRadius: 5 }}
				title={this.props.country}
				bodyStyle={{ padding: this.props.p || '20px 20px 20px 20px' }}
			>
				<p style={{ textAlign: 'left' }}>
					&nbsp;&nbsp;Points (Last Tax):
					<span style={{ float: 'right' }}>
						{this.props.info.points} ({this.props.info.lastTax})&nbsp;&nbsp;
					</span>
				</p>
				<p style={{ textAlign: 'left' }}>
					&nbsp;&nbsp;Treasury:
					<span style={{ float: 'right' }}>${twoDec(this.props.info.money)}&nbsp;&nbsp;</span>
				</p>
				<p style={{ textAlign: 'left' }}>
					&nbsp;&nbsp;Wheel Position:
					<span style={{ float: 'right' }}>{this.props.info.wheelSpot}&nbsp;&nbsp;</span>
				</p>
				<p style={{ textAlign: 'left' }}>
					&nbsp;&nbsp;Government:
					<span style={{ float: 'right' }}>{this.leadershipText(this.props.info)}&nbsp;&nbsp;</span>
				</p>
				<p style={{ textAlign: 'left' }}>
					&nbsp;&nbsp;Available:
					<span style={{ float: 'right', color: this.props.color }}>
						{this.formatAvailStock(clean(this.props.info.availStock))}
					</span>
				</p>
				<p style={{ textAlign: 'left', fontSize: 12 }}>&nbsp;&nbsp;Owned: {this.formatOwnership()}</p>
			</Card>
		);
	}
}

class PlayerCard extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			countries: ['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia'],
		};
	}

	async componentDidMount() {
		let countries = await helper.getCountries(this.context);
		this.setState({ countries: countries });
	}

	formatStock(stock) {
		let s = [[], [], [], [], [], []];
		for (let i in stock) {
			let index = this.state.countries.indexOf(stock[i].country);
			s[index].push(stock[i].stock);
		}
		let t = [];
		for (let i = 0; i < s.length; i++) {
			for (let j = 0; j < s[i].length; j++) {
				t.push(
					<Tooltip title={this.state.countries[i]} mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
						<mark
							style={{
								backgroundColor: this.props.countryColors[i],
								color: 'white',
								borderRadius: 3,
								cursor: 'default',
							}}
						>
							{s[i][j]}
						</mark>
					</Tooltip>
				);
				t.push(<span>&nbsp;</span>);
			}
		}
		return t;
	}
	investor(info, player) {
		let t = [];
		if (info.investor) {
			t.push(<mark style={{ backgroundColor: '#424242', color: 'white', borderRadius: 3 }}>Investor Card</mark>);
			t.push(<span>&nbsp;</span>);
		}
		if (info.swiss) {
			t.push(<mark style={{ backgroundColor: '#424242', color: 'white', borderRadius: 3 }}>Swiss</mark>);
			t.push(<span>&nbsp;</span>);
		}
		if (player === 'aok') {
			t.push(<mark style={{ backgroundColor: '#51361a', color: 'white', borderRadius: 3 }}>Bear</mark>);
			t.push(<span>&nbsp;</span>);
		}
		if (info.scoreModifier) {
			t.push(
				<mark style={{ backgroundColor: '#424242', color: 'white', borderRadius: 3 }}>
					{this.props.info.scoreModifier}
				</mark>
			);
			t.push(<span>&nbsp;</span>);
		}
		return t;
	}
	sToTime(s) {
		if (!s && s !== 0) return '0:00';
		let secs = s % 60;
		let mins = Math.floor(s / 60);

		return mins + ':' + secs.toString().padStart(2, '0');
	}

	render() {
		if (this.props.player) {
			return (
				<Card
					hoverable={true}
					style={{
						width: this.props.w || '20vw',
						height: this.props.h || '24vh',
						lineHeight: '0.8',
						minHeight: this.props.h || 185,
						minWidth: this.props.w || 250,
						borderRadius: this.props.br || 5,
						backgroundColor: this.props.bg,
						borderColor: this.props.b,
					}}
					headStyle={{ backgroundColor: '#525252', borderTopLeftRadius: 5, borderTopRightRadius: 5 }}
					title={
						<div>
							{this.props.player}
							<span style={{ float: 'right', fontSize: 14 }}>{this.sToTime(this.props.info.banked)}</span>
						</div>
					}
					bodyStyle={{ padding: this.props.p || '20px 20px 20px 20px' }}
				>
					<p style={{ textAlign: 'left' }}>
						&nbsp;&nbsp;Money:
						<span style={{ float: 'right' }}>${twoDec(this.props.info.money)}&nbsp;&nbsp;</span>
					</p>
					<p style={{ textAlign: 'left' }}>
						&nbsp;&nbsp;Current Score:
						<span style={{ float: 'right' }}>
							{helper.computeScore(this.props.info, this.props.countryInfos).toFixed(2)}&nbsp;&nbsp;
						</span>
					</p>
					<p style={{ textAlign: 'left' }}>
						&nbsp;&nbsp;Cash Value:
						<span style={{ float: 'right' }}>
							{helper.computeCash(this.props.info, this.props.countryInfos).toFixed(2)}&nbsp;&nbsp;
						</span>
					</p>
					<p style={{ textAlign: 'left' }}>
						&nbsp;&nbsp;Stock:
						<span style={{ float: 'right' }}>{this.formatStock(this.props.info.stock)}</span>
					</p>
					<p style={{ textAlign: 'left' }}>{this.investor(this.props.info, this.props.player)}</p>
				</Card>
			);
		} else {
			return null;
		}
	}
}
PlayerCard.contextType = UserContext;

export { StateApp, CountryCard, PlayerCard };
