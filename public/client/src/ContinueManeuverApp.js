import React from 'react';
import './App.css';
import { Select, Button, Card, List, Tag } from 'antd';
import UserContext from './UserContext.js';
import * as proposalAPI from './backendFiles/proposalAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { database } from './backendFiles/firebase.js';

const { Option } = Select;

/**
 * UI for step-by-step maneuver movement (mode === 'continue-man').
 *
 * Shows the current unit to move, a destination dropdown, an action dropdown
 * (for peace/war/hostile/blow-up when applicable), and a submit button.
 * Also displays already-completed moves as a read-only list.
 *
 * When a dictatorship peace vote is pending, the dictator sees accept/reject buttons.
 */
class ContinueManeuverApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			loaded: false,
			currentManeuver: null,
			destinations: [],
			actionOptions: [],
			completedMoves: [],
			currentUnit: null,
			pendingPeace: null,
		};
	}

	async componentDidMount() {
		await this.loadData();
	}

	async loadData() {
		try {
			let gameState = await database.ref('games/' + this.context.game).once('value');
			gameState = gameState.val();
			let cm = gameState.currentManeuver;
			if (!cm) return;

			// Check if there's a pending peace vote for dictator
			if (cm.pendingPeace) {
				let targetCountry = cm.pendingPeace.targetCountry;
				let dictator = gameState.countryInfo[targetCountry].leadership[0];
				if (dictator === this.context.name) {
					this.setState({
						loaded: true,
						currentManeuver: cm,
						pendingPeace: cm.pendingPeace,
						completedMoves: this.buildCompletedMovesList(cm),
					});
					return;
				}
			}

			// Build the completed moves list
			let completedMoves = this.buildCompletedMovesList(cm);

			// Get options for current unit
			let destinations = await proposalAPI.getCurrentUnitOptions(this.context);

			// Determine current unit info
			let pendingUnits = cm.phase === 'fleet' ? cm.pendingFleets : cm.pendingArmies;
			let currentUnit = pendingUnits[cm.unitIndex];

			this.setState({
				loaded: true,
				currentManeuver: cm,
				destinations: destinations,
				currentUnit: currentUnit,
				completedMoves: completedMoves,
				pendingPeace: null,
			});
		} catch (e) {
			console.error('ContinueManeuverApp failed to load:', e);
		}
	}

	buildCompletedMovesList(cm) {
		let moves = [];
		for (let i = 0; i < (cm.completedFleetMoves || []).length; i++) {
			let m = cm.completedFleetMoves[i];
			let desc = 'Fleet: ' + m[0] + ' → ' + m[1];
			if (m[2]) desc += ' (' + m[2] + ')';
			moves.push(desc);
		}
		for (let i = 0; i < (cm.completedArmyMoves || []).length; i++) {
			let m = cm.completedArmyMoves[i];
			let desc = 'Army: ' + m[0] + ' → ' + m[1];
			if (m[2]) desc += ' (' + m[2] + ')';
			moves.push(desc);
		}
		return moves;
	}

	async onDestChange(value) {
		this.context.setManeuverDest(value);
		// Fetch action options for the selected destination
		// Need a small delay for context to update
		setTimeout(async () => {
			let actionOptions = await proposalAPI.getCurrentUnitActionOptions({
				...this.context,
				maneuverDest: value,
			});
			this.setState({ actionOptions: actionOptions });
		}, 0);
	}

	onActionChange(value) {
		this.context.setManeuverAction(value);
	}

	async submitMove() {
		await submitAPI.submitManeuver(this.context);
	}

	async submitDictatorVote(choice) {
		this.context.setPeaceVoteChoice(choice);
		setTimeout(async () => {
			await submitAPI.submitDictatorPeaceVote({
				...this.context,
				peaceVoteChoice: choice,
			});
		}, 0);
	}

	render() {
		if (!this.state.loaded) {
			return <div style={{ textAlign: 'center', padding: 40 }}>Loading maneuver...</div>;
		}

		let cm = this.state.currentManeuver;

		// Dictator peace vote pending
		if (this.state.pendingPeace) {
			let peace = this.state.pendingPeace;
			return (
				<div>
					{this.renderCompletedMoves()}
					<Card title="Peace Offer" style={{ marginTop: 16 }}>
						<p>
							{peace.targetCountry}'s decision: <strong>{cm.country}</strong> wants to move a{' '}
							<strong>{peace.unitType}</strong> from {peace.origin} into <strong>{peace.destination}</strong>{' '}
							peacefully.
						</p>
						<Button type="primary" style={{ marginRight: 10 }} onClick={() => this.submitDictatorVote('accept')}>
							Accept
						</Button>
						<Button danger onClick={() => this.submitDictatorVote('reject')}>
							Reject
						</Button>
					</Card>
				</div>
			);
		}

		let currentUnit = this.state.currentUnit;
		if (!currentUnit) {
			return <div style={{ textAlign: 'center', padding: 40 }}>Waiting for maneuver...</div>;
		}

		let phaseLabel = cm.phase === 'fleet' ? 'Fleet' : 'Army';
		let unitNum = cm.unitIndex + 1;
		let totalUnits = cm.phase === 'fleet' ? (cm.pendingFleets || []).length : (cm.pendingArmies || []).length;

		return (
			<div>
				{this.renderCompletedMoves()}
				<Card
					title={
						<span>
							Move {phaseLabel} {unitNum}/{totalUnits}
							<Tag color={cm.phase === 'fleet' ? 'blue' : 'green'} style={{ marginLeft: 8 }}>
								{cm.phase} phase
							</Tag>
						</span>
					}
					style={{ marginTop: 16 }}
				>
					<p>
						Current position: <strong>{currentUnit.territory}</strong>
					</p>
					<div style={{ marginBottom: 16 }}>
						<label style={{ marginRight: 8 }}>Destination:</label>
						<Select
							style={{ width: 200 }}
							placeholder="Select destination"
							onChange={(v) => this.onDestChange(v)}
							getPopupContainer={(trigger) => trigger.parentNode}
						>
							{this.state.destinations.map((d) => (
								<Option key={d} value={d}>
									{d}
								</Option>
							))}
						</Select>
					</div>

					{this.state.actionOptions.length > 0 && (
						<div style={{ marginBottom: 16 }}>
							<label style={{ marginRight: 8 }}>Action:</label>
							<Select
								style={{ width: 250 }}
								placeholder="Select action (optional)"
								allowClear
								onChange={(v) => this.onActionChange(v || '')}
								getPopupContainer={(trigger) => trigger.parentNode}
							>
								{this.state.actionOptions.map((a) => (
									<Option key={a} value={a}>
										{a}
									</Option>
								))}
							</Select>
						</div>
					)}

					<Button type="primary" onClick={() => this.submitMove()}>
						Submit Move
					</Button>
				</Card>
			</div>
		);
	}

	renderCompletedMoves() {
		if (this.state.completedMoves.length === 0) return null;
		return (
			<Card title="Completed Moves" size="small" style={{ marginBottom: 8 }}>
				<List
					size="small"
					dataSource={this.state.completedMoves}
					renderItem={(item) => <List.Item>{item}</List.Item>}
				/>
			</Card>
		);
	}
}

ContinueManeuverApp.contextType = UserContext;

export default ContinueManeuverApp;
