import React from 'react';
import './App.css';
import BidApp from './BidApp.js';
import BuyBidApp from './BuyBidApp.js';
import BuyApp from './BuyApp.js';
import ProposalApp from './ProposalApp.js';
import ProposalAppOpp from './ProposalAppOpp.js';
import VoteApp from './VoteApp.js';
import GameOverApp from './GameOverApp.js';
import ContinueManeuverApp from './ContinueManeuverApp.js';
import PeaceVoteApp from './PeaceVoteApp.js';
import StaticTurnApp from './StaticTurnApp.js';
import { Card, Popconfirm } from 'antd';
import UserContext from './UserContext.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { database } from './backendFiles/firebase.js';

class TurnApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			name: '',
			turnTitle: '',
			mode: '',
			turnID: '',
			undoable: false,
		};
	}

	async newTurn() {
		let turnTitle = await turnAPI.getTurnTitle(this.context);
		let mode = await turnAPI.getMode(this.context);
		let undoable = await turnAPI.undoable(this.context);
		let turnID = await turnAPI.getTurnID(this.context);
		this.setState({ turnTitle: turnTitle, mode: mode, undoable: undoable, turnID: turnID });
	}

	async componentDidMount() {
		this.newTurn();
		this.turnRef = database.ref('games/' + this.context.game + '/turnID');
		this.turnRef.on('value', async (dataSnapshot) => {
			let sameTurn = await database.ref('games/' + this.context.game + '/sameTurn').once('value');
			sameTurn = sameTurn.val();
			let myTurn = await database
				.ref('games/' + this.context.game + '/playerInfo/' + this.context.name + '/myTurn')
				.once('value');
			myTurn = myTurn.val();
			if (!sameTurn || !myTurn) {
				this.newTurn();
			}
		});
	}

	componentWillUnmount() {
		if (this.turnRef) {
			this.turnRef.off();
		}
	}

	componentDidUpdate() {
		if (this.context.name !== this.state.name) {
			this.setState({ name: this.context.name });
			this.newTurn();
		}
	}

	async undo() {
		await submitAPI.undo(this.context);
	}

	undoButton() {
		if (!this.state.undoable) {
			return;
		}
		return (
			<Popconfirm
				title="Sure you want to undo your last move?"
				onConfirm={() => this.undo()}
				okText="Yes"
				cancelText="No"
			>
				<span style={{ float: 'right', fontSize: 14 }}>
					<span style={{ color: '#177ddc', cursor: 'pointer' }}>Undo</span>
				</span>
			</Popconfirm>
		);
	}

	render() {
		return (
			<div style={{ height: '100%' }}>
				<StaticTurnApp key={this.state.turnID} />
				<Card
					style={{ height: '100%', overflow: 'auto' }}
					title={
						<div>
							{this.state.turnTitle} {this.undoButton()}{' '}
						</div>
					}
				>
					<DisplayMode mode={this.state.mode} turnID={this.state.turnID} />
				</Card>
			</div>
		);
	}
}

function DisplayMode(props) {
	switch (props.mode) {
		case 'bid':
			return <BidApp key={props.turnID} />;
		case 'buy-bid':
			return <BuyBidApp key={props.turnID} />;
		case 'buy':
			return <BuyApp key={props.turnID} />;
		case 'proposal':
			return <ProposalApp key={props.turnID} />;
		case 'proposal-opp':
			return <ProposalAppOpp key={props.turnID} />;
		case 'vote':
			return <VoteApp key={props.turnID} />;
		case 'continue-man':
			return <ContinueManeuverApp key={props.turnID} />;
		case 'peace-vote':
			return <PeaceVoteApp key={props.turnID} />;
		case 'game-over':
			return <GameOverApp key={props.turnID} />;
		default:
			return null;
	}
}
TurnApp.contextType = UserContext;

export default TurnApp;
