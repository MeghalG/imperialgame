import React from 'react';
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

class MapApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			fullscreen: true,
			countries: [],
			seaFactories: [],
			landFactories: [],
			taxChips: [],
			units: [],
			points: {},
			money: {},
			availStock: {},
			lastTax: {},
			currentTax: {},
			vis: {
				Austria: undefined,
				Italy: null,
				France: false,
				England: null,
				Germany: null,
				Russia: null,
			},
		};
	}
	getColors() {
		let palette = getCountryColorPalette(this.context.colorblindMode);
		return { countryColors: palette.map, iconColors: palette.bright };
	}
	async componentDidMount() {
		let countries = await helper.getCountries(this.context);
		this.setState({ countries: countries });
		this.getMapItems();
		this.turnRef = database.ref('games/' + this.context.game + '/turnID');
		this.turnRef.on('value', (dataSnapshot) => {
			invalidateIfStale(this.context.game, dataSnapshot.val());
			this.getMapItems();
		});
	}
	componentWillUnmount() {
		if (this.turnRef) {
			this.turnRef.off();
		}
	}
	async getMapItems() {
		let [sea, land, units, rondel, tax, points, money, availStock, lastTax, currentTax] = await Promise.all([
			mapAPI.getSeaFactories(this.context),
			mapAPI.getLandFactories(this.context),
			mapAPI.getUnits(this.context),
			mapAPI.getRondel(this.context),
			mapAPI.getTaxChips(this.context),
			mapAPI.getPoints(this.context),
			mapAPI.getMoney(this.context),
			mapAPI.getAvailStock(this.context),
			mapAPI.getLastTax(this.context),
			mapAPI.getCurrentTax(this.context),
		]);
		this.setState({
			seaFactories: sea,
			landFactories: land,
			units: units,
			rondel: rondel,
			taxChips: tax,
			points: points,
			money: money,
			availStock: availStock,
			lastTax: lastTax,
			currentTax: currentTax,
		});
	}
	buildComponents = () => {
		let { countryColors } = this.getColors();
		let table = [];
		// sea factories
		for (let i = 0; i < this.state.seaFactories.length; i++) {
			for (let j = 0; j < this.state.seaFactories[i].length; j++) {
				table.push(
					<div
						style={{
							position: 'absolute',
							left: this.state.seaFactories[i][j][0],
							top: this.state.seaFactories[i][j][1],
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
		for (let i = 0; i < this.state.landFactories.length; i++) {
			for (let j = 0; j < this.state.landFactories[i].length; j++) {
				table.push(
					<div
						style={{
							position: 'absolute',
							left: this.state.landFactories[i][j][0],
							top: this.state.landFactories[i][j][1],
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
		for (let i = 0; i < this.state.taxChips.length; i++) {
			for (let j = 0; j < this.state.taxChips[i].length; j++) {
				table.push(
					<div
						style={{
							position: 'absolute',
							left: this.state.taxChips[i][j][0],
							top: this.state.taxChips[i][j][1],
							width: 50,
							height: 50,
							color: countryColors[this.state.countries[i]],
							fontSize: '1.1vw',
						}}
					>
						<i class="fas fa-flag fa"></i>
					</div>
				);
			}
		}
		// units
		for (let i = 0; i < this.state.units.length; i++) {
			let t = [];
			for (let j = 0; j < this.state.units[i][1].length; j++) {
				for (let k = 0; k < this.state.units[i][1][j][0]; k++) {
					t.push(<i style={{ color: countryColors[this.state.countries[j]] }} class="fas fa-play fa-rotate-90"></i>);
				}
				for (let k = 0; k < this.state.units[i][1][j][1]; k++) {
					t.push(<i style={{ color: countryColors[this.state.countries[j]] }} class="fas fa-circle fa"></i>);
				}
				for (let k = 0; k < this.state.units[i][1][j][2]; k++) {
					t.push(<i style={{ color: countryColors[this.state.countries[j]] }} class="fas fa-plus-circle fa"></i>);
				}
			}
			table.push(
				<div
					style={{
						position: 'absolute',
						left: this.state.units[i][0][0],
						top: this.state.units[i][0][1],
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
		for (let key in this.state.rondel) {
			let t = [];
			for (let j = 0; j < this.state.rondel[key][1].length; j++) {
				let country = this.state.rondel[key][1][j];
				t.push(
					//<Popover dataHtml="true" content={<div style={{lineHeight:0.8}}>
					//                            <p>${(this.state.money[country] || 0).toFixed(2).toString()}</p>
					//                            <p>Last Tax: {this.state.lastTax[country]}</p>
					//                            <p>Current Tax: {this.state.currentTax[country]}</p>
					//                            <p>{this.formatAvailStock((this.state.availStock[country] || []), countryColors[country])}</p>
					//                        </div>} >
					//    <div style={{backgroundColor:this.state.iconColors[country],
					//                width:15, height:15, borderRadius:"50%", fontSize:10, textAlign:"center", color:"#FFFFFF", marginRight:3
					//        }}>
					//    </div>
					//</Popover>
					<i style={{ color: countryColors[country] }} class="fas fa-square fa"></i>
				);
			}
			table.push(
				<div
					style={{
						position: 'absolute',
						left: this.state.rondel[key][0].x,
						top: this.state.rondel[key][0].y,
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
	};
	formatAvailStock(availStock, color) {
		let t = [];
		for (let i = 0; i < availStock.length; i++) {
			t.push(<mark style={{ backgroundColor: color, color: 'white', borderRadius: 3 }}>{availStock[i]}</mark>);
			t.push(<span>&nbsp;</span>);
		}
		return t;
	}
	clicked(country) {
		this.setState((prevState) => ({
			vis: { ...prevState.vis, [country]: !prevState.vis[country] },
		}));
	}
	makePoints() {
		let { countryColors, iconColors } = this.getColors();
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
			if (this.state.points[i + 1]) {
				for (let j in this.state.points[i + 1]) {
					let country = this.state.points[i + 1][j];
					let h = parseInt(j) * 1.2 + 1 + '%';
					t.push(
						<Popover
							dataHtml="true"
							onClick={() => this.clicked(country)}
							content={
								<div style={{ lineHeight: 0.8 }}>
									<p>${(this.state.money[country] || 0).toFixed(2).toString()}</p>
									<p>Last Tax: {this.state.lastTax[country]}</p>
									<p>Current Tax: {this.state.currentTax[country]}</p>
									<p>{this.formatAvailStock(this.state.availStock[country] || [], countryColors[country])}</p>
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

	render() {
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
					{this.buildComponents()}
				</Zoom>
				{this.makePoints()}
			</div>
		);
	}
}
MapApp.contextType = UserContext;

export default MapApp;
