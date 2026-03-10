import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './App.css';
import { Select, Button, Card, Tag, Radio, Steps, Tooltip } from 'antd';
import { LockOutlined, ArrowUpOutlined, ArrowDownOutlined, CheckCircleOutlined } from '@ant-design/icons';
import UserContext from './UserContext.js';
import MapInteractionContext from './MapInteractionContext.js';
import * as proposalAPI from './backendFiles/proposalAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { readGameState, readSetup } from './backendFiles/stateCache.js';
import { getCountryColorPalette } from './countryColors.js';

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
function ManeuverPlannerApp() {
	const context = useContext(UserContext);
	const mapInteraction = useContext(MapInteractionContext);
	const [loaded, setLoaded] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [country, setCountry] = useState('');
	const [currentManeuver, setCurrentManeuver] = useState(null);
	const [fleetPlans, setFleetPlans] = useState([]);
	const [armyPlans, setArmyPlans] = useState([]);
	const [priorCompleted, setPriorCompleted] = useState([]);
	const [territorySetup, setTerritorySetup] = useState({});
	const [pendingPeace, setPendingPeace] = useState(null);
	const [activeUnit, setActiveUnit] = useState(null);

	const contextRef = useRef(context);
	contextRef.current = context;

	// Use refs to access latest state in async callbacks
	const fleetPlansRef = useRef(fleetPlans);
	fleetPlansRef.current = fleetPlans;
	const armyPlansRef = useRef(armyPlans);
	armyPlansRef.current = armyPlans;
	const currentManeuverRef = useRef(currentManeuver);
	currentManeuverRef.current = currentManeuver;
	const countryRef = useRef(country);
	countryRef.current = country;
	const territorySetupRef = useRef(territorySetup);
	territorySetupRef.current = territorySetup;
	const activeUnitRef = useRef(activeUnit);
	activeUnitRef.current = activeUnit;
	const mapInteractionRef = useRef(mapInteraction);
	mapInteractionRef.current = mapInteraction;

	/**
	 * Returns a color that is visible against the dark map background.
	 * Germany's bright color is #000000 (black), invisible on the map.
	 */
	function ensureMapVisible(color) {
		if (!color || color.length < 7) return color || '#c9a84c';
		let r = parseInt(color.slice(1, 3), 16);
		let g = parseInt(color.slice(3, 5), 16);
		let b = parseInt(color.slice(5, 7), 16);
		let luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		if (luminance < 0.2) {
			return '#8c8c8c';
		}
		return color;
	}

	// Push active unit's destination options to the map hotspot layer
	useEffect(() => {
		if (!loaded || pendingPeace) {
			return;
		}

		let palette = getCountryColorPalette(context.colorblindMode);
		let countryColor = ensureMapVisible(palette.bright[country] || '#c9a84c');
		let dimColor = countryColor + '66';
		let goldColor = '#c9a84c';

		let selectables = [];
		let highlights = {};

		// Highlight planned destinations dimly
		fleetPlansRef.current.forEach((p) => {
			if (p.dest && p.dest !== p.origin) highlights[p.dest] = dimColor;
		});
		armyPlansRef.current.forEach((p) => {
			if (p.dest && p.dest !== p.origin) highlights[p.dest] = dimColor;
		});

		if (activeUnit) {
			let plans = activeUnit.phase === 'fleet' ? fleetPlansRef.current : armyPlansRef.current;
			let plan = plans[activeUnit.index];
			if (plan) {
				// Active unit origin gets gold highlight
				highlights[plan.origin] = goldColor;

				// Destination options are the selectable items
				if (plan.destOptions) {
					selectables = [...plan.destOptions];
				}
			}
		}

		mapInteraction.setInteraction(
			'select-territory',
			selectables,
			countryColor,
			(name) => {
				let au = activeUnitRef.current;
				if (au) {
					onDestChange(au.phase, au.index, name);
				}
			},
			highlights
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeUnit, loaded, pendingPeace, country]);

	// Cleanup map interaction on unmount
	useEffect(() => {
		return () => {
			mapInteractionRef.current.clearInteraction();
		};
	}, []);

	// Push planned moves for arrows
	useEffect(() => {
		if (!loaded || !mapInteraction.setPlannedMoves) return;
		let palette = getCountryColorPalette(context.colorblindMode);
		let countryColor = ensureMapVisible(palette.bright[country] || '#c9a84c');
		let moves = [];
		fleetPlans.forEach((p) => {
			if (p.dest && p.dest !== p.origin) {
				moves.push({ origin: p.origin, dest: p.dest, color: countryColor });
			}
		});
		armyPlans.forEach((p) => {
			if (p.dest && p.dest !== p.origin) {
				moves.push({ origin: p.origin, dest: p.dest, color: countryColor });
			}
		});
		mapInteraction.setPlannedMoves(moves);
		return () => {
			if (mapInteractionRef.current.setPlannedMoves) {
				mapInteractionRef.current.setPlannedMoves([]);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loaded, fleetPlans, armyPlans, country]);

	// Push unit markers to the map layer
	useEffect(() => {
		if (!loaded || !mapInteraction.setUnitMarkers) return;

		let palette = getCountryColorPalette(context.colorblindMode);
		let countryColor = ensureMapVisible(palette.bright[country] || '#c9a84c');

		let markers = [];
		fleetPlans.forEach((p, i) => {
			markers.push({
				territoryName: p.origin,
				unitType: 'fleet',
				phase: 'fleet',
				index: i,
				isActive: activeUnit && activeUnit.phase === 'fleet' && activeUnit.index === i,
				isPlanned: !!p.dest,
				color: countryColor,
			});
		});
		armyPlans.forEach((p, i) => {
			markers.push({
				territoryName: p.origin,
				unitType: 'army',
				phase: 'army',
				index: i,
				isActive: activeUnit && activeUnit.phase === 'army' && activeUnit.index === i,
				isPlanned: !!p.dest,
				color: countryColor,
			});
		});

		mapInteraction.setUnitMarkers(markers);

		// Set the callback for when a unit marker is clicked
		if (mapInteraction.setOnUnitMarkerClickedCb) {
			mapInteraction.setOnUnitMarkerClickedCb(() => (phase, index) => {
				setActiveUnit({ phase, index });
			});
		}

		return () => {
			if (mapInteractionRef.current.setUnitMarkers) {
				mapInteractionRef.current.setUnitMarkers([]);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loaded, fleetPlans, armyPlans, activeUnit, country]);

	/**
	 * Builds a ManeuverPlan object from current state for proposalAPI calls.
	 */
	function buildPlan() {
		let cm = currentManeuverRef.current;
		return {
			country: cm.country,
			pendingFleets: cm.pendingFleets || [],
			pendingArmies: cm.pendingArmies || [],
			fleetTuples: fleetPlansRef.current.map((p) => [p.origin, p.dest || '', p.action || '']),
			armyTuples: armyPlansRef.current.map((p) => [p.origin, p.dest || '', p.action || '']),
		};
	}

	/**
	 * Checks whether a planned move would trigger a peace vote.
	 */
	function wouldTriggerPeaceVote(plan) {
		if (!plan.dest || plan.dest === plan.origin) return false;
		if (!isPeaceAction(plan.action) && !hasJsonPeaceAction(plan.action)) return false;

		let ts = territorySetupRef.current;
		let destCountry = ts[plan.dest] && ts[plan.dest].country;
		if (!destCountry || destCountry === countryRef.current) return false;

		let opts = plan.actionOptions;
		if (Array.isArray(opts)) {
			return opts.some((a) => a.startsWith('war '));
		}
		if (opts && opts.countries) {
			return true;
		}
		return false;
	}

	function hasJsonPeaceAction(action) {
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

	function detectPeaceVotesOn(fPlans, aPlans) {
		let newFleet = fPlans.map((p) => ({ ...p, peaceVote: wouldTriggerPeaceVote(p) }));
		let newArmy = aPlans.map((p) => ({ ...p, peaceVote: wouldTriggerPeaceVote(p) }));
		setFleetPlans(newFleet);
		setArmyPlans(newArmy);
	}

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

	async function computeOptionsForUnit(phase, index) {
		let plan = buildPlan();
		try {
			let destOptions = await proposalAPI.getUnitOptionsFromPlans(contextRef.current, plan, phase, index);
			if (phase === 'fleet') {
				setFleetPlans((prev) => {
					let plans = [...prev];
					if (plans[index]) {
						plans[index] = { ...plans[index], destOptions: destOptions || [] };
					}
					return plans;
				});
			} else {
				setArmyPlans((prev) => {
					let plans = [...prev];
					if (plans[index]) {
						plans[index] = { ...plans[index], destOptions: destOptions || [] };
					}
					return plans;
				});
			}
		} catch (e) {
			console.error('Failed to compute options for', phase, index, e);
		}
	}

	async function computeActionOptionsForUnit(phase, index, dest) {
		let plan = buildPlan();
		try {
			let actionOptions = await proposalAPI.getUnitActionOptionsFromPlans(contextRef.current, plan, phase, index, dest);
			if (phase === 'fleet') {
				setFleetPlans((prev) => {
					let plans = [...prev];
					if (plans[index]) {
						plans[index] = { ...plans[index], actionOptions: actionOptions || [] };
						if (Array.isArray(actionOptions)) {
							if (actionOptions.includes('hostile')) {
								plans[index].action = 'hostile';
							} else if (actionOptions.length === 1) {
								plans[index].action = actionOptions[0];
							}
						}
					}
					return plans;
				});
			} else {
				setArmyPlans((prev) => {
					let plans = [...prev];
					if (plans[index]) {
						plans[index] = { ...plans[index], actionOptions: actionOptions || [] };
						if (Array.isArray(actionOptions)) {
							if (actionOptions.includes('hostile')) {
								plans[index].action = 'hostile';
							} else if (actionOptions.length === 1) {
								plans[index].action = actionOptions[0];
							}
						}
					}
					return plans;
				});
			}
			// Detect peace votes after action options update
			// Use a short delay to let state settle
			setTimeout(() => {
				detectPeaceVotesOn(fleetPlansRef.current, armyPlansRef.current);
			}, 0);
		} catch (e) {
			console.error('Failed to compute action options for', phase, index, e);
		}
	}

	const loadData = useCallback(async () => {
		try {
			let gameState = await readGameState(contextRef.current);
			let cm = gameState.currentManeuver;
			if (!cm) return;

			let tSetup = await readSetup(gameState.setup + '/territories');

			// Check if there's a pending peace vote for dictator
			if (cm.pendingPeace) {
				let targetCountry = cm.pendingPeace.targetCountry;
				let dictator = gameState.countryInfo[targetCountry].leadership[0];
				if (dictator === contextRef.current.name) {
					setLoaded(true);
					setCurrentManeuver(cm);
					setPendingPeace(cm.pendingPeace);
					setPriorCompleted(buildCompletedMovesList(cm));
					return;
				}
			}

			// Build prior completed moves list (from previous peace vote rounds)
			let priorCompletedMoves = buildCompletedMovesList(cm);

			// Initialize fleet plans
			let initFleetPlans = (cm.pendingFleets || []).map((unit) => ({
				origin: unit.territory,
				dest: '',
				action: '',
				destOptions: [],
				actionOptions: [],
				peaceVote: false,
			}));

			// Initialize army plans
			let initArmyPlans = (cm.pendingArmies || []).map((unit) => ({
				origin: unit.territory,
				dest: '',
				action: '',
				destOptions: [],
				actionOptions: [],
				peaceVote: false,
			}));

			// Pre-populate from remainingFleetPlans/remainingArmyPlans if resuming
			if (cm.remainingFleetPlans && cm.remainingFleetPlans.length > 0) {
				for (let i = 0; i < cm.remainingFleetPlans.length && i < initFleetPlans.length; i++) {
					let tuple = cm.remainingFleetPlans[i];
					initFleetPlans[i].dest = tuple[1] || '';
					initFleetPlans[i].action = tuple[2] || '';
				}
			}
			if (cm.remainingArmyPlans && cm.remainingArmyPlans.length > 0) {
				for (let i = 0; i < cm.remainingArmyPlans.length && i < initArmyPlans.length; i++) {
					let tuple = cm.remainingArmyPlans[i];
					initArmyPlans[i].dest = tuple[1] || '';
					initArmyPlans[i].action = tuple[2] || '';
				}
			}

			setLoaded(true);
			setCurrentManeuver(cm);
			setCountry(cm.country);
			setTerritorySetup(tSetup);
			setFleetPlans(initFleetPlans);
			setArmyPlans(initArmyPlans);
			setPriorCompleted(priorCompletedMoves);
			setPendingPeace(null);

			// Need to use the plans we just created for computing options
			// Update refs immediately for buildPlan
			currentManeuverRef.current = cm;
			countryRef.current = cm.country;
			territorySetupRef.current = tSetup;
			fleetPlansRef.current = initFleetPlans;
			armyPlansRef.current = initArmyPlans;

			// Compute destination options for all units
			let allPromises = [];
			for (let i = 0; i < initFleetPlans.length; i++) {
				allPromises.push(
					(async (idx) => {
						let plan = {
							country: cm.country,
							pendingFleets: cm.pendingFleets || [],
							pendingArmies: cm.pendingArmies || [],
							fleetTuples: initFleetPlans.map((p) => [p.origin, p.dest || '', p.action || '']),
							armyTuples: initArmyPlans.map((p) => [p.origin, p.dest || '', p.action || '']),
						};
						let destOptions = await proposalAPI.getUnitOptionsFromPlans(contextRef.current, plan, 'fleet', idx);
						initFleetPlans[idx] = { ...initFleetPlans[idx], destOptions: destOptions || [] };
					})(i)
				);
			}
			for (let i = 0; i < initArmyPlans.length; i++) {
				allPromises.push(
					(async (idx) => {
						let plan = {
							country: cm.country,
							pendingFleets: cm.pendingFleets || [],
							pendingArmies: cm.pendingArmies || [],
							fleetTuples: initFleetPlans.map((p) => [p.origin, p.dest || '', p.action || '']),
							armyTuples: initArmyPlans.map((p) => [p.origin, p.dest || '', p.action || '']),
						};
						let destOptions = await proposalAPI.getUnitOptionsFromPlans(contextRef.current, plan, 'army', idx);
						initArmyPlans[idx] = { ...initArmyPlans[idx], destOptions: destOptions || [] };
					})(i)
				);
			}
			await Promise.all(allPromises);

			// If resuming with pre-populated plans, compute action options too
			for (let i = 0; i < initFleetPlans.length; i++) {
				if (initFleetPlans[i].dest) {
					let plan = {
						country: cm.country,
						pendingFleets: cm.pendingFleets || [],
						pendingArmies: cm.pendingArmies || [],
						fleetTuples: initFleetPlans.map((p) => [p.origin, p.dest || '', p.action || '']),
						armyTuples: initArmyPlans.map((p) => [p.origin, p.dest || '', p.action || '']),
					};
					let actionOptions = await proposalAPI.getUnitActionOptionsFromPlans(
						contextRef.current,
						plan,
						'fleet',
						i,
						initFleetPlans[i].dest
					);
					initFleetPlans[i] = { ...initFleetPlans[i], actionOptions: actionOptions || [] };
					if (Array.isArray(actionOptions)) {
						if (actionOptions.includes('hostile')) {
							initFleetPlans[i].action = 'hostile';
						} else if (actionOptions.length === 1) {
							initFleetPlans[i].action = actionOptions[0];
						}
					}
				}
			}
			for (let i = 0; i < initArmyPlans.length; i++) {
				if (initArmyPlans[i].dest) {
					let plan = {
						country: cm.country,
						pendingFleets: cm.pendingFleets || [],
						pendingArmies: cm.pendingArmies || [],
						fleetTuples: initFleetPlans.map((p) => [p.origin, p.dest || '', p.action || '']),
						armyTuples: initArmyPlans.map((p) => [p.origin, p.dest || '', p.action || '']),
					};
					let actionOptions = await proposalAPI.getUnitActionOptionsFromPlans(
						contextRef.current,
						plan,
						'army',
						i,
						initArmyPlans[i].dest
					);
					initArmyPlans[i] = { ...initArmyPlans[i], actionOptions: actionOptions || [] };
					if (Array.isArray(actionOptions)) {
						if (actionOptions.includes('hostile')) {
							initArmyPlans[i].action = 'hostile';
						} else if (actionOptions.length === 1) {
							initArmyPlans[i].action = actionOptions[0];
						}
					}
				}
			}

			// Update state with fully computed plans
			setFleetPlans([...initFleetPlans]);
			setArmyPlans([...initArmyPlans]);
			fleetPlansRef.current = initFleetPlans;
			armyPlansRef.current = initArmyPlans;

			// Auto-activate the first unit so map hotspots appear immediately
			if (initFleetPlans.length > 0) {
				setActiveUnit({ phase: 'fleet', index: 0 });
			} else if (initArmyPlans.length > 0) {
				setActiveUnit({ phase: 'army', index: 0 });
			}
		} catch (e) {
			console.error('ManeuverPlannerApp failed to load:', e);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/**
	 * Finds the next unplanned unit after the given one, or null.
	 */
	function findNextUnplannedUnit(currentPhase, currentIndex) {
		let plans = currentPhase === 'fleet' ? fleetPlansRef.current : armyPlansRef.current;
		for (let i = currentIndex + 1; i < plans.length; i++) {
			if (!plans[i].dest) return { phase: currentPhase, index: i };
		}
		// Check other phase
		let otherPhase = currentPhase === 'fleet' ? 'army' : 'fleet';
		let otherPlans = otherPhase === 'fleet' ? fleetPlansRef.current : armyPlansRef.current;
		for (let i = 0; i < otherPlans.length; i++) {
			if (!otherPlans[i].dest) return { phase: otherPhase, index: i };
		}
		// Also check earlier in same phase
		for (let i = 0; i < currentIndex; i++) {
			if (!plans[i].dest) return { phase: currentPhase, index: i };
		}
		return null;
	}

	async function onDestChange(phase, index, value) {
		if (phase === 'fleet') {
			setFleetPlans((prev) => {
				let plans = [...prev];
				plans[index] = { ...plans[index], dest: value, action: '', actionOptions: [], peaceVote: false };
				fleetPlansRef.current = plans;
				return plans;
			});
		} else {
			setArmyPlans((prev) => {
				let plans = [...prev];
				plans[index] = { ...plans[index], dest: value, action: '', actionOptions: [], peaceVote: false };
				armyPlansRef.current = plans;
				return plans;
			});
		}

		await computeActionOptionsForUnit(phase, index, value);
		// Refresh dest options for subsequent units since virtual state changed
		let currentPlans = phase === 'fleet' ? fleetPlansRef.current : armyPlansRef.current;
		for (let i = index + 1; i < currentPlans.length; i++) {
			await computeOptionsForUnit(phase, i);
		}
		// If a fleet changed, also refresh all army options
		if (phase === 'fleet') {
			for (let i = 0; i < armyPlansRef.current.length; i++) {
				await computeOptionsForUnit('army', i);
			}
		}

		// Auto-advance only when the action choice is unambiguous:
		// - exactly 1 action option (no choice to make), or
		// - no action options at all (staying in place)
		let updatedPlan = (phase === 'fleet' ? fleetPlansRef.current : armyPlansRef.current)[index];
		if (updatedPlan && updatedPlan.action) {
			let opts = updatedPlan.actionOptions;
			let onlyOneChoice = Array.isArray(opts) && opts.length <= 1;
			if (onlyOneChoice) {
				let next = findNextUnplannedUnit(phase, index);
				if (next) {
					setActiveUnit(next);
				}
			}
		}
	}

	function onActionChange(phase, index, value) {
		if (phase === 'fleet') {
			setFleetPlans((prev) => {
				let plans = [...prev];
				plans[index] = { ...plans[index], action: value };
				fleetPlansRef.current = plans;
				return plans;
			});
		} else {
			setArmyPlans((prev) => {
				let plans = [...prev];
				plans[index] = { ...plans[index], action: value };
				armyPlansRef.current = plans;
				return plans;
			});
		}
		setTimeout(() => {
			detectPeaceVotesOn(fleetPlansRef.current, armyPlansRef.current);
		}, 0);
	}

	async function onReorderUnit(phase, fromIndex, toIndex) {
		let plans = phase === 'fleet' ? [...fleetPlansRef.current] : [...armyPlansRef.current];
		if (toIndex < 0 || toIndex >= plans.length) return;

		// Swap units, preserving their planned dest/action
		let temp = plans[fromIndex];
		plans[fromIndex] = plans[toIndex];
		plans[toIndex] = temp;

		if (phase === 'fleet') {
			setFleetPlans(plans);
			fleetPlansRef.current = plans;
		} else {
			setArmyPlans(plans);
			armyPlansRef.current = plans;
		}

		// Recompute destOptions/actionOptions for affected units in the background
		let startFrom = Math.min(fromIndex, toIndex);
		for (let i = startFrom; i < plans.length; i++) {
			await computeOptionsForUnit(phase, i);
			let current = phase === 'fleet' ? fleetPlansRef.current : armyPlansRef.current;
			if (current[i] && current[i].dest) {
				await computeActionOptionsForUnit(phase, i, current[i].dest);
			}
		}
		detectPeaceVotesOn(fleetPlansRef.current, armyPlansRef.current);
	}

	/**
	 * Finds the first peace-vote-triggering move, or null if none.
	 */
	function findFirstPeaceStop() {
		for (let i = 0; i < fleetPlans.length; i++) {
			if (fleetPlans[i].peaceVote) {
				return { phase: 'fleet', index: i };
			}
		}
		for (let i = 0; i < armyPlans.length; i++) {
			if (armyPlans[i].peaceVote) {
				return { phase: 'army', index: i };
			}
		}
		return null;
	}

	/**
	 * Checks if all units have been planned (have a destination).
	 */
	function allPlanned() {
		let peaceStop = findFirstPeaceStop();

		if (peaceStop) {
			if (peaceStop.phase === 'fleet') {
				for (let i = 0; i <= peaceStop.index; i++) {
					if (!fleetPlans[i].dest) return false;
				}
				return true;
			} else {
				for (let f of fleetPlans) {
					if (!f.dest) return false;
				}
				for (let i = 0; i <= peaceStop.index; i++) {
					if (!armyPlans[i].dest) return false;
				}
				return true;
			}
		}

		for (let f of fleetPlans) {
			if (!f.dest) return false;
		}
		for (let a of armyPlans) {
			if (!a.dest) return false;
		}
		return true;
	}

	async function submit() {
		setSubmitting(true);
		try {
			let fleetMan = fleetPlans.map((p) => [p.origin, p.dest, p.action || '']);
			let armyMan = armyPlans.map((p) => [p.origin, p.dest, p.action || '']);

			context.setFleetMan(fleetMan);
			context.setArmyMan(armyMan);

			await submitAPI.submitBatchManeuver({
				...context,
				fleetMan,
				armyMan,
			});
		} finally {
			setSubmitting(false);
		}
	}

	async function submitDictatorVote(choice) {
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

	function getPerCountryAction(phase, index, countryName) {
		let plans = phase === 'fleet' ? fleetPlans : armyPlans;
		let action = plans[index].action;
		if (!action) return undefined;
		try {
			let parsed = JSON.parse(action);
			if (Array.isArray(parsed)) {
				let entry = parsed.find((e) => e.country === countryName);
				return entry ? entry.action : undefined;
			}
		} catch (e) {
			// Not JSON — single action string
		}
		return undefined;
	}

	function isOtherAction(phase, index, opts) {
		let plans = phase === 'fleet' ? fleetPlans : armyPlans;
		let action = plans[index].action;
		if (!action) return false;
		return opts.otherActions && opts.otherActions.includes(action);
	}

	function onPerCountryActionChange(phase, index, countryName, value) {
		let setter = phase === 'fleet' ? setFleetPlans : setArmyPlans;
		setter((prev) => {
			let plans = [...prev];
			let current = plans[index].action;
			let choices = [];
			try {
				let parsed = JSON.parse(current);
				if (Array.isArray(parsed)) choices = parsed;
			} catch (e) {
				// fresh start
			}

			let existingIndex = choices.findIndex((c) => c.country === countryName);
			if (existingIndex >= 0) {
				choices[existingIndex].action = value;
			} else {
				choices.push({ country: countryName, action: value, order: choices.length + 1 });
			}

			plans[index] = { ...plans[index], action: JSON.stringify(choices) };
			let hasPeace = choices.some((c) => c.action === 'peace');
			plans[index].peaceVote = hasPeace;

			if (phase === 'fleet') {
				fleetPlansRef.current = plans;
			} else {
				armyPlansRef.current = plans;
			}
			return plans;
		});
	}

	function getBlockedReason(peaceStop) {
		if (!peaceStop) {
			let unplannedFleets = fleetPlans.filter((p) => !p.dest).length;
			let unplannedArmies = armyPlans.filter((p) => !p.dest).length;
			let parts = [];
			if (unplannedFleets > 0) parts.push(unplannedFleets + ' fleet move' + (unplannedFleets > 1 ? 's' : ''));
			if (unplannedArmies > 0) parts.push(unplannedArmies + ' army move' + (unplannedArmies > 1 ? 's' : ''));
			return parts.length > 0 ? 'Plan ' + parts.join(' and ') + ' first' : '';
		}

		if (peaceStop.phase === 'army') {
			let unplannedFleets = fleetPlans.filter((p) => !p.dest).length;
			let unplannedArmies = 0;
			for (let i = 0; i <= peaceStop.index; i++) {
				if (!armyPlans[i].dest) unplannedArmies++;
			}
			let parts = [];
			if (unplannedFleets > 0) parts.push(unplannedFleets + ' fleet move' + (unplannedFleets > 1 ? 's' : ''));
			if (unplannedArmies > 0) parts.push(unplannedArmies + ' army move' + (unplannedArmies > 1 ? 's' : ''));
			return parts.length > 0 ? 'Plan ' + parts.join(' and ') + ' first' : '';
		}

		let unplannedFleets = 0;
		for (let i = 0; i <= peaceStop.index; i++) {
			if (!fleetPlans[i].dest) unplannedFleets++;
		}
		if (unplannedFleets > 0)
			return 'Plan ' + unplannedFleets + ' fleet move' + (unplannedFleets > 1 ? 's' : '') + ' first';
		return '';
	}

	// ---- Rendering ----

	function renderPeaceVote() {
		let peace = pendingPeace;
		let cm = currentManeuver;
		return (
			<div>
				{renderPriorCompleted()}
				<Card title="Peace Offer" size="small" style={{ marginTop: 8 }}>
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

	function renderPriorCompleted() {
		if (priorCompleted.length === 0) return null;
		return (
			<Card title="Committed Moves" size="small" style={{ marginBottom: 8 }}>
				{priorCompleted.map((desc, i) => (
					<div key={i} style={{ padding: '2px 0', color: 'rgba(255,255,255,0.65)' }}>
						{desc}
					</div>
				))}
			</Card>
		);
	}

	function renderActionControls(phase, index, plan) {
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
								value={getPerCountryAction(phase, index, entry.country)}
								onChange={(e) => onPerCountryActionChange(phase, index, entry.country, e.target.value)}
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
								value={isOtherAction(phase, index, opts) ? plan.action : undefined}
								onChange={(e) => onActionChange(phase, index, e.target.value)}
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
					<Radio.Group onChange={(e) => onActionChange(phase, index, e.target.value)} value={plan.action}>
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

	function renderPlanningControls(phase, index, plan) {
		return (
			<div style={{ paddingLeft: 30 }}>
				<div style={{ marginBottom: 10 }}>
					<label style={{ marginRight: 8, color: 'rgba(255,255,255,0.65)' }}>Destination:</label>
					<Select
						style={{ width: 220 }}
						placeholder="Select destination"
						value={plan.dest || undefined}
						onChange={(v) => onDestChange(phase, index, v)}
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

				{renderActionControls(phase, index, plan)}
			</div>
		);
	}

	function isPeaceStopHere(phase, index, peaceStop) {
		return peaceStop && peaceStop.phase === phase && peaceStop.index === index;
	}

	function renderInlinePeaceSubmit(phase, index) {
		let plan = phase === 'fleet' ? fleetPlans[index] : armyPlans[index];
		let dest = plan.dest;

		let commitInfo = [];
		if (phase === 'fleet') {
			if (index > 0) commitInfo.push(index + ' fleet move(s) will execute.');
			commitInfo.push('Proposing peace at ' + dest + '.');
			if (index < fleetPlans.length - 1)
				commitInfo.push(fleetPlans.length - index - 1 + ' fleet move(s) staged for later.');
			if (armyPlans.length > 0) commitInfo.push(armyPlans.length + ' army move(s) staged for later.');
		} else {
			if (fleetPlans.length > 0) commitInfo.push('All ' + fleetPlans.length + ' fleet move(s) will execute.');
			if (index > 0) commitInfo.push(index + ' army move(s) will execute.');
			commitInfo.push('Proposing peace at ' + dest + '.');
			if (index < armyPlans.length - 1)
				commitInfo.push(armyPlans.length - index - 1 + ' army move(s) staged for later.');
		}

		let canSubmit = allPlanned();
		let peaceStop = findFirstPeaceStop();
		let blockedReason = canSubmit ? '' : getBlockedReason(peaceStop);

		let peaceButton = (
			<Button
				type="primary"
				style={{ marginTop: 6, background: '#fa8c16', borderColor: '#fa8c16' }}
				loading={submitting}
				disabled={!canSubmit}
				onClick={() => submit()}
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
					background: 'rgba(250,140,22,0.06)',
					borderRadius: 4,
					border: '1px solid rgba(250,140,22,0.2)',
				}}
			>
				{commitInfo.map((info, i) => (
					<div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>
						{info}
					</div>
				))}
				{blockedReason ? (
					<Tooltip title={blockedReason}>
						<span>{peaceButton}</span>
					</Tooltip>
				) : (
					peaceButton
				)}
			</div>
		);
	}

	function renderUnitRow(phase, index, plan, peaceStop) {
		let isPlanned = !!plan.dest;
		let plans = phase === 'fleet' ? fleetPlans : armyPlans;
		let unitLabel = phase === 'fleet' ? 'Fleet' : 'Army';
		let unitNum = index + 1;
		let totalUnits = plans.length;

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
					<span style={{ marginRight: 8, display: 'flex', flexDirection: 'column', gap: 0 }}>
						<Tooltip title="Move up" mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
							<Button
								type="text"
								size="small"
								icon={<ArrowUpOutlined />}
								disabled={index === 0}
								onClick={() => onReorderUnit(phase, index, index - 1)}
								style={{ padding: '0 4px', height: 18, fontSize: 10 }}
							/>
						</Tooltip>
						<Tooltip title="Move down" mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
							<Button
								type="text"
								size="small"
								icon={<ArrowDownOutlined />}
								disabled={index === totalUnits - 1}
								onClick={() => onReorderUnit(phase, index, index + 1)}
								style={{ padding: '0 4px', height: 18, fontSize: 10 }}
							/>
						</Tooltip>
					</span>

					<span style={{ flex: 1 }}>
						<strong>
							{unitLabel} {unitNum}:
						</strong>{' '}
						{plan.origin}
					</span>

					{isPlanned && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 4, fontSize: 14 }} />}
					{plan.peaceVote && (
						<Tag color="orange" style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px' }}>
							PEACE VOTE
						</Tag>
					)}
				</div>

				{renderPlanningControls(phase, index, plan)}

				{plan.peaceVote && isPeaceStopHere(phase, index, peaceStop) && renderInlinePeaceSubmit(phase, index)}
			</div>
		);
	}

	function renderFinalSubmit() {
		let peaceStop = findFirstPeaceStop();
		if (peaceStop) return null;
		if (!allPlanned()) return null;

		return (
			<div style={{ marginTop: 12 }}>
				<Button type="primary" loading={submitting} onClick={() => submit()}>
					Submit Maneuver
				</Button>
			</div>
		);
	}

	function renderPhaseSection(phase) {
		let plans = phase === 'fleet' ? fleetPlans : armyPlans;
		let label = phase === 'fleet' ? 'FLEET MOVES' : 'ARMY MOVES';
		let peaceStop = findFirstPeaceStop();
		let isLastPhase = phase === 'army' || (phase === 'fleet' && armyPlans.length === 0);

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
				{plans.map((plan, index) => renderUnitRow(phase, index, plan, peaceStop))}
				{isLastPhase && renderFinalSubmit()}
			</div>
		);
	}

	if (!loaded) {
		return <div style={{ textAlign: 'center', padding: 40 }}>Loading maneuver...</div>;
	}

	// Dictator peace vote pending
	if (pendingPeace) {
		return renderPeaceVote();
	}

	let cm = currentManeuver;
	if (!cm) {
		return <div style={{ textAlign: 'center', padding: 40 }}>Waiting for maneuver...</div>;
	}

	let fleetCount = fleetPlans.length;
	let armyCount = armyPlans.length;
	let phaseIndex = 0;
	let steps = [];
	if (fleetCount > 0) steps.push({ title: 'Fleets (' + fleetCount + ')' });
	if (armyCount > 0) steps.push({ title: 'Armies (' + armyCount + ')' });
	if (steps.length === 2) {
		phaseIndex = 0; // always show both
	}

	return (
		<div>
			{renderPriorCompleted()}

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

			{fleetCount > 0 && renderPhaseSection('fleet')}
			{armyCount > 0 && renderPhaseSection('army')}
		</div>
	);
}

export default ManeuverPlannerApp;
