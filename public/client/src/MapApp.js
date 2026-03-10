import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './App.css';
import './MapOverlay.css';
import map from './map.jpg';
import UserContext from './UserContext.js';
import * as mapAPI from './backendFiles/mapAPI.js';
import * as helper from './backendFiles/helper.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';
import { Popover } from 'antd';
import { getCountryColorPalette } from './countryColors.js';
import TerritoryHotspotLayer from './TerritoryHotspotLayer.js';
import UnitMarkerLayer from './UnitMarkerLayer.js';
import SvgRondel from './SvgRondel.js';
import MovementArrowLayer from './MovementArrowLayer.js';

const COUNTRY_ABBREV = { Austria: 'AT', Italy: 'IT', France: 'FR', England: 'EN', Germany: 'DE', Russia: 'RU' };

function MapApp() {
	const context = useContext(UserContext);
	const [countries, setCountries] = useState([]);
	const [seaFactories, setSeaFactories] = useState([]);
	const [landFactories, setLandFactories] = useState([]);
	const [taxChips, setTaxChips] = useState([]);
	const [units, setUnits] = useState([]);
	const [points, setPoints] = useState({});
	const [money, setMoney] = useState({});
	const [availStock, setAvailStock] = useState({});
	const [lastTax, setLastTax] = useState({});
	const [currentTax, setCurrentTax] = useState({});
	const [rondel, setRondel] = useState();
	const [, setVis] = useState({
		Austria: undefined,
		Italy: null,
		France: false,
		England: null,
		Germany: null,
		Russia: null,
	});
	const turnRef = useRef(null);
	const contextRef = useRef(context);
	contextRef.current = context;

	function getColors() {
		let palette = getCountryColorPalette(context.colorblindMode);
		return { countryColors: palette.map, iconColors: palette.bright };
	}

	const getMapItems = useCallback(async () => {
		let [sea, land, unitsData, rondelData, tax, pointsData, moneyData, availStockData, lastTaxData, currentTaxData] =
			await Promise.all([
				mapAPI.getSeaFactories(contextRef.current),
				mapAPI.getLandFactories(contextRef.current),
				mapAPI.getUnits(contextRef.current),
				mapAPI.getRondel(contextRef.current),
				mapAPI.getTaxChips(contextRef.current),
				mapAPI.getPoints(contextRef.current),
				mapAPI.getMoney(contextRef.current),
				mapAPI.getAvailStock(contextRef.current),
				mapAPI.getLastTax(contextRef.current),
				mapAPI.getCurrentTax(contextRef.current),
			]);
		setSeaFactories(sea);
		setLandFactories(land);
		setUnits(unitsData);
		setRondel(rondelData);
		setTaxChips(tax);
		setPoints(pointsData);
		setMoney(moneyData);
		setAvailStock(availStockData);
		setLastTax(lastTaxData);
		setCurrentTax(currentTaxData);
	}, []);

	useEffect(() => {
		async function init() {
			let countriesData = await helper.getCountries(contextRef.current);
			setCountries(countriesData);
			getMapItems();
			turnRef.current = database.ref('games/' + contextRef.current.game + '/turnID');
			turnRef.current.on('value', (dataSnapshot) => {
				invalidateIfStale(contextRef.current.game, dataSnapshot.val());
				getMapItems();
			});
		}
		init();
		return () => {
			if (turnRef.current) {
				turnRef.current.off();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function buildComponents() {
		let { countryColors } = getColors();
		let table = [];
		// sea factories
		for (let i = 0; i < seaFactories.length; i++) {
			for (let j = 0; j < seaFactories[i].length; j++) {
				table.push(
					<div
						key={'sf-' + i + '-' + j}
						style={{
							position: 'absolute',
							left: seaFactories[i][j][0],
							top: seaFactories[i][j][1],
							width: 50,
							height: 50,
							color: '#13a8a8',
							fontSize: '1.8vw',
							pointerEvents: 'none',
						}}
					>
						<i className="fas fa-industry fa"></i>
					</div>
				);
			}
		}
		// land factories
		for (let i = 0; i < landFactories.length; i++) {
			for (let j = 0; j < landFactories[i].length; j++) {
				table.push(
					<div
						key={'lf-' + i + '-' + j}
						style={{
							position: 'absolute',
							left: landFactories[i][j][0],
							top: landFactories[i][j][1],
							width: 50,
							height: 50,
							color: '#8B4513',
							fontSize: '1.8vw',
							pointerEvents: 'none',
						}}
					>
						<i className="fas fa-industry fa"></i>
					</div>
				);
			}
		}
		// tax chips
		for (let i = 0; i < taxChips.length; i++) {
			for (let j = 0; j < taxChips[i].length; j++) {
				table.push(
					<div
						key={'tc-' + i + '-' + j}
						style={{
							position: 'absolute',
							left: taxChips[i][j][0],
							top: taxChips[i][j][1],
							width: 50,
							height: 50,
							color: countryColors[countries[i]],
							fontSize: '1.1vw',
							pointerEvents: 'none',
						}}
					>
						<i className="fas fa-flag fa"></i>
					</div>
				);
			}
		}
		// units
		for (let i = 0; i < units.length; i++) {
			let t = [];
			for (let j = 0; j < units[i][1].length; j++) {
				for (let k = 0; k < units[i][1][j][0]; k++) {
					t.push(
						<i
							key={'fl-' + j + '-' + k}
							style={{ color: countryColors[countries[j]] }}
							className="fas fa-play fa-rotate-90"
						></i>
					);
				}
				for (let k = 0; k < units[i][1][j][1]; k++) {
					t.push(
						<i
							key={'ha-' + j + '-' + k}
							style={{ color: countryColors[countries[j]] }}
							className="fas fa-circle fa"
						></i>
					);
				}
				for (let k = 0; k < units[i][1][j][2]; k++) {
					t.push(
						<i
							key={'pa-' + j + '-' + k}
							style={{ color: countryColors[countries[j]] }}
							className="fas fa-plus-circle fa"
						></i>
					);
				}
			}
			table.push(
				<div
					key={'unit-' + i}
					style={{
						position: 'absolute',
						left: units[i][0][0],
						top: units[i][0][1],
						width: 100,
						height: 50,
						fontSize: '1vw',
						pointerEvents: 'none',
					}}
				>
					{t}
				</div>
			);
		}
		return <div style={{ textShadow: '-0.5px 0 #000, 0 0.5px #255, 0.5px 0 #000, 0 -0.5px #000' }}> {table} </div>;
	}

	function formatAvailStock(availStockArr, color) {
		let t = [];
		for (let i = 0; i < availStockArr.length; i++) {
			t.push(
				<mark key={i} style={{ backgroundColor: color, color: 'white', borderRadius: 3 }}>
					{availStockArr[i]}
				</mark>
			);
			t.push(<span key={'s' + i}>&nbsp;</span>);
		}
		return t;
	}

	function clicked(country) {
		setVis((prevState) => ({
			...prevState,
			[country]: !prevState[country],
		}));
	}

	function makePoints() {
		let { countryColors, iconColors } = getColors();
		let t = [];
		for (let i = 0; i < 26; i++) {
			let isMilestone = i > 0 && i % 5 === 0;
			let countriesHere = points[i + 1] || [];

			t.push(
				<div
					key={'vp-' + i}
					className={
						'imp-vp-track__cell' +
						(isMilestone ? ' imp-vp-track__cell--milestone' : '') +
						(countriesHere.length > 0 ? ' imp-vp-track__cell--occupied' : '')
					}
				>
					<span className="imp-vp-track__number">{i}</span>
					<div className="imp-vp-track__markers">
						{countriesHere.map((country, j) => (
							<Popover
								key={'vp-pop-' + i + '-' + j}
								dataHtml="true"
								onClick={() => clicked(country)}
								content={
									<div style={{ lineHeight: 0.8 }}>
										<p>${(money[country] || 0).toFixed(2).toString()}</p>
										<p>Last Tax: {lastTax[country]}</p>
										<p>Current Tax: {currentTax[country]}</p>
										<p>{formatAvailStock(availStock[country] || [], countryColors[country])}</p>
									</div>
								}
							>
								<div className="imp-vp-track__marker" style={{ backgroundColor: iconColors[country] }}>
									<span className="imp-vp-track__marker-text">
										{COUNTRY_ABBREV[country] || country.slice(0, 2).toUpperCase()}
									</span>
								</div>
							</Popover>
						))}
					</div>
				</div>
			);
		}
		return t;
	}

	let vpTrackPortal = document.getElementById('imp-vp-track-portal');
	let vpTrack = <div className="imp-vp-track">{makePoints()}</div>;

	return (
		<React.Fragment>
			<div style={{ position: 'relative', display: 'inline-block', maxHeight: '82vh' }}>
				<img src={map} alt="Map" style={{ display: 'block', maxWidth: '100%', maxHeight: '82vh' }} />
				<mark
					style={{
						backgroundColor: 'black',
						color: 'white',
						position: 'absolute',
						fontSize: 7,
						lineHeight: 1,
						transform: 'rotate(335deg)',
						left: '53%',
						top: '39.5%',
					}}
				>
					{' '}
					Mountain Range{' '}
				</mark>
				<SvgRondel rondelData={rondel} colorblindMode={context.colorblindMode} />
				{buildComponents()}
				<TerritoryHotspotLayer />
				<UnitMarkerLayer />
				<MovementArrowLayer />
			</div>
			{vpTrackPortal ? ReactDOM.createPortal(vpTrack, vpTrackPortal) : vpTrack}
		</React.Fragment>
	);
}

export default MapApp;
