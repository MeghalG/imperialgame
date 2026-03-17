import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './App.css';
import './MapOverlay.css';

import { Tooltip } from 'antd';
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
		try {
			let [countriesData, countryInfoData, playerInfoData, playersOrderedData] = await Promise.all([
				helper.getCountries(contextRef.current),
				stateAPI.getCountryInfo(contextRef.current),
				stateAPI.getPlayerInfo(contextRef.current),
				helper.getPlayersInOrder(contextRef.current),
			]);
			setCountries(countriesData || []);
			setCountryInfo(countryInfoData || {});
			setPlayerInfo(playerInfoData || {});
			setPlayersOrdered(playersOrderedData || []);
		} catch (e) {
			console.warn('StateApp: failed to load game info, retrying...', e);
			// Retry once after a short delay (handles race conditions on initial load)
			setTimeout(async () => {
				try {
					let [countriesData, countryInfoData, playerInfoData, playersOrderedData] = await Promise.all([
						helper.getCountries(contextRef.current),
						stateAPI.getCountryInfo(contextRef.current),
						stateAPI.getPlayerInfo(contextRef.current),
						helper.getPlayersInOrder(contextRef.current),
					]);
					setCountries(countriesData || []);
					setCountryInfo(countryInfoData || {});
					setPlayerInfo(playerInfoData || {});
					setPlayersOrdered(playersOrderedData || []);
				} catch (retryErr) {
					console.warn('StateApp: retry also failed', retryErr);
				}
			}, 1000);
		}
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
		<div className="imp-state">
			<div className="imp-state__col">
				{countries.map((c) => (
					<CountryCard
						key={c}
						country={c}
						color={colors[c]}
						darkColor={darkColors[c]}
						info={clean(countryInfo[c])}
						playerInfo={playerInfo}
					/>
				))}
			</div>
			<div className="imp-state__col">
				{playersOrdered.filter(Boolean).map((p) => (
					<PlayerCard
						key={p}
						player={p}
						countryColors={order(darkColors)}
						info={clean(playerInfo[p])}
						countryInfos={countryInfo}
					/>
				))}
			</div>
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
				<span key={i} className="imp-state__badge" style={{ backgroundColor: props.darkColor }}>
					{availStock[i]}
				</span>
			);
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
			if (t.length > 0) t.push(<span key={player + '-sep'}> · </span>);
			t.push(
				<span key={player}>
					{player}: {owners[player].join(', ')}
				</span>
			);
		}
		return t;
	}

	function govText(info) {
		if (!info.gov) return '';
		let prefix = info.gov === 'democracy' ? 'Dem: ' : 'Dict: ';
		if (info.gov === 'dictatorship') return prefix + info.leadership[0];
		if (info.gov === 'democracy') return prefix + info.leadership[0] + ' / ' + info.leadership[1];
		return '';
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
					<div className="imp-state__stat">
						<span className="imp-state__label">Gov</span>
						<span className="imp-state__value">{govText(props.info)}</span>
					</div>
				</div>
				<div className="imp-state__row">
					<span className="imp-state__label">Available</span>
					<span className="imp-state__badges">{formatAvailStock(clean(props.info.availStock))}</span>
				</div>
				<div className="imp-state__row">
					<span className="imp-state__label">Owned</span>
					<span className="imp-state__owned">{formatOwnership()}</span>
				</div>
			</div>
		</div>
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
					<Tooltip
						key={countries[i] + '-' + s[i][j]}
						title={countries[i]}
						mouseLeaveDelay={0}
						mouseEnterDelay={0.15}
						destroyTooltipOnHide
					>
						<span className="imp-state__badge" style={{ backgroundColor: props.countryColors[i], cursor: 'default' }}>
							{s[i][j]}
						</span>
					</Tooltip>
				);
			}
		}
		return t;
	}

	function investor(info, player) {
		let t = [];
		if (info.investor) {
			t.push(
				<span key="investor" className="imp-state__badge" style={{ backgroundColor: '#424242' }}>
					Investor Card
				</span>
			);
		}
		if (info.swiss) {
			t.push(
				<span key="swiss" className="imp-state__badge" style={{ backgroundColor: '#424242' }}>
					Swiss
				</span>
			);
		}
		if (player === 'aok') {
			t.push(
				<span key="bear" className="imp-state__badge" style={{ backgroundColor: '#51361a' }}>
					Bear
				</span>
			);
		}
		if (info.scoreModifier) {
			t.push(
				<span key="modifier" className="imp-state__badge" style={{ backgroundColor: '#424242' }}>
					{props.info.scoreModifier}
				</span>
			);
		}
		return t;
	}

	function sToTime(s) {
		if (!s && s !== 0) return '0:00';
		let secs = s % 60;
		let mins = Math.floor(s / 60);

		return mins + ':' + secs.toString().padStart(2, '0');
	}

	if (!props.player) return null;

	let hasInvestor = props.info.investor;

	return (
		<div className={'imp-state__card' + (hasInvestor ? ' imp-state__card--investor' : '')}>
			<div className="imp-state__card-banner" style={{ background: '#525252' }} />
			<div className="imp-state__card-header" style={{ background: '#525252' }}>
				<span>{props.player}</span>
				<span className="imp-state__card-header-extra">{sToTime(props.info.banked)}</span>
			</div>
			<div className="imp-state__card-body">
				<div className="imp-state__stats">
					<div className="imp-state__stat">
						<span className="imp-state__label">Money</span>
						<span className="imp-state__value imp-state__key-stat imp-state__key-stat--gold">
							${twoDec(props.info.money)}
						</span>
					</div>
					<div className="imp-state__stat">
						<span className="imp-state__label">Score</span>
						<span className="imp-state__value imp-state__key-stat">
							{helper.computeScore(props.info, props.countryInfos).toFixed(2)}
						</span>
					</div>
					<div className="imp-state__stat">
						<span className="imp-state__label">Cash Value</span>
						<span className="imp-state__value">{helper.computeCash(props.info, props.countryInfos).toFixed(2)}</span>
					</div>
				</div>
				<div className="imp-state__row">
					<span className="imp-state__label">Stock</span>
					<span className="imp-state__badges">{formatStock(clean(props.info.stock))}</span>
				</div>
				<div className="imp-state__row imp-state__badges">{investor(props.info, props.player)}</div>
			</div>
		</div>
	);
}

export { StateApp, CountryCard, PlayerCard };
