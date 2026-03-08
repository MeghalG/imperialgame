import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './App.css';

import { Card, Space, Tooltip } from 'antd';
import UserContext from './UserContext.js';
import * as stateAPI from './backendFiles/stateAPI.js';
import * as helper from './backendFiles/helper.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';
import { getCountryColorPalette } from './countryColors.js';

// note this file hardcodes countries + ordering

function StateApp() {
	const context = useContext(UserContext);
	const [countries, setCountries] = useState([]);
	const [countryInfo, setCountryInfo] = useState({});
	const [playerInfo, setPlayerInfo] = useState({});
	const [playersOrdered, setPlayersOrdered] = useState([]);
	const turnRef = useRef(null);
	const contextRef = useRef(context);
	contextRef.current = context;

	const reinitialize = useCallback(async () => {
		let [countriesData, countryInfoData, playerInfoData, playersOrderedData] = await Promise.all([
			helper.getCountries(contextRef.current),
			stateAPI.getCountryInfo(contextRef.current),
			stateAPI.getPlayerInfo(contextRef.current),
			helper.getPlayersInOrder(contextRef.current),
		]);
		setCountries(countriesData);
		setCountryInfo(countryInfoData);
		setPlayerInfo(playerInfoData);
		setPlayersOrdered(playersOrderedData);
	}, []);

	useEffect(() => {
		reinitialize();
		turnRef.current = database.ref('games/' + contextRef.current.game + '/turnID');
		turnRef.current.on('value', (dataSnapshot) => {
			invalidateIfStale(contextRef.current.game, dataSnapshot.val());
			reinitialize();
		});
		return () => {
			if (turnRef.current) {
				turnRef.current.off();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function order(d) {
		return countries.map((x) => d[x]);
	}

	let palette = getCountryColorPalette(context.colorblindMode);
	let colors = palette.mid;
	let darkColors = palette.dark;

	return (
		<div style={{ display: 'flex' }}>
			<Card
				style={{ width: '46vw', height: 'calc(100vh + -135px)', overflow: 'auto', marginRight: '2vw' }}
				bodyStyle={{ padding: '0 2vw' }}
			>
				<Space size="middle" direction="vertical">
					<Space size="large" style={{ display: 'flex' }}>
						<CountryCard
							country={countries[0]}
							color={colors[countries[0]]}
							darkColor={darkColors[countries[0]]}
							info={clean(countryInfo[countries[0]])}
							playerInfo={playerInfo}
						/>
						<CountryCard
							country={countries[1]}
							color={colors[countries[1]]}
							darkColor={darkColors[countries[1]]}
							info={clean(countryInfo[countries[1]])}
							playerInfo={playerInfo}
						/>
					</Space>
					<Space size="large" style={{ display: 'flex' }}>
						<CountryCard
							country={countries[2]}
							color={colors[countries[2]]}
							darkColor={darkColors[countries[2]]}
							info={clean(countryInfo[countries[2]])}
							playerInfo={playerInfo}
						/>
						<CountryCard
							country={countries[3]}
							color={colors[countries[3]]}
							darkColor={darkColors[countries[3]]}
							info={clean(countryInfo[countries[3]])}
							playerInfo={playerInfo}
						/>
					</Space>
					<Space size="large" style={{ display: 'flex' }}>
						<CountryCard
							country={countries[4]}
							color={colors[countries[4]]}
							darkColor={darkColors[countries[4]]}
							info={clean(countryInfo[countries[4]])}
							playerInfo={playerInfo}
						/>
						<CountryCard
							country={countries[5]}
							color={colors[countries[5]]}
							darkColor={darkColors[countries[5]]}
							info={clean(countryInfo[countries[5]])}
							playerInfo={playerInfo}
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
							player={playersOrdered[0]}
							countryColors={order(darkColors)}
							info={clean(playerInfo[playersOrdered[0]])}
							countryInfos={countryInfo}
						/>
						<PlayerCard
							player={playersOrdered[1]}
							countryColors={order(darkColors)}
							info={clean(playerInfo[playersOrdered[1]])}
							countryInfos={countryInfo}
						/>
					</Space>
					<Space size="large" style={{ display: 'flex' }}>
						<PlayerCard
							player={playersOrdered[2]}
							countryColors={order(darkColors)}
							info={clean(playerInfo[playersOrdered[2]])}
							countryInfos={countryInfo}
						/>
						<PlayerCard
							player={playersOrdered[3]}
							countryColors={order(darkColors)}
							info={clean(playerInfo[playersOrdered[3]])}
							countryInfos={countryInfo}
						/>
					</Space>
					<Space size="large" style={{ display: 'flex' }}>
						<PlayerCard
							player={playersOrdered[4]}
							countryColors={order(darkColors)}
							info={clean(playerInfo[playersOrdered[4]])}
							countryInfos={countryInfo}
						/>
						<PlayerCard
							player={playersOrdered[5]}
							countryColors={order(darkColors)}
							info={clean(playerInfo[playersOrdered[5]])}
							countryInfos={countryInfo}
						/>
					</Space>
				</Space>
			</Card>
		</div>
	);
}

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
				<mark style={{ backgroundColor: props.darkColor, color: 'white', borderRadius: 3 }}>{availStock[i]}</mark>
			);
			t.push(<span>&nbsp;</span>);
		}
		return t;
	}

	function formatOwnership() {
		let playerInfoData = props.playerInfo || {};
		let owners = {};
		for (let player in playerInfoData) {
			let stock = playerInfoData[player].stock || [];
			for (let s of stock) {
				if (s.country === props.country) {
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

	function leadershipText(info) {
		if (!info.gov) {
			return '';
		}
		if (info.gov === 'dictatorship') {
			return info.leadership[0];
		}
		if (info.gov === 'democracy') {
			return info.leadership[0] + ' / ' + info.leadership[1];
		}
	}

	return (
		<Card
			hoverable={true}
			style={{
				width: props.w || '20vw',
				height: props.h || '24vh',
				lineHeight: '0.8',
				minHeight: props.h || 185,
				minWidth: 250,
				borderRadius: props.br || 5,
				borderColor: props.b,
				backgroundColor: props.bg,
				marginLeft: props.ml,
			}}
			headStyle={{ backgroundColor: props.color, borderTopLeftRadius: 5, borderTopRightRadius: 5 }}
			title={props.country}
			bodyStyle={{ padding: props.p || '20px 20px 20px 20px' }}
		>
			<p style={{ textAlign: 'left' }}>
				&nbsp;&nbsp;Points (Last Tax):
				<span style={{ float: 'right' }}>
					{props.info.points} ({props.info.lastTax})&nbsp;&nbsp;
				</span>
			</p>
			<p style={{ textAlign: 'left' }}>
				&nbsp;&nbsp;Treasury:
				<span style={{ float: 'right' }}>${twoDec(props.info.money)}&nbsp;&nbsp;</span>
			</p>
			<p style={{ textAlign: 'left' }}>
				&nbsp;&nbsp;Wheel Position:
				<span style={{ float: 'right' }}>{props.info.wheelSpot}&nbsp;&nbsp;</span>
			</p>
			<p style={{ textAlign: 'left' }}>
				&nbsp;&nbsp;Government:
				<span style={{ float: 'right' }}>{leadershipText(props.info)}&nbsp;&nbsp;</span>
			</p>
			<p style={{ textAlign: 'left' }}>
				&nbsp;&nbsp;Available:
				<span style={{ float: 'right', color: props.color }}>{formatAvailStock(clean(props.info.availStock))}</span>
			</p>
			<p style={{ textAlign: 'left', fontSize: 12 }}>&nbsp;&nbsp;Owned: {formatOwnership()}</p>
		</Card>
	);
}

function PlayerCard(props) {
	const context = useContext(UserContext);
	const [countries, setCountries] = useState(['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia']);

	useEffect(() => {
		async function fetchCountries() {
			let c = await helper.getCountries(context);
			setCountries(c);
		}
		fetchCountries();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function formatStock(stock) {
		let s = [[], [], [], [], [], []];
		for (let i in stock) {
			let index = countries.indexOf(stock[i].country);
			s[index].push(stock[i].stock);
		}
		let t = [];
		for (let i = 0; i < s.length; i++) {
			for (let j = 0; j < s[i].length; j++) {
				t.push(
					<Tooltip title={countries[i]} mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
						<mark
							style={{
								backgroundColor: props.countryColors[i],
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

	function investor(info, player) {
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
				<mark style={{ backgroundColor: '#424242', color: 'white', borderRadius: 3 }}>{props.info.scoreModifier}</mark>
			);
			t.push(<span>&nbsp;</span>);
		}
		return t;
	}

	function sToTime(s) {
		if (!s && s !== 0) return '0:00';
		let secs = s % 60;
		let mins = Math.floor(s / 60);

		return mins + ':' + secs.toString().padStart(2, '0');
	}

	if (props.player) {
		return (
			<Card
				hoverable={true}
				style={{
					width: props.w || '20vw',
					height: props.h || '24vh',
					lineHeight: '0.8',
					minHeight: props.h || 185,
					minWidth: props.w || 250,
					borderRadius: props.br || 5,
					backgroundColor: props.bg,
					borderColor: props.b,
				}}
				headStyle={{ backgroundColor: '#525252', borderTopLeftRadius: 5, borderTopRightRadius: 5 }}
				title={
					<div>
						{props.player}
						<span style={{ float: 'right', fontSize: 14 }}>{sToTime(props.info.banked)}</span>
					</div>
				}
				bodyStyle={{ padding: props.p || '20px 20px 20px 20px' }}
			>
				<p style={{ textAlign: 'left' }}>
					&nbsp;&nbsp;Money:
					<span style={{ float: 'right' }}>${twoDec(props.info.money)}&nbsp;&nbsp;</span>
				</p>
				<p style={{ textAlign: 'left' }}>
					&nbsp;&nbsp;Current Score:
					<span style={{ float: 'right' }}>
						{helper.computeScore(props.info, props.countryInfos).toFixed(2)}&nbsp;&nbsp;
					</span>
				</p>
				<p style={{ textAlign: 'left' }}>
					&nbsp;&nbsp;Cash Value:
					<span style={{ float: 'right' }}>
						{helper.computeCash(props.info, props.countryInfos).toFixed(2)}&nbsp;&nbsp;
					</span>
				</p>
				<p style={{ textAlign: 'left' }}>
					&nbsp;&nbsp;Stock:
					<span style={{ float: 'right' }}>{formatStock(props.info.stock)}</span>
				</p>
				<p style={{ textAlign: 'left' }}>{investor(props.info, props.player)}</p>
			</Card>
		);
	} else {
		return null;
	}
}

export { StateApp, CountryCard, PlayerCard };
