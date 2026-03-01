import React from 'react';
import './App.css';
import { Select, Button, Card, Tag, Radio, Steps, Tooltip } from 'antd';
import { LockOutlined, ArrowUpOutlined, ArrowDownOutlined, CheckCircleOutlined } from '@ant-design/icons';
import UserContext from './UserContext.js';
import * as proposalAPI from './backendFiles/proposalAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { readGameState, readSetup } from './backendFiles/stateCache.js';

const { Option } = Select;

/**
 * Converts a raw action code to a human-readable label.
 */
function formatActionLabel(action) {
	if (!action) return '';
	if (action === 'peace') return 'Enter peacefully';
	if (action === 'hostile') return 'Enter as hostile occupier';
	let parts = action.split(' ');
	if (parts[0] === 'war') {
		let country = parts.slice(1, parts.length - 1).join(' ');
		let unitType = parts[parts.length - 1];
		return 'Declare war on ' + country + ' ' + unitType;
	}
	if (parts[0] === 'blow' && parts[1] === 'up') {
		let country = parts.slice(2).join(' ');
		return 'Destroy ' + country + ' factory';
	}
	return action;
}

/**
 * Converts a raw action code to a short label for completed moves.
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
 * Determines the color indicator for an action.
 */
function actionColor(action) {
	if (!action) return undefined;
	if (action === 'peace') return '#52c41a';
	if (action === 'hostile') return '#fa8c16';
	let parts = action.split(' ');
	if (parts[0] === 'war') return '#f5222d';
	if (parts[0] === 'blow' && parts[1] === 'up') return '#a8071a';
	return undefined;
}

/**
 * Returns true if the given action code triggers a potential peace vote.
 */
function isPeaceAction(action) {
	return action === 'peace';
}

/**
 * Client-side maneuver planner replacing ContinueManeuverApp.
 *
 * All units from both phases are visible at once. The player plans
 * destinations and actions for each unit, then submits them in batch.
 * If a peace vote is needed, the planner identifies the "stopping point"
 * and shows an inline button to propose peace at that location.
 */
class ManeuverPlannerApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			loaded: false,
			submitting: false,
			country: '',
			currentManeuver: null,

			// Plan arrays: each entry = { origin, dest, action, destOptions, actionOptions, peaceVote }
			fleetPlans: [],
			armyPlans: [],

			// Committed moves from a previous peace vote round (read-only)
			priorCompleted: [],

			// Territory setup data for peace vote detection
			territorySetup: {},

			// Pending peace vote for dictator
			pendingPeace: null,
		};
	}

	async componentDidMount() {
		await this.loadData();
	}

	/**
	 * Builds a ManeuverPlan object from current state for proposalAPI calls.
	 */
	buildPlan() {
		let cm = this.state.currentManeuver;
		return {
			country: cm.country,
			pendingFleets: cm.pendingFleets || [],
			pendingArmies: cm.pendingArmies || [],
			fleetTuples: this.state.fleetPlans.map((p) => [p.origin, p.dest || '', p.action || '']),
			armyTuples: this.state.armyPlans.map((p) => [p.origin, p.dest || '', p.action || '']),
		};
	}

	async loadData() {
		try {
			let gameState = await readGameState(this.context);
			let cm = gameState.currentManeuver;
			if (!cm) return;

			let territorySetup = await readSetup(gameState.setup + '/territories');

			// Check if there's a pending peace vote for dictator
			if (cm.pendingPeace) {
				let targetCountry = cm.pendingPeace.targetCountry;
				let dictator = gameState.countryInfo[targetCountry].leadership[0];
				if (dictator === this.context.name) {
					this.setState({
						loaded: true,
						currentManeuver: cm,
						pendingPeace: cm.pendingPeace,
						priorCompleted: this.buildCompletedMovesList(cm),
					});
					return;
				}
			}

			// Build prior completed moves list (from previous peace vote rounds)
			let priorCompleted = this.buildCompletedMovesList(cm);

			// Initialize fleet plans
			let fleetPlans = (cm.pendingFleets || []).map((unit) => ({
				origin: unit.territory,
				dest: '',
				action: '',
				destOptions: [],
				actionOptions: [],
				peaceVote: false,
			}));

			// Initialize army plans
			let armyPlans = (cm.pendingArmies || []).map((unit) => ({
				origin: unit.territory,
				dest: '',
				action: '',
				destOptions: [],
				actionOptions: [],
				peaceVote: false,
			}));

			// Pre-populate from remainingFleetPlans/remainingArmyPlans if resuming
			if (cm.remainingFleetPlans && cm.remainingFleetPlans.length > 0) {
				for (let i = 0; i < cm.remainingFleetPlans.length && i < fleetPlans.length; i++) {
					let tuple = cm.remainingFleetPlans[i];
					fleetPlans[i].dest = tuple[1] || '';
					fleetPlans[i].action = tuple[2] || '';
				}
			}
			if (cm.remainingArmyPlans && cm.remainingArmyPlans.length > 0) {
				for (let i = 0; i < cm.remainingArmyPlans.length && i < armyPlans.length; i++) {
					let tuple = cm.remainingArmyPlans[i];
					armyPlans[i].dest = tuple[1] || '';
					armyPlans[i].action = tuple[2] || '';
				}
			}

			this.setState(
				{
					loaded: true,
					currentManeuver: cm,
					country: cm.country,
					territorySetup,
					fleetPlans,
					armyPlans,
					priorCompleted,
					pendingPeace: null,
				},
				async () => {
					// Compute destination options for all units
					let allPromises = [];
					for (let i = 0; i < fleetPlans.length; i++) {
						allPromises.push(this.computeOptionsForUnit('fleet', i));
					}
					for (let i = 0; i < armyPlans.length; i++) {
						allPromises.push(this.computeOptionsForUnit('army', i));
					}
					await Promise.all(allPromises);
					// If resuming with pre-populated plans, compute action options too
					for (let i = 0; i < this.state.fleetPlans.length; i++) {
						if (this.state.fleetPlans[i].dest) {
							await this.computeActionOptionsForUnit('fleet', i, this.state.fleetPlans[i].dest);
						}
					}
					for (let i = 0; i < this.state.armyPlans.length; i++) {
						if (this.state.armyPlans[i].dest) {
							await this.computeActionOptionsForUnit('army', i, this.state.armyPlans[i].dest);
						}
					}
				}
			);
		} catch (e) {
			console.error('ManeuverPlannerApp failed to load:', e);
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

	async computeOptionsForUnit(phase, index) {
		let plan = this.buildPlan();
		try {
			let destOptions = await proposalAPI.getUnitOptionsFromPlans(this.context, plan, phase, index);
			let plans = phase === 'fleet' ? [...this.state.fleetPlans] : [...this.state.armyPlans];
			if (plans[index]) {
				plans[index] = { ...plans[index], destOptions: destOptions || [] };
				if (phase === 'fleet') {
					this.setState({ fleetPlans: plans });
				} else {
					this.setState({ armyPlans: plans });
				}
			}
		} catch (e) {
			console.error('Failed to compute options for', phase, index, e);
		}
	}

	async computeActionOptionsForUnit(phase, index, dest) {
		let plan = this.buildPlan();
		try {
			let actionOptions = await proposalAPI.getUnitActionOptionsFromPlans(this.context, plan, phase, index, dest);
			let plans = phase === 'fleet' ? [...this.state.fleetPlans] : [...this.state.armyPlans];
			if (plans[index]) {
				// actionOptions may be a flat array or { countries, otherActions }
				plans[index] = { ...plans[index], actionOptions: actionOptions || [] };
				// Auto-select: default to hostile if available, otherwise first option if only one
				if (Array.isArray(actionOptions)) {
					if (actionOptions.includes('hostile')) {
						plans[index].action = 'hostile';
					} else if (actionOptions.length === 1) {
						plans[index].action = actionOptions[0];
					}
				}
				if (phase === 'fleet') {
					this.setState({ fleetPlans: plans }, () => this.detectPeaceVotes());
				} else {
					this.setState({ armyPlans: plans }, () => this.detectPeaceVotes());
				}
			}
		} catch (e) {
			console.error('Failed to compute action options for', phase, index, e);
		}
	}

	/**
	 * Checks whether a planned move would trigger a peace vote.
	 * Mirrors the logic in submitBatchManeuver: peace vote only happens when
	 * action is 'peace', dest != origin, territory is foreign, AND there are
	 * enemy units at the destination (inferred from actionOptions containing war options).
	 */
	wouldTriggerPeaceVote(plan) {
		if (!plan.dest || plan.dest === plan.origin) return false;
		if (!isPeaceAction(plan.action) && !this.hasJsonPeaceAction(plan.action)) return false;

		// Check territory ownership
		let ts = this.state.territorySetup;
		let destCountry = ts[plan.dest] && ts[plan.dest].country;
		if (!destCountry || destCountry === this.state.country) return false;

		// Check if action options indicate enemy units at destination
		// (war options only appear when there are enemy units)
		let opts = plan.actionOptions;
		if (Array.isArray(opts)) {
			return opts.some((a) => a.startsWith('war '));
		}
		if (opts && opts.countries) {
			return true; // multi-country breakdown means enemies are present
		}
		return false;
	}

	/**
	 * Checks if a JSON-encoded action string contains any peace entries.
	 */
	hasJsonPeaceAction(action) {
		if (!action) return false;
		try {
			let parsed = JSON.parse(action);
			if (Array.isArray(parsed)) {
				return parsed.some((e) => e.action === 'peace');
			}
		} catch (e) {
			// Not JSON
		}
		return false;
	}

	/**
	 * Scans all planned moves and marks any that would trigger peace votes.
	 */
	detectPeaceVotes() {
		let fleetPlans = this.state.fleetPlans.map((p) => ({ ...p, peaceVote: this.wouldTriggerPeaceVote(p) }));
		let armyPlans = this.state.armyPlans.map((p) => ({ ...p, peaceVote: this.wouldTriggerPeaceVote(p) }));
		this.setState({ fleetPlans, armyPlans });
	}

	async onDestChange(phase, index, value) {
		let plans = phase === 'fleet' ? [...this.state.fleetPlans] : [...this.state.armyPlans];
		plans[index] = { ...plans[index], dest: value, action: '', actionOptions: [], peaceVote: false };

		let stateKey = phase === 'fleet' ? 'fleetPlans' : 'armyPlans';
		this.setState({ [stateKey]: plans }, async () => {
			await this.computeActionOptionsForUnit(phase, index, value);
			// Refresh dest options for subsequent units since virtual state changed
			let currentPlans = phase === 'fleet' ? this.state.fleetPlans : this.state.armyPlans;
			for (let i = index + 1; i < currentPlans.length; i++) {
				await this.computeOptionsForUnit(phase, i);
			}
			// If a fleet changed, also refresh all army options
			if (phase === 'fleet') {
				for (let i = 0; i < this.state.armyPlans.length; i++) {
					await this.computeOptionsForUnit('army', i);
				}
			}
		});
	}

	onActionChange(phase, index, value) {
		let plans = phase === 'fleet' ? [...this.state.fleetPlans] : [...this.state.armyPlans];
		plans[index] = { ...plans[index], action: value };

		if (phase === 'fleet') {
			this.setState({ fleetPlans: plans }, () => this.detectPeaceVotes());
		} else {
			this.setState({ armyPlans: plans }, () => this.detectPeaceVotes());
		}
	}

	async onReorderUnit(phase, fromIndex, toIndex) {
		let plans = phase === 'fleet' ? [...this.state.fleetPlans] : [...this.state.armyPlans];
		if (toIndex < 0 || toIndex >= plans.length) return;

		// Swap units, preserving their planned dest/action
		let temp = plans[fromIndex];
		plans[fromIndex] = plans[toIndex];
		plans[toIndex] = temp;

		let stateKey = phase === 'fleet' ? 'fleetPlans' : 'armyPlans';
		this.setState({ [stateKey]: plans }, async () => {
			// Recompute destOptions/actionOptions for affected units in the background
			let startFrom = Math.min(fromIndex, toIndex);
			for (let i = startFrom; i < plans.length; i++) {
				await this.computeOptionsForUnit(phase, i);
				let current = phase === 'fleet' ? this.state.fleetPlans : this.state.armyPlans;
				if (current[i] && current[i].dest) {
					await this.computeActionOptionsForUnit(phase, i, current[i].dest);
				}
			}
			this.detectPeaceVotes();
		});
	}

	/**
	 * Finds the first peace-vote-triggering move, or -1 if none.
	 * Returns { phase, index } or null.
	 */
	findFirstPeaceStop() {
		for (let i = 0; i < this.state.fleetPlans.length; i++) {
			if (this.state.fleetPlans[i].peaceVote) {
				return { phase: 'fleet', index: i };
			}
		}
		for (let i = 0; i < this.state.armyPlans.length; i++) {
			if (this.state.armyPlans[i].peaceVote) {
				return { phase: 'army', index: i };
			}
		}
		return null;
	}

	/**
	 * Checks if all units have been planned (have a destination).
	 * If a peace stop exists, only checks units up to and including the peace stop.
	 */
	allPlanned() {
		let peaceStop = this.findFirstPeaceStop();

		if (peaceStop) {
			// Only need units up to and including the peace stop to be planned
			if (peaceStop.phase === 'fleet') {
				for (let i = 0; i <= peaceStop.index; i++) {
					if (!this.state.fleetPlans[i].dest) return false;
				}
				return true;
			} else {
				// All fleets must be planned
				for (let f of this.state.fleetPlans) {
					if (!f.dest) return false;
				}
				for (let i = 0; i <= peaceStop.index; i++) {
					if (!this.state.armyPlans[i].dest) return false;
				}
				return true;
			}
		}

		// No peace stop — all units must be planned
		for (let f of this.state.fleetPlans) {
			if (!f.dest) return false;
		}
		for (let a of this.state.armyPlans) {
			if (!a.dest) return false;
		}
		return true;
	}

	async submit() {
		this.setState({ submitting: true });
		try {
			let fleetMan = this.state.fleetPlans.map((p) => [p.origin, p.dest, p.action || '']);
			let armyMan = this.state.armyPlans.map((p) => [p.origin, p.dest, p.action || '']);

			this.context.setFleetMan(fleetMan);
			this.context.setArmyMan(armyMan);

			await submitAPI.submitBatchManeuver({
				...this.context,
				fleetMan,
				armyMan,
			});
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

	// ---- Rendering ----

	render() {
		if (!this.state.loaded) {
			return <div style={{ textAlign: 'center', padding: 40 }}>Loading maneuver...</div>;
		}

		// Dictator peace vote pending
		if (this.state.pendingPeace) {
			return this.renderPeaceVote();
		}

		let cm = this.state.currentManeuver;
		if (!cm) {
			return <div style={{ textAlign: 'center', padding: 40 }}>Waiting for maneuver...</div>;
		}

		let fleetCount = this.state.fleetPlans.length;
		let armyCount = this.state.armyPlans.length;
		let phaseIndex = 0;
		let steps = [];
		if (fleetCount > 0) steps.push({ title: 'Fleets (' + fleetCount + ')' });
		if (armyCount > 0) steps.push({ title: 'Armies (' + armyCount + ')' });
		if (steps.length === 2) {
			phaseIndex = 0; // always show both
		}

		return (
			<div>
				{this.renderPriorCompleted()}

				<div style={{ marginBottom: 12 }}>
					<Tag color="blue">{cm.country}</Tag>
					<Tag>{cm.wheelSpot}</Tag>
					{steps.length > 1 && (
						<Steps size="small" current={phaseIndex} style={{ marginTop: 8, maxWidth: 300 }}>
							{steps.map((s, i) => (
								<Steps.Step key={i} title={s.title} />
							))}
						</Steps>
					)}
				</div>

				{fleetCount > 0 && this.renderPhaseSection('fleet')}
				{armyCount > 0 && this.renderPhaseSection('army')}
			</div>
		);
	}

	renderPeaceVote() {
		let peace = this.state.pendingPeace;
		let cm = this.state.currentManeuver;
		return (
			<div>
				{this.renderPriorCompleted()}
				<Card title="Peace Offer" size="small" style={{ marginTop: 8 }}>
					<p>
						{peace.targetCountry}'s decision: <strong>{cm.country}</strong> wants to move a{' '}
						<strong>{peace.unitType}</strong> from {peace.origin} into <strong>{peace.destination}</strong> peacefully.
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

	renderPriorCompleted() {
		if (this.state.priorCompleted.length === 0) return null;
		return (
			<Card title="Committed Moves" size="small" style={{ marginBottom: 8 }}>
				{this.state.priorCompleted.map((desc, i) => (
					<div key={i} style={{ padding: '2px 0', color: 'rgba(255,255,255,0.65)' }}>
						<LockOutlined style={{ marginRight: 6, fontSize: 11 }} />
						{desc}
					</div>
				))}
			</Card>
		);
	}

	renderUnitRow(phase, index, plan, peaceStop) {
		let isPlanned = !!plan.dest;
		let plans = phase === 'fleet' ? this.state.fleetPlans : this.state.armyPlans;
		let unitLabel = phase === 'fleet' ? 'Fleet' : 'Army';
		let unitNum = index + 1;
		let totalUnits = plans.length;

		// Determine if this unit is "after" a peace stop (dimmed)
		let afterPeaceStop = false;
		if (peaceStop) {
			if (peaceStop.phase === 'fleet' && phase === 'army') {
				afterPeaceStop = true;
			} else if (peaceStop.phase === 'fleet' && phase === 'fleet' && index > peaceStop.index) {
				afterPeaceStop = true;
			} else if (peaceStop.phase === 'army' && phase === 'army' && index > peaceStop.index) {
				afterPeaceStop = true;
			}
		}

		let rowStyle = {
			borderLeft: '3px solid',
			borderColor: plan.peaceVote ? '#fa8c16' : isPlanned ? '#52c41a' : '#434343',
			padding: '8px 12px',
			marginBottom: 4,
			background: afterPeaceStop ? 'rgba(255,255,255,0.02)' : 'transparent',
			opacity: afterPeaceStop ? 0.5 : 1,
			borderRadius: '0 4px 4px 0',
		};

		return (
			<div key={phase + '-' + index} style={rowStyle}>
				<div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
					{/* Reorder buttons */}
					<span style={{ marginRight: 8, display: 'flex', flexDirection: 'column', gap: 0 }}>
						<Tooltip title="Move up" mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
							<Button
								type="text"
								size="small"
								icon={<ArrowUpOutlined />}
								disabled={index === 0}
								onClick={() => this.onReorderUnit(phase, index, index - 1)}
								style={{ padding: '0 4px', height: 18, fontSize: 10 }}
							/>
						</Tooltip>
						<Tooltip title="Move down" mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
							<Button
								type="text"
								size="small"
								icon={<ArrowDownOutlined />}
								disabled={index === totalUnits - 1}
								onClick={() => this.onReorderUnit(phase, index, index + 1)}
								style={{ padding: '0 4px', height: 18, fontSize: 10 }}
							/>
						</Tooltip>
					</span>

					{/* Unit label */}
					<span style={{ flex: 1 }}>
						<strong>
							{unitLabel} {unitNum}:
						</strong>{' '}
						{plan.origin}
					</span>

					{/* Check mark for planned units */}
					{isPlanned && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 4, fontSize: 14 }} />}
					{plan.peaceVote && (
						<Tag color="orange" style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px' }}>
							PEACE VOTE
						</Tag>
					)}
				</div>

				{/* Planning controls always visible */}
				{this.renderPlanningControls(phase, index, plan)}

				{/* Inline submit button at the peace stop */}
				{plan.peaceVote && this.isPeaceStopHere(phase, index, peaceStop) && this.renderInlinePeaceSubmit(phase, index)}
			</div>
		);
	}

	isPeaceStopHere(phase, index, peaceStop) {
		return peaceStop && peaceStop.phase === phase && peaceStop.index === index;
	}

	renderPlanningControls(phase, index, plan) {
		return (
			<div style={{ paddingLeft: 30 }}>
				<div style={{ marginBottom: 10 }}>
					<label style={{ marginRight: 8, color: 'rgba(255,255,255,0.65)' }}>Destination:</label>
					<Select
						style={{ width: 220 }}
						placeholder="Select destination"
						value={plan.dest || undefined}
						onChange={(v) => this.onDestChange(phase, index, v)}
						showSearch
						optionFilterProp="children"
					>
						{(plan.destOptions || []).map((d) => (
							<Option key={d} value={d}>
								{d}
								{d === plan.origin && <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>(stay)</span>}
							</Option>
						))}
					</Select>
				</div>

				{this.renderActionControls(phase, index, plan)}
			</div>
		);
	}

	renderActionControls(phase, index, plan) {
		let opts = plan.actionOptions;
		if (!opts || (Array.isArray(opts) && opts.length === 0)) return null;

		// Multi-country breakdown
		if (!Array.isArray(opts) && opts.countries) {
			return (
				<div style={{ marginBottom: 10 }}>
					<label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.65)' }}>
						Actions per country:
					</label>
					{opts.countries.map((entry) => (
						<div key={entry.country} style={{ marginBottom: 6, paddingLeft: 8 }}>
							<span style={{ marginRight: 8 }}>
								<strong>{entry.country}</strong> ({entry.units.join(', ')}):
							</span>
							<Radio.Group
								size="small"
								value={this.getPerCountryAction(phase, index, entry.country)}
								onChange={(e) => this.onPerCountryActionChange(phase, index, entry.country, e.target.value)}
							>
								{entry.actions.map((a) => (
									<Radio key={a} value={a}>
										<span style={{ color: actionColor(a) }}>{formatActionLabel(a)}</span>
									</Radio>
								))}
							</Radio.Group>
						</div>
					))}
					{opts.otherActions && opts.otherActions.length > 0 && (
						<div style={{ marginTop: 6, paddingLeft: 8 }}>
							<Radio.Group
								size="small"
								value={this.isOtherAction(phase, index, opts) ? plan.action : undefined}
								onChange={(e) => this.onActionChange(phase, index, e.target.value)}
							>
								{opts.otherActions.map((a) => (
									<Radio key={a} value={a}>
										<span style={{ color: actionColor(a) }}>{formatActionLabel(a)}</span>
									</Radio>
								))}
							</Radio.Group>
						</div>
					)}
				</div>
			);
		}

		// Simple flat action array
		if (Array.isArray(opts) && opts.length > 0) {
			return (
				<div style={{ marginBottom: 10 }}>
					<label style={{ display: 'block', marginBottom: 6, color: 'rgba(255,255,255,0.65)' }}>Action:</label>
					<Radio.Group onChange={(e) => this.onActionChange(phase, index, e.target.value)} value={plan.action}>
						{opts.map((a) => (
							<Radio key={a} value={a} style={{ display: 'block', marginBottom: 4 }}>
								<span style={{ color: actionColor(a) }}>{formatActionLabel(a)}</span>
							</Radio>
						))}
					</Radio.Group>
				</div>
			);
		}

		return null;
	}

	/**
	 * For multi-country action scenarios, we encode per-country choices
	 * as a JSON string in the action field. This retrieves the choice for a single country.
	 */
	getPerCountryAction(phase, index, country) {
		let plans = phase === 'fleet' ? this.state.fleetPlans : this.state.armyPlans;
		let action = plans[index].action;
		if (!action) return undefined;
		try {
			let parsed = JSON.parse(action);
			if (Array.isArray(parsed)) {
				let entry = parsed.find((e) => e.country === country);
				return entry ? entry.action : undefined;
			}
		} catch (e) {
			// Not JSON — single action string
		}
		return undefined;
	}

	isOtherAction(phase, index, opts) {
		let plans = phase === 'fleet' ? this.state.fleetPlans : this.state.armyPlans;
		let action = plans[index].action;
		if (!action) return false;
		return opts.otherActions && opts.otherActions.includes(action);
	}

	onPerCountryActionChange(phase, index, country, value) {
		let plans = phase === 'fleet' ? [...this.state.fleetPlans] : [...this.state.armyPlans];
		let current = plans[index].action;
		let choices = [];
		try {
			let parsed = JSON.parse(current);
			if (Array.isArray(parsed)) choices = parsed;
		} catch (e) {
			// fresh start
		}

		// Update or add this country's choice
		let existingIndex = choices.findIndex((c) => c.country === country);
		if (existingIndex >= 0) {
			choices[existingIndex].action = value;
		} else {
			choices.push({ country, action: value, order: choices.length + 1 });
		}

		plans[index] = { ...plans[index], action: JSON.stringify(choices) };

		// Determine if any entry is peace for peace vote detection
		let hasPeace = choices.some((c) => c.action === 'peace');
		plans[index].peaceVote = hasPeace;

		if (phase === 'fleet') {
			this.setState({ fleetPlans: plans });
		} else {
			this.setState({ armyPlans: plans });
		}
	}

	/**
	 * Returns a human-readable reason why the maneuver can't be submitted yet,
	 * or '' if everything is ready.
	 */
	getBlockedReason(peaceStop) {
		if (!peaceStop) {
			// No peace stop — check all units
			let unplannedFleets = this.state.fleetPlans.filter((p) => !p.dest).length;
			let unplannedArmies = this.state.armyPlans.filter((p) => !p.dest).length;
			let parts = [];
			if (unplannedFleets > 0) parts.push(unplannedFleets + ' fleet move' + (unplannedFleets > 1 ? 's' : ''));
			if (unplannedArmies > 0) parts.push(unplannedArmies + ' army move' + (unplannedArmies > 1 ? 's' : ''));
			return parts.length > 0 ? 'Plan ' + parts.join(' and ') + ' first' : '';
		}

		if (peaceStop.phase === 'army') {
			// All fleets + armies up to peaceStop.index must be planned
			let unplannedFleets = this.state.fleetPlans.filter((p) => !p.dest).length;
			let unplannedArmies = 0;
			for (let i = 0; i <= peaceStop.index; i++) {
				if (!this.state.armyPlans[i].dest) unplannedArmies++;
			}
			let parts = [];
			if (unplannedFleets > 0) parts.push(unplannedFleets + ' fleet move' + (unplannedFleets > 1 ? 's' : ''));
			if (unplannedArmies > 0) parts.push(unplannedArmies + ' army move' + (unplannedArmies > 1 ? 's' : ''));
			return parts.length > 0 ? 'Plan ' + parts.join(' and ') + ' first' : '';
		}

		// Peace stop is on a fleet — check fleets up to peaceStop.index
		let unplannedFleets = 0;
		for (let i = 0; i <= peaceStop.index; i++) {
			if (!this.state.fleetPlans[i].dest) unplannedFleets++;
		}
		if (unplannedFleets > 0)
			return 'Plan ' + unplannedFleets + ' fleet move' + (unplannedFleets > 1 ? 's' : '') + ' first';
		return '';
	}

	renderInlinePeaceSubmit(phase, index) {
		let plan = phase === 'fleet' ? this.state.fleetPlans[index] : this.state.armyPlans[index];
		let dest = plan.dest;

		// Determine what will be committed vs staged
		let commitInfo = [];
		if (phase === 'fleet') {
			if (index > 0) commitInfo.push(index + ' fleet move(s) will execute.');
			commitInfo.push('Proposing peace at ' + dest + '.');
			if (index < this.state.fleetPlans.length - 1)
				commitInfo.push(this.state.fleetPlans.length - index - 1 + ' fleet move(s) staged for later.');
			if (this.state.armyPlans.length > 0)
				commitInfo.push(this.state.armyPlans.length + ' army move(s) staged for later.');
		} else {
			if (this.state.fleetPlans.length > 0)
				commitInfo.push('All ' + this.state.fleetPlans.length + ' fleet move(s) will execute.');
			if (index > 0) commitInfo.push(index + ' army move(s) will execute.');
			commitInfo.push('Proposing peace at ' + dest + '.');
			if (index < this.state.armyPlans.length - 1)
				commitInfo.push(this.state.armyPlans.length - index - 1 + ' army move(s) staged for later.');
		}

		let canSubmit = this.allPlanned();
		let peaceStop = this.findFirstPeaceStop();
		let blockedReason = canSubmit ? '' : this.getBlockedReason(peaceStop);

		let peaceButton = (
			<Button
				type="primary"
				style={{ marginTop: 6, background: '#fa8c16', borderColor: '#fa8c16' }}
				loading={this.state.submitting}
				disabled={!canSubmit}
				onClick={() => this.submit()}
			>
				Propose Peace at {dest}
			</Button>
		);

		return (
			<div
				style={{
					marginTop: 8,
					marginLeft: 30,
					padding: '8px 12px',
					border: '1px solid #fa8c16',
					borderRadius: 4,
					background: 'rgba(250,140,22,0.06)',
				}}
			>
				{commitInfo.map((info, i) => (
					<div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>
						{info}
					</div>
				))}
				{blockedReason ? (
					<Tooltip title={blockedReason}>
						{/* Wrap in span so Tooltip works on disabled button */}
						<span>{peaceButton}</span>
					</Tooltip>
				) : (
					peaceButton
				)}
			</div>
		);
	}

	/**
	 * Renders the final "Submit Maneuver" button after the last unit,
	 * only when no peace vote is needed and all units are planned.
	 */
	renderFinalSubmit() {
		let peaceStop = this.findFirstPeaceStop();
		if (peaceStop) return null; // Peace submit is inline
		if (!this.allPlanned()) return null;

		return (
			<div style={{ marginTop: 12 }}>
				<Button type="primary" loading={this.state.submitting} onClick={() => this.submit()}>
					Submit Maneuver
				</Button>
			</div>
		);
	}

	renderPhaseSection(phase) {
		let plans = phase === 'fleet' ? this.state.fleetPlans : this.state.armyPlans;
		let label = phase === 'fleet' ? 'FLEET MOVES' : 'ARMY MOVES';
		let peaceStop = this.findFirstPeaceStop();
		let isLastPhase = phase === 'army' || (phase === 'fleet' && this.state.armyPlans.length === 0);

		return (
			<div style={{ marginBottom: 16 }}>
				<div
					style={{
						fontWeight: 600,
						marginBottom: 8,
						textTransform: 'uppercase',
						fontSize: 12,
						letterSpacing: 1,
						color: 'rgba(255,255,255,0.45)',
					}}
				>
					{label}
				</div>
				{plans.map((plan, index) => this.renderUnitRow(phase, index, plan, peaceStop))}
				{isLastPhase && this.renderFinalSubmit()}
			</div>
		);
	}
}

ManeuverPlannerApp.contextType = UserContext;

export default ManeuverPlannerApp;
