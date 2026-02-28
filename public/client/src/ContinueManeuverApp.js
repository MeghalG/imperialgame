import React from 'react';
import './App.css';
import { Select, Button, Card, List, Tag, Radio } from 'antd';
import UserContext from './UserContext.js';
import * as proposalAPI from './backendFiles/proposalAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { readGameState } from './backendFiles/stateCache.js';

const { Option } = Select;

/**
 * Converts a raw action code (e.g. "war Italy fleet") to a human-readable label
 * (e.g. "Declare war on Italian fleet").
 *
 * @param {string} action - Raw action string from getCurrentUnitActionOptions
 * @returns {string} Human-readable display label
 */
function formatActionLabel(action) {
	if (!action) return '';
	if (action === 'peace') {
		return 'Enter peacefully';
	}
	if (action === 'hostile') {
		return 'Enter as hostile occupier';
	}
	let parts = action.split(' ');
	if (parts[0] === 'war') {
		// "war Italy fleet" → "Declare war on Italian fleet"
		let country = parts.slice(1, parts.length - 1).join(' ');
		let unitType = parts[parts.length - 1];
		return 'Declare war on ' + country + ' ' + unitType;
	}
	if (parts[0] === 'blow' && parts[1] === 'up') {
		// "blow up Italy" → "Destroy Italian factory"
		let country = parts.slice(2).join(' ');
		return 'Destroy ' + country + ' factory';
	}
	return action;
}

/**
 * Converts a raw action code into a shorter label for the completed moves list.
 *
 * @param {string} action - Raw action string
 * @returns {string} Short display label
 */
function formatCompletedAction(action) {
	if (!action) return '';
	if (action === 'peace') return 'peace';
	if (action === 'hostile') return 'hostile';
	let parts = action.split(' ');
	if (parts[0] === 'war') {
		let country = parts.slice(1, parts.length - 1).join(' ');
		let unitType = parts[parts.length - 1];
		return 'war on ' + country + ' ' + unitType;
	}
	if (parts[0] === 'blow' && parts[1] === 'up') {
		let country = parts.slice(2).join(' ');
		return 'destroy ' + country + ' factory';
	}
	return action;
}

/**
 * UI for step-by-step maneuver movement (mode === 'continue-man').
 *
 * Shows the current unit to move, a destination dropdown, radio buttons for
 * action selection (peace/war/hostile/blow-up when applicable), and a submit button.
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
			submitting: false,
		};
	}

	async componentDidMount() {
		await this.loadData();
	}

	async loadData() {
		try {
			let gameState = await readGameState(this.context);
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
			let desc = 'Fleet: ' + m[0] + ' \u2192 ' + m[1];
			if (m[2]) desc += ' (' + formatCompletedAction(m[2]) + ')';
			moves.push(desc);
		}
		for (let i = 0; i < (cm.completedArmyMoves || []).length; i++) {
			let m = cm.completedArmyMoves[i];
			let desc = 'Army: ' + m[0] + ' \u2192 ' + m[1];
			if (m[2]) desc += ' (' + formatCompletedAction(m[2]) + ')';
			moves.push(desc);
		}
		return moves;
	}

	async onDestChange(value) {
		this.context.setManeuverDest(value);
		// Reset action when destination changes
		this.context.setManeuverAction('');
		this.setState({ actionOptions: [] });
		// Fetch action options for the selected destination
		let actionOptions = await proposalAPI.getCurrentUnitActionOptions({
			...this.context,
			maneuverDest: value,
		});
		this.setState({ actionOptions: actionOptions });
		// Auto-select: default to hostile if available, otherwise first option if only one
		if (actionOptions.includes('hostile')) {
			this.context.setManeuverAction('hostile');
		} else if (actionOptions.length === 1) {
			this.context.setManeuverAction(actionOptions[0]);
		}
	}

	onActionChange(e) {
		this.context.setManeuverAction(e.target.value);
	}

	async submitMove() {
		this.setState({ submitting: true });
		try {
			await submitAPI.submitManeuver(this.context);
		} finally {
			this.setState({ submitting: false });
		}
	}

	async submitDictatorVote(choice) {
		this.setState({ submitting: true });
		try {
			this.context.setPeaceVoteChoice(choice);
			await submitAPI.submitDictatorPeaceVote({
				...this.context,
				peaceVoteChoice: choice,
			});
		} finally {
			this.setState({ submitting: false });
		}
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
						<Button
							type="primary"
							style={{ marginRight: 10 }}
							loading={this.state.submitting}
							onClick={() => this.submitDictatorVote('accept')}
						>
							Accept
						</Button>
						<Button danger loading={this.state.submitting} onClick={() => this.submitDictatorVote('reject')}>
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
						<Select style={{ width: 200 }} placeholder="Select destination" onChange={(v) => this.onDestChange(v)}>
							{this.state.destinations.map((d) => (
								<Option key={d} value={d}>
									{d}
								</Option>
							))}
						</Select>
					</div>

					{this.state.actionOptions.length > 0 && (
						<div style={{ marginBottom: 16 }}>
							<label style={{ display: 'block', marginBottom: 8 }}>Action:</label>
							<Radio.Group onChange={(e) => this.onActionChange(e)} value={this.context.maneuverAction}>
								{this.state.actionOptions.map((a) => (
									<Radio key={a} value={a} style={{ display: 'block', marginBottom: 6 }}>
										{formatActionLabel(a)}
									</Radio>
								))}
							</Radio.Group>
						</div>
					)}

					<Button type="primary" loading={this.state.submitting} onClick={() => this.submitMove()}>
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
