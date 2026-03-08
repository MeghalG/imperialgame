import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './App.css';

import { Card, Space, Tooltip } from 'antd';
import { DollarCircleFilled, DollarCircleOutlined, FlagFilled, FlagOutlined } from '@ant-design/icons';
import UserContext from './UserContext.js';
import * as stateAPI from './backendFiles/stateAPI.js';
import * as helper from './backendFiles/helper.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';
import { getCountryColorPalette } from './countryColors.js';

function PlayerApp() {
	const context = useContext(UserContext);
	const [countries, setCountries] = useState([]);
	const [countryInfo, setCountryInfo] = useState({});
	const [playerInfo, setPlayerInfo] = useState({});
	const [playersOrdered, setPlayersOrdered] = useState([]);
	const turnRef = useRef(null);
	const contextRef = useRef(context);
	contextRef.current = context;

	const reinitialize = useCallback(async () => {
		let [countriesData, country, player, order] = await Promise.all([
			helper.getCountries(contextRef.current),
			stateAPI.getCountryInfo(contextRef.current),
			stateAPI.getPlayerInfo(contextRef.current),
			helper.getPlayersInOrder(contextRef.current),
		]);
		setCountries(countriesData);
		setCountryInfo(country);
		setPlayerInfo(player);
		setPlayersOrdered(order);
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

	let darkColors = getCountryColorPalette(context.colorblindMode).dark;
	return (
		<div style={{ display: 'flex' }}>
			<Space size="small" direction="vertical">
				<PlayerCard
					player={playersOrdered[0]}
					countryColors={darkColors}
					info={clean(playerInfo[playersOrdered[0]])}
					countryInfos={countryInfo}
				/>
				<PlayerCard
					player={playersOrdered[1]}
					countryColors={darkColors}
					info={clean(playerInfo[playersOrdered[1]])}
					countryInfos={countryInfo}
				/>
				<PlayerCard
					player={playersOrdered[2]}
					countryColors={darkColors}
					info={clean(playerInfo[playersOrdered[2]])}
					countryInfos={countryInfo}
				/>
				<PlayerCard
					player={playersOrdered[3]}
					countryColors={darkColors}
					info={clean(playerInfo[playersOrdered[3]])}
					countryInfos={countryInfo}
				/>
				<PlayerCard
					player={playersOrdered[4]}
					countryColors={darkColors}
					info={clean(playerInfo[playersOrdered[4]])}
					countryInfos={countryInfo}
				/>
				<PlayerCard
					player={playersOrdered[5]}
					countryColors={darkColors}
					info={clean(playerInfo[playersOrdered[5]])}
					countryInfos={countryInfo}
				/>
			</Space>
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

function PlayerCard(props) {
	const context = useContext(UserContext);
	const [countries, setCountries] = useState(['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia']);
	const [activeTooltip, setActiveTooltip] = useState(null);

	useEffect(() => {
		async function fetchCountries() {
			let c = await helper.getCountries(context);
			setCountries(c);
		}
		fetchCountries();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function showTooltip(id) {
		setActiveTooltip(id);
	}

	function hideTooltip(id) {
		if (activeTooltip === id) {
			setActiveTooltip(null);
		}
	}

	function tip(id, title, content) {
		return (
			<Tooltip
				title={title}
				visible={activeTooltip === id}
				onVisibleChange={(v) => (v ? showTooltip(id) : hideTooltip(id))}
				destroyTooltipOnHide
			>
				{content}
			</Tooltip>
		);
	}

	function formatStock(stock) {
		let s = [[], [], [], [], [], []];
		for (let i in stock) {
			let index = countries.indexOf(stock[i].country);
			s[index].push(stock[i].stock);
		}
		let t = [];
		for (let i = 0; i < s.length; i++) {
			for (let j = 0; j < s[i].length; j++) {
				let tipId = 'stock-' + i + '-' + j;
				t.push(
					tip(
						tipId,
						countries[i],
						<mark
							style={{
								backgroundColor: props.countryColors[countries[i]],
								color: 'white',
								borderRadius: 2,
								cursor: 'default',
							}}
						>
							{s[i][j]}
						</mark>
					)
				);
				t.push(<span>&nbsp;</span>);
			}
		}
		return t;
	}

	function gov() {
		let brightColors = getCountryColorPalette(context.colorblindMode).bright;
		let t = [];
		for (let country in props.countryInfos) {
			if ((props.countryInfos[country].leadership || [])[0] === props.player) {
				t.push(
					tip(
						'leader-' + country,
						country + ' Leader',
						<FlagFilled style={{ fontSize: 16, color: brightColors[country], marginRight: 3 }} />
					)
				);
			}
			if (
				(props.countryInfos[country] || {}).gov === 'democracy' &&
				props.countryInfos[country].leadership[1] === props.player
			) {
				t.push(
					tip(
						'opp-' + country,
						country + ' Opposition',
						<FlagOutlined style={{ fontSize: 16, color: brightColors[country], marginRight: 3 }} />
					)
				);
			}
		}
		return t;
	}

	function investor() {
		let t = [];
		if (props.info.investor) {
			t.push(
				tip(
					'investor',
					'Investor Card',
					<DollarCircleFilled style={{ fontSize: 16, color: '#CCCCCC', marginRight: 3 }} />
				)
			);
		}
		if (props.info.swiss) {
			t.push(
				tip('swiss', 'Swiss', <DollarCircleOutlined style={{ fontSize: 16, color: '#CCCCCC', marginRight: 3 }} />)
			);
		}
		return t;
	}

	if (props.player !== null) {
		return (
			<Card
				hoverable={true}
				size="small"
				style={{ lineHeight: '0.8', minWidth: '100%', backgroundColor: 'black', width: '11vw' }}
				headStyle={{ backgroundColor: '#303030', lineHeight: '1', padding: '0px 10px 0px 10px', minHeight: 0 }}
				title={
					<div>
						{investor()}
						{props.player}
						<span style={{ float: 'right', fontSize: 13 }}>{gov()}</span>
					</div>
				}
				bodyStyle={{ padding: '10px 0px 0px 0px', wordWrap: 'break-word' }}
			>
				<p style={{ textAlign: 'left' }}>&nbsp;&nbsp;${twoDec(props.info.money)}&nbsp;&nbsp;</p>
				<p style={{ textAlign: 'left' }}>&nbsp;&nbsp;{formatStock(props.info.stock)}</p>
			</Card>
		);
	} else {
		return null;
	}
}

export default PlayerApp;
