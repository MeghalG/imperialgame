import React, { useState, useContext, useEffect } from 'react';
import './App.css';
import UserContext from './UserContext.js';
import { Collapse, Divider, Alert } from 'antd';
import * as miscAPI from './backendFiles/miscAPI.js';

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

	function buildComponents() {
		if (!gameState) {
			return null;
		}

		switch (gameState.mode) {
			case 'bid':
			case 'buy':
				return <Divider style={{ margin: '8px 0' }} />;
			case 'buy-bid': {
				let bids = (gameState.bidBuyOrder || []).map((x) => [x, gameState.playerInfo[x].bid]);
				return (
					<div>
						<Collapse ghost style={{ marginLeft: -18, marginBottom: -20, marginTop: -10 }}>
							<Panel header="Bids" key="1">
								<div className="imp-bid-list">
									{bids.map((bid) => (
										<div key={bid[0]} className="imp-bid-list__row">
											<span>{bid[0]}</span>
											<span>${bid[1]}</span>
										</div>
									))}
								</div>
							</Panel>
						</Collapse>
						<Divider style={{ margin: '8px 0' }} />
					</div>
				);
			}
			case 'proposal-opp':
			case 'proposal':
			case 'vote': {
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
						<Divider style={{ margin: '8px 0' }} />
					</div>
				);
			}
			default:
				break;
		}
		return '';
	}

	return <div>{buildComponents()}</div>;
}

export default StaticTurnApp;
