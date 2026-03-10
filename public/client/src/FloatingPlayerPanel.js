import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './MapOverlay.css';
import { Tooltip } from 'antd';
import { DollarCircleFilled, DollarCircleOutlined, FlagFilled, FlagOutlined } from '@ant-design/icons';
import UserContext from './UserContext.js';
import * as stateAPI from './backendFiles/stateAPI.js';
import * as helper from './backendFiles/helper.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';
import { getCountryColorPalette } from './countryColors.js';

function FloatingPlayerPanel() {
	const context = useContext(UserContext);
	const [collapsed, setCollapsed] = useState(false);
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
			if (turnRef.current) turnRef.current.off();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	let darkColors = getCountryColorPalette(context.colorblindMode).dark;
	let brightColors = getCountryColorPalette(context.colorblindMode).bright;

	function twoDec(money) {
		if (!money) return '0.00';
		return parseFloat(money).toFixed(2);
	}

	function formatStock(stock) {
		if (!stock) return null;
		let grouped = {};
		for (let entry of stock) {
			if (!grouped[entry.country]) grouped[entry.country] = [];
			grouped[entry.country].push(entry.stock);
		}
		let badges = [];
		for (let country of countries) {
			if (!grouped[country]) continue;
			for (let i = 0; i < grouped[country].length; i++) {
				badges.push(
					<span
						key={country + i}
						className="imp-player-card__stock-badge"
						style={{ backgroundColor: darkColors[country] }}
					>
						{grouped[country][i]}
					</span>
				);
			}
		}
		return badges;
	}

	function buildIcons(player, info) {
		let icons = [];
		if (info.investor) {
			icons.push(
				<Tooltip key="inv" title="Investor Card" mouseLeaveDelay={0}>
					<DollarCircleFilled style={{ fontSize: 12, color: '#CCCCCC' }} />
				</Tooltip>
			);
		}
		if (info.swiss) {
			icons.push(
				<Tooltip key="swiss" title="Swiss Banking" mouseLeaveDelay={0}>
					<DollarCircleOutlined style={{ fontSize: 12, color: '#999' }} />
				</Tooltip>
			);
		}
		for (let country in countryInfo) {
			if ((countryInfo[country].leadership || [])[0] === player) {
				icons.push(
					<Tooltip key={'l-' + country} title={country + ' Leader'} mouseLeaveDelay={0}>
						<FlagFilled style={{ fontSize: 11, color: brightColors[country] }} />
					</Tooltip>
				);
			}
			if ((countryInfo[country] || {}).gov === 'democracy' && (countryInfo[country].leadership || [])[1] === player) {
				icons.push(
					<Tooltip key={'o-' + country} title={country + ' Opposition'} mouseLeaveDelay={0}>
						<FlagOutlined style={{ fontSize: 11, color: brightColors[country] }} />
					</Tooltip>
				);
			}
		}
		return icons;
	}

	function renderPlayer(player) {
		if (!player) return null;
		let info = playerInfo[player] || {};
		return (
			<div key={player} className="imp-player-card">
				<div>
					<span className="imp-player-card__icons">{buildIcons(player, info)}</span>
					<span className="imp-player-card__name">{player}</span>
					<span className="imp-player-card__money">${twoDec(info.money)}</span>
				</div>
				<div className="imp-player-card__stock">{formatStock(info.stock)}</div>
			</div>
		);
	}

	return (
		<div className={'imp-player-panel imp-panel imp-fade-in' + (collapsed ? ' imp-player-panel--collapsed' : '')}>
			<div className="imp-panel__header">
				<span>Players</span>
				<button className="imp-panel__collapse-btn" onClick={() => setCollapsed(!collapsed)}>
					<i className={'fas fa-chevron-' + (collapsed ? 'down' : 'up')} style={{ fontSize: 10 }}></i>
				</button>
			</div>
			<div className="imp-player-panel__list">{playersOrdered.map((p) => renderPlayer(p))}</div>
		</div>
	);
}

export default FloatingPlayerPanel;
