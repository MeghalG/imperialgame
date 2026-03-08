import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './App.css';
import map from './map.jpg';
import wheel from './wheel.png';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';
import UserContext from './UserContext.js';
import * as mapAPI from './backendFiles/mapAPI.js';
import * as helper from './backendFiles/helper.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';
import { Popover } from 'antd';
import { getCountryColorPalette } from './countryColors.js';

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
						style={{
							position: 'absolute',
							left: seaFactories[i][j][0],
							top: seaFactories[i][j][1],
							width: 50,
							height: 50,
							color: '#13a8a8',
							fontSize: '1.8vw',
						}}
					>
						<i class="fas fa-industry fa"></i>
					</div>
				);
			}
		}
		// land factories
		for (let i = 0; i < landFactories.length; i++) {
			for (let j = 0; j < landFactories[i].length; j++) {
				table.push(
					<div
						style={{
							position: 'absolute',
							left: landFactories[i][j][0],
							top: landFactories[i][j][1],
							width: 50,
							height: 50,
							color: '#8B4513',
							fontSize: '1.8vw',
						}}
					>
						<i class="fas fa-industry fa"></i>
					</div>
				);
			}
		}
		// tax chips
		for (let i = 0; i < taxChips.length; i++) {
			for (let j = 0; j < taxChips[i].length; j++) {
				table.push(
					<div
						style={{
							position: 'absolute',
							left: taxChips[i][j][0],
							top: taxChips[i][j][1],
							width: 50,
							height: 50,
							color: countryColors[countries[i]],
							fontSize: '1.1vw',
						}}
					>
						<i class="fas fa-flag fa"></i>
					</div>
				);
			}
		}
		// units
		for (let i = 0; i < units.length; i++) {
			let t = [];
			for (let j = 0; j < units[i][1].length; j++) {
				for (let k = 0; k < units[i][1][j][0]; k++) {
					t.push(<i style={{ color: countryColors[countries[j]] }} class="fas fa-play fa-rotate-90"></i>);
				}
				for (let k = 0; k < units[i][1][j][1]; k++) {
					t.push(<i style={{ color: countryColors[countries[j]] }} class="fas fa-circle fa"></i>);
				}
				for (let k = 0; k < units[i][1][j][2]; k++) {
					t.push(<i style={{ color: countryColors[countries[j]] }} class="fas fa-plus-circle fa"></i>);
				}
			}
			table.push(
				<div
					style={{
						position: 'absolute',
						left: units[i][0][0],
						top: units[i][0][1],
						width: 100,
						height: 50,
						fontSize: '1vw',
					}}
				>
					{t}
				</div>
			);
		}
		// rondel
		for (let key in rondel) {
			let t = [];
			for (let j = 0; j < rondel[key][1].length; j++) {
				let country = rondel[key][1][j];
				t.push(<i style={{ color: countryColors[country] }} class="fas fa-square fa"></i>);
			}
			table.push(
				<div
					style={{
						position: 'absolute',
						left: rondel[key][0].x,
						top: rondel[key][0].y,
						width: 100,
						height: 50,
						fontSize: '20',
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
			t.push(<mark style={{ backgroundColor: color, color: 'white', borderRadius: 3 }}>{availStockArr[i]}</mark>);
			t.push(<span>&nbsp;</span>);
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
		let d = [];
		let t = [];
		for (let i = 0; i < 26; i++) {
			t.push(
				<div
					style={{
						width: '3.846%',
						height: 35,
						backgroundColor: '#303030',
						display: 'inline-block',
						textAlign: 'center',
						verticalAlign: 'top',
						borderRight: '1px solid black',
						lineHeight: 2.5,
					}}
				>
					{' '}
					{i}{' '}
				</div>
			);
			if (points[i + 1]) {
				for (let j in points[i + 1]) {
					let country = points[i + 1][j];
					let h = parseInt(j) * 1.2 + 1 + '%';
					t.push(
						<Popover
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
							<div
								style={{
									display: 'inline',
									verticalAlign: 'top',
									position: 'absolute',
									backgroundColor: iconColors[country],
									width: 15,
									height: 15,
									borderRadius: '50%',
									fontSize: 10,
									textAlign: 'center',
									color: '#FFFFFF',
									marginLeft: '0.9%',
									marginTop: h,
								}}
							></div>
						</Popover>
					);
				}
			}
		}
		d.push(<div style={{ display: 'inline' }}>{t}</div>);

		return d;
	}

	return (
		<div style={{ height: '82vh' }}>
			<Zoom>
				<img src={map} alt="Map" style={{ maxWidth: '100%', maxHeight: '82vh' }} />
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
				<img
					src={wheel}
					alt="Wheel"
					style={{ width: '17.5%', height: '23%', position: 'absolute', left: '2%', top: '3%' }}
				/>
				{buildComponents()}
			</Zoom>
			{makePoints()}
		</div>
	);
}

export default MapApp;
