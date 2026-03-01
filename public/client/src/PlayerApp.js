import React from 'react';
import './App.css';

import { Card, Space, Tooltip } from 'antd';
import { DollarCircleFilled, DollarCircleOutlined, FlagFilled, FlagOutlined } from '@ant-design/icons';
import UserContext from './UserContext.js';
import * as stateAPI from './backendFiles/stateAPI.js';
import * as helper from './backendFiles/helper.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';

class PlayerApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
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
		let [countries, country, player, order] = await Promise.all([
			helper.getCountries(this.context),
			stateAPI.getCountryInfo(this.context),
			stateAPI.getPlayerInfo(this.context),
			helper.getPlayersInOrder(this.context),
		]);
		this.setState({ countries: countries, countryInfo: country, playerInfo: player, playersOrdered: order });
	};

	order(d) {
		return this.state.countries.map((x) => d[x]);
	}

	render() {
		return (
			<div style={{ display: 'flex' }}>
				<Space size="small" direction="vertical">
					<PlayerCard
						player={this.state.playersOrdered[0]}
						countryColors={this.state.darkColors}
						info={clean(this.state.playerInfo[this.state.playersOrdered[0]])}
						countryInfos={this.state.countryInfo}
					/>
					<PlayerCard
						player={this.state.playersOrdered[1]}
						countryColors={this.state.darkColors}
						info={clean(this.state.playerInfo[this.state.playersOrdered[1]])}
						countryInfos={this.state.countryInfo}
					/>
					<PlayerCard
						player={this.state.playersOrdered[2]}
						countryColors={this.state.darkColors}
						info={clean(this.state.playerInfo[this.state.playersOrdered[2]])}
						countryInfos={this.state.countryInfo}
					/>
					<PlayerCard
						player={this.state.playersOrdered[3]}
						countryColors={this.state.darkColors}
						info={clean(this.state.playerInfo[this.state.playersOrdered[3]])}
						countryInfos={this.state.countryInfo}
					/>
					<PlayerCard
						player={this.state.playersOrdered[4]}
						countryColors={this.state.darkColors}
						info={clean(this.state.playerInfo[this.state.playersOrdered[4]])}
						countryInfos={this.state.countryInfo}
					/>
					<PlayerCard
						player={this.state.playersOrdered[5]}
						countryColors={this.state.darkColors}
						info={clean(this.state.playerInfo[this.state.playersOrdered[5]])}
						countryInfos={this.state.countryInfo}
					/>
				</Space>
			</div>
		);
	}
}
PlayerApp.contextType = UserContext;

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

class PlayerCard extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			countries: ['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia'],
			colors: {
				Austria: '#d8bd14',
				Italy: '#49aa19',
				France: '#177ddc',
				England: '#d32029',
				Germany: '#000000',
				Russia: '#854eca',
			},
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
								backgroundColor: this.props.countryColors[this.state.countries[i]],
								color: 'white',
								borderRadius: 2,
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
	gov() {
		let t = [];
		for (let country in this.props.countryInfos) {
			if ((this.props.countryInfos[country].leadership || [])[0] === this.props.player) {
				t.push(
					<Tooltip title={country + ' Leader'} mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
						<FlagFilled style={{ fontSize: 16, color: this.state.colors[country], marginRight: 3 }} />
					</Tooltip>
				);
			}
			if (
				(this.props.countryInfos[country] || {}).gov === 'democracy' &&
				this.props.countryInfos[country].leadership[1] === this.props.player
			) {
				t.push(
					<Tooltip title={country + ' Opposition'} mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
						<FlagOutlined style={{ fontSize: 16, color: this.state.colors[country], marginRight: 3 }} />
					</Tooltip>
				);
			}
		}
		return t;
	}

	investor() {
		let t = [];
		if (this.props.info.investor) {
			t.push(
				<Tooltip title="Investor Card" mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
					<DollarCircleFilled style={{ fontSize: 16, color: '#CCCCCC', marginRight: 3 }} />
				</Tooltip>
			);
		}
		if (this.props.info.swiss) {
			t.push(
				<Tooltip title="Swiss" mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
					<DollarCircleOutlined style={{ fontSize: 16, color: '#CCCCCC', marginRight: 3 }} />
				</Tooltip>
			);
		}
		return t;
	}

	render() {
		if (this.props.player !== null) {
			return (
				<Card
					hoverable={true}
					size="small"
					style={{ lineHeight: '0.8', minWidth: '100%', backgroundColor: 'black', width: '11vw' }}
					headStyle={{ backgroundColor: '#303030', lineHeight: '1', padding: '0px 10px 0px 10px', minHeight: 0 }}
					title={
						<div>
							{this.investor()}
							{this.props.player}
							<span style={{ float: 'right', fontSize: 13 }}>{this.gov()}</span>
						</div>
					}
					bodyStyle={{ padding: '10px 0px 0px 0px', wordWrap: 'break-word' }}
				>
					<p style={{ textAlign: 'left' }}>&nbsp;&nbsp;${twoDec(this.props.info.money)}&nbsp;&nbsp;</p>
					<p style={{ textAlign: 'left' }}>&nbsp;&nbsp;{this.formatStock(this.props.info.stock)}</p>
				</Card>
			);
		} else {
			return null;
		}
	}
}
PlayerCard.contextType = UserContext;

export default PlayerApp;
