import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './App.css';
import BidApp from './BidApp.js';
import BuyBidApp from './BuyBidApp.js';
import BuyApp from './BuyApp.js';
import ProposalApp from './ProposalApp.js';
import ProposalAppOpp from './ProposalAppOpp.js';
import VoteApp from './VoteApp.js';
import GameOverApp from './GameOverApp.js';
import ManeuverPlannerApp from './ManeuverPlannerApp.js';
import PeaceVoteApp from './PeaceVoteApp.js';
import StaticTurnApp from './StaticTurnApp.js';
import { Card, Popconfirm } from 'antd';
import UserContext from './UserContext.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';

function TurnApp() {
	const context = useContext(UserContext);
	const [turnTitle, setTurnTitle] = useState('');
	const [mode, setMode] = useState('');
	const [turnID, setTurnID] = useState('');
	const [undoable, setUndoable] = useState(false);
	const [trackedName, setTrackedName] = useState('');
	const turnRef = useRef(null);
	const contextRef = useRef(context);
	contextRef.current = context;

	const newTurn = useCallback(async () => {
		let result = await turnAPI.getTurnState(contextRef.current);
		setTurnTitle(result.turnTitle);
		setMode(result.mode);
		setUndoable(result.undoable);
		setTurnID(result.turnID);
	}, []);

	useEffect(() => {
		newTurn();
		turnRef.current = database.ref('games/' + contextRef.current.game + '/turnID');
		turnRef.current.on('value', async (dataSnapshot) => {
			invalidateIfStale(contextRef.current.game, dataSnapshot.val());
			newTurn();
		});
		return () => {
			if (turnRef.current) {
				turnRef.current.off();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (context.name !== trackedName) {
			setTrackedName(context.name);
			newTurn();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [context.name]);

	async function undo() {
		await submitAPI.undo(context);
	}

	function undoButton() {
		if (!undoable) {
			return;
		}
		return (
			<Popconfirm title="Sure you want to undo your last move?" onConfirm={() => undo()} okText="Yes" cancelText="No">
				<span style={{ float: 'right', fontSize: 14 }}>
					<span style={{ color: '#177ddc', cursor: 'pointer' }}>Undo</span>
				</span>
			</Popconfirm>
		);
	}

	return (
		<div style={{ height: '100%' }}>
			<StaticTurnApp key={turnID} />
			<Card
				style={{ height: '100%', overflow: 'auto' }}
				title={
					<div>
						{turnTitle} {undoButton()}{' '}
					</div>
				}
			>
				<DisplayMode mode={mode} turnID={turnID} />
			</Card>
		</div>
	);
}

function DisplayMode(props) {
	switch (props.mode) {
		case 'bid':
			return <BidApp />;
		case 'buy-bid':
			return <BuyBidApp />;
		case 'buy':
			return <BuyApp />;
		case 'proposal':
			return <ProposalApp />;
		case 'proposal-opp':
			return <ProposalAppOpp />;
		case 'vote':
			return <VoteApp />;
		case 'continue-man':
			return <ManeuverPlannerApp />;
		case 'peace-vote':
			return <PeaceVoteApp />;
		case 'game-over':
			return <GameOverApp />;
		default:
			return null;
	}
}

export default TurnApp;
