import React, { useState, useContext, useEffect } from 'react';
import './App.css';
import UserContext from './UserContext.js';
import { Card, Collapse, Divider, Alert } from 'antd';
import { CountryCard, PlayerCard } from './StateApp.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import { getCountryColorPalette } from './countryColors.js';

const { Panel } = Collapse;

function StaticTurnApp() {
	const context = useContext(UserContext);
	const [gameState, setGameState] = useState(null);

	useEffect(() => {
		async function getGameState() {
			let gs = await miscAPI.getGameState(context);
			setGameState(gs);
		}
		getGameState();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function clean(x) {
		if (x) {
			return x;
		} else {
			return {};
		}
	}

	function buildComponents() {
		if (!gameState) {
			return null;
		}

		let palette = getCountryColorPalette(context.colorblindMode);
		let colors = palette.dark;
		let countryColors = ['Austria', 'Italy', 'France', 'England', 'Germany', 'Russia'].map((c) => palette.dark[c]);
		let country = gameState.countryUp;
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
						info={clean(gameState.playerInfo[context.name])}
						countryInfos={gameState.countryInfo}
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
					info={clean(gameState.countryInfo[country])}
				/>
			</Panel>
		);
		switch (gameState.mode) {
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
				let bids = (gameState.bidBuyOrder || []).map((x) => [x, gameState.playerInfo[x].bid]);
				let t = [];
				for (let bid of bids) {
					t.push(
						<p style={{ display: 'flex', justifyContent: 'space-between' }}>
							<span>&nbsp;&nbsp;{bid[0]}:</span>
							<span>${bid[1]}&nbsp;&nbsp;</span>
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
				if (gameState.mode === 'proposal-opp') {
					pr = (
						<Alert
							style={{ marginBottom: 10, width: '100%' }}
							message={gameState.history[gameState.history.length - 1]}
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
			default:
				break;
		}
		return '';
	}

	return <div>{buildComponents()}</div>;
}

export default StaticTurnApp;
