import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './App.css';
import { Select, Button, Card, List, Tag, Radio } from 'antd';
import UserContext from './UserContext.js';
import * as proposalAPI from './backendFiles/proposalAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { readGameState } from './backendFiles/stateCache.js';
import SoundManager from './SoundManager.js';

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
function ContinueManeuverApp() {
	const context = useContext(UserContext);
	const [loaded, setLoaded] = useState(false);
	const [currentManeuver, setCurrentManeuver] = useState(null);
	const [destinations, setDestinations] = useState([]);
	const [actionOptions, setActionOptions] = useState([]);
	const [completedMoves, setCompletedMoves] = useState([]);
	const [currentUnit, setCurrentUnit] = useState(null);
	const [pendingPeace, setPendingPeace] = useState(null);
	const [submitting, setSubmitting] = useState(false);
	const contextRef = useRef(context);
	contextRef.current = context;

	function buildCompletedMovesList(cm) {
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

	const loadData = useCallback(async () => {
		try {
			let gameState = await readGameState(contextRef.current);
			let cm = gameState.currentManeuver;
			if (!cm) return;

			// Check if there's a pending peace vote for dictator
			if (cm.pendingPeace) {
				let targetCountry = cm.pendingPeace.targetCountry;
				let dictator = gameState.countryInfo[targetCountry].leadership[0];
				if (dictator === contextRef.current.name) {
					setLoaded(true);
					setCurrentManeuver(cm);
					setPendingPeace(cm.pendingPeace);
					setCompletedMoves(buildCompletedMovesList(cm));
					return;
				}
			}

			// Build the completed moves list
			let completedMovesData = buildCompletedMovesList(cm);

			// Get options for current unit
			let destinationsData = await proposalAPI.getCurrentUnitOptions(contextRef.current);

			// Determine current unit info
			let pendingUnits = cm.phase === 'fleet' ? cm.pendingFleets : cm.pendingArmies;
			let currentUnitData = pendingUnits[cm.unitIndex];

			setLoaded(true);
			setCurrentManeuver(cm);
			setDestinations(destinationsData);
			setCurrentUnit(currentUnitData);
			setCompletedMoves(completedMovesData);
			setPendingPeace(null);
		} catch (e) {
			console.error('ContinueManeuverApp failed to load:', e);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function onDestChange(value) {
		SoundManager.playDestination();
		context.setManeuverDest(value);
		// Reset action when destination changes
		context.setManeuverAction('');
		setActionOptions([]);
		// Fetch action options for the selected destination
		let actionOpts = await proposalAPI.getCurrentUnitActionOptions({
			...context,
			maneuverDest: value,
		});
		setActionOptions(actionOpts);
		// Auto-select: default to hostile if available, otherwise first option if only one
		if (actionOpts.includes('hostile')) {
			context.setManeuverAction('hostile');
		} else if (actionOpts.length === 1) {
			context.setManeuverAction(actionOpts[0]);
		}
	}

	function onActionChange(e) {
		context.setManeuverAction(e.target.value);
	}

	async function submitMove() {
		SoundManager.playPlace();
		setSubmitting(true);
		try {
			await submitAPI.submitManeuver(context);
		} finally {
			setSubmitting(false);
		}
	}

	async function submitDictatorVote(choice) {
		SoundManager.playSubmit();
		setSubmitting(true);
		try {
			context.setPeaceVoteChoice(choice);
			await submitAPI.submitDictatorPeaceVote({
				...context,
				peaceVoteChoice: choice,
			});
		} finally {
			setSubmitting(false);
		}
	}

	function renderCompletedMoves() {
		if (completedMoves.length === 0) return null;
		return (
			<Card title="Completed Moves" size="small" style={{ marginBottom: 8 }}>
				<List size="small" dataSource={completedMoves} renderItem={(item) => <List.Item>{item}</List.Item>} />
			</Card>
		);
	}

	if (!loaded) {
		return <div style={{ textAlign: 'center', padding: 40 }}>Loading maneuver...</div>;
	}

	let cm = currentManeuver;

	// Dictator peace vote pending
	if (pendingPeace) {
		let peace = pendingPeace;
		return (
			<div>
				{renderCompletedMoves()}
				<Card title="Peace Offer" style={{ marginTop: 16 }}>
					<p>
						{peace.targetCountry}'s decision: <strong>{cm.country}</strong> wants to move a{' '}
						<strong>{peace.unitType}</strong> from {peace.origin} into <strong>{peace.destination}</strong> peacefully.
					</p>
					<Button
						type="primary"
						style={{ marginRight: 10 }}
						loading={submitting}
						onClick={() => submitDictatorVote('accept')}
					>
						Accept
					</Button>
					<Button danger loading={submitting} onClick={() => submitDictatorVote('reject')}>
						Reject
					</Button>
				</Card>
			</div>
		);
	}

	if (!currentUnit) {
		return <div style={{ textAlign: 'center', padding: 40 }}>Waiting for maneuver...</div>;
	}

	let phaseLabel = cm.phase === 'fleet' ? 'Fleet' : 'Army';
	let unitNum = cm.unitIndex + 1;
	let totalUnits = cm.phase === 'fleet' ? (cm.pendingFleets || []).length : (cm.pendingArmies || []).length;

	return (
		<div>
			{renderCompletedMoves()}
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
					<Select style={{ width: 200 }} placeholder="Select destination" onChange={(v) => onDestChange(v)}>
						{destinations.map((d) => (
							<Option key={d} value={d}>
								{d}
							</Option>
						))}
					</Select>
				</div>

				{actionOptions.length > 0 && (
					<div style={{ marginBottom: 16 }}>
						<label style={{ display: 'block', marginBottom: 8 }}>Action:</label>
						<Radio.Group onChange={(e) => onActionChange(e)} value={context.maneuverAction}>
							{actionOptions.map((a) => (
								<Radio key={a} value={a} style={{ display: 'block', marginBottom: 6 }}>
									{formatActionLabel(a)}
								</Radio>
							))}
						</Radio.Group>
					</div>
				)}

				<Button type="primary" loading={submitting} onClick={() => submitMove()}>
					Submit Move
				</Button>
			</Card>
		</div>
	);
}

export default ContinueManeuverApp;
