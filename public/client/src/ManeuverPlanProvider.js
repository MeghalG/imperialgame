import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import UserContext from './UserContext.js';
import MapInteractionContext from './MapInteractionContext.js';
import ManeuverPlanContext from './ManeuverPlanContext.js';
import * as proposalAPI from './backendFiles/proposalAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { readGameState, readSetup } from './backendFiles/stateCache.js';
import { getCountryColorPalette } from './countryColors.js';
import { normalizeAction, denormalizeAction, isPeaceAction, formatCompletedAction } from './maneuverActionUtils.js';
import SoundManager from './SoundManager.js';

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

/**
 * ManeuverPlanProvider
 *
 * React Context provider that owns ALL maneuver plan state and logic.
 * Extracted from ManeuverPlannerApp.js — the remaining component becomes
 * a thin rendering wrapper in a later task.
 *
 * Responsibilities:
 * - All useState/useEffect/useCallback for maneuver planning
 * - Map interaction effects (territory hotspots, planned moves, unit markers)
 * - localStorage persistence of draft plans
 * - Peace vote detection and locking
 * - Submit logic
 */
function ManeuverPlanProvider({ children }) {
	const context = useContext(UserContext);
	const mapInteraction = useContext(MapInteractionContext);

	// ===== State =====
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
	const [lockLine, setLockLine] = useState(null);
	const [actionPickerState, setActionPickerState] = useState(null); // { phase, index, position: {x,y}, actions }

	// ===== Refs (for async callbacks) =====
	const contextRef = useRef(context);
	contextRef.current = context;
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
	const lockLineRef = useRef(lockLine);
	lockLineRef.current = lockLine;

	// ===== localStorage persistence =====

	function getDraftKey() {
		return 'maneuverDraft_' + (contextRef.current.game || '');
	}

	function saveDraftToLocalStorage(fPlans, aPlans) {
		try {
			let key = getDraftKey();
			if (!key || key === 'maneuverDraft_') return;
			localStorage.setItem(
				key,
				JSON.stringify({
					fleetPlans: fPlans.map((p) => ({ origin: p.origin, dest: p.dest, action: p.action })),
					armyPlans: aPlans.map((p) => ({ origin: p.origin, dest: p.dest, action: p.action })),
				})
			);
		} catch (_e) {
			// localStorage full or disabled
		}
	}

	function loadDraftFromLocalStorage(initFleetPlans, initArmyPlans) {
		try {
			let key = getDraftKey();
			if (!key || key === 'maneuverDraft_') return null;
			let raw = localStorage.getItem(key);
			if (!raw) return null;
			let draft = JSON.parse(raw);
			if (!draft || !draft.fleetPlans || !draft.armyPlans) return null;
			// Validate unit counts match
			if (draft.fleetPlans.length !== initFleetPlans.length) return null;
			if (draft.armyPlans.length !== initArmyPlans.length) return null;
			// Validate origins match
			for (let i = 0; i < draft.fleetPlans.length; i++) {
				if (draft.fleetPlans[i].origin !== initFleetPlans[i].origin) return null;
			}
			for (let i = 0; i < draft.armyPlans.length; i++) {
				if (draft.armyPlans[i].origin !== initArmyPlans[i].origin) return null;
			}
			return draft;
		} catch (_e) {
			return null;
		}
	}

	function clearDraftFromLocalStorage() {
		try {
			let key = getDraftKey();
			if (key && key !== 'maneuverDraft_') {
				localStorage.removeItem(key);
			}
		} catch (_e) {
			// ignore
		}
	}

	// Save drafts to localStorage whenever plans change
	useEffect(() => {
		if (!loaded) return;
		saveDraftToLocalStorage(fleetPlans, armyPlans);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fleetPlans, armyPlans, loaded]);

	// ===== Helper functions =====

	function buildPlan() {
		let cm = currentManeuverRef.current;
		return {
			country: cm.country,
			pendingFleets: cm.pendingFleets || [],
			pendingArmies: cm.pendingArmies || [],
			fleetTuples: fleetPlansRef.current.map((p) => [
				p.origin,
				p.dest || '',
				denormalizeAction(normalizeAction(p.action || '')),
			]),
			armyTuples: armyPlansRef.current.map((p) => [
				p.origin,
				p.dest || '',
				denormalizeAction(normalizeAction(p.action || '')),
			]),
		};
	}

	function wouldTriggerPeaceVote(plan) {
		if (!plan.dest || plan.dest === plan.origin) return false;
		if (!isPeaceAction(plan.action) && !hasJsonPeaceAction(plan.action)) return false;

		let ts = territorySetupRef.current;
		let destCountry = ts[plan.dest] && ts[plan.dest].country;
		if (!destCountry || destCountry === countryRef.current) return false;

		// Action is peace and destination is foreign territory — peace vote triggers
		return true;
	}

	function hasJsonPeaceAction(action) {
		if (!action) return false;
		try {
			let parsed = JSON.parse(action);
			if (Array.isArray(parsed)) {
				return parsed.some((e) => e.action === 'peace');
			}
		} catch (_e) {
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

	// ===== Options computation =====

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

	async function computeActionOptionsForUnit(phase, index, dest, clickPosition) {
		let plan = buildPlan();
		try {
			let actionOptions = await proposalAPI.getUnitActionOptionsFromPlans(contextRef.current, plan, phase, index, dest);
			let setter = phase === 'fleet' ? setFleetPlans : setArmyPlans;
			let ref = phase === 'fleet' ? fleetPlansRef : armyPlansRef;

			// Determine if we can auto-assign (only 1 option or no options)
			let canAutoAssign = false;
			let autoAction = '';
			if (Array.isArray(actionOptions)) {
				if (actionOptions.length === 0) {
					canAutoAssign = true;
				} else if (actionOptions.length === 1) {
					canAutoAssign = true;
					autoAction = actionOptions[0];
				}
			} else if (actionOptions && !Array.isArray(actionOptions)) {
				// Grouped format — always needs picker
				canAutoAssign = false;
			}

			setter((prev) => {
				let plans = [...prev];
				if (plans[index]) {
					plans[index] = { ...plans[index], actionOptions: actionOptions || [] };
					if (canAutoAssign) {
						plans[index].action = autoAction;
					}
				}
				ref.current = plans;
				return plans;
			});

			// If >1 option, show the action picker at click position
			if (!canAutoAssign && clickPosition) {
				setActionPickerState({
					phase,
					index,
					position: clickPosition,
					actions: actionOptions,
				});
			}

			setTimeout(() => {
				detectPeaceVotesOn(fleetPlansRef.current, armyPlansRef.current);
			}, 0);

			return canAutoAssign;
		} catch (e) {
			console.error('Failed to compute action options for', phase, index, e);
			return true; // Treat error as auto-assign (no picker)
		}
	}

	// ===== Navigation =====

	function findNextUnplannedUnit(currentPhase, currentIndex) {
		let plans = currentPhase === 'fleet' ? fleetPlansRef.current : armyPlansRef.current;
		for (let i = currentIndex + 1; i < plans.length; i++) {
			if (!plans[i].dest) return { phase: currentPhase, index: i };
		}
		let otherPhase = currentPhase === 'fleet' ? 'army' : 'fleet';
		let otherPlans = otherPhase === 'fleet' ? fleetPlansRef.current : armyPlansRef.current;
		for (let i = 0; i < otherPlans.length; i++) {
			if (!otherPlans[i].dest) return { phase: otherPhase, index: i };
		}
		for (let i = 0; i < currentIndex; i++) {
			if (!plans[i].dest) return { phase: currentPhase, index: i };
		}
		return null;
	}

	// ===== Actions exposed via context =====

	/**
	 * assignMove — handles destination selection and auto-computes action options.
	 * Called when user picks a destination from the map or dropdown.
	 * @param {string} phase - 'fleet' or 'army'
	 * @param {number} index - unit index
	 * @param {string} dest - destination territory name
	 * @param {{x: number, y: number}|null} clickPosition - screen position for action picker
	 */
	async function assignMove(phase, index, dest, clickPosition) {
		SoundManager.playDestination();
		// Dismiss any open action picker
		setActionPickerState(null);

		let setter = phase === 'fleet' ? setFleetPlans : setArmyPlans;
		let ref = phase === 'fleet' ? fleetPlansRef : armyPlansRef;
		setter((prev) => {
			let plans = [...prev];
			plans[index] = { ...plans[index], dest: dest, action: '', actionOptions: [], peaceVote: false };
			ref.current = plans;
			return plans;
		});

		let autoAssigned = await computeActionOptionsForUnit(phase, index, dest, clickPosition);

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

		// Auto-advance to next unplanned unit only if action was auto-assigned
		if (autoAssigned) {
			let next = findNextUnplannedUnit(phase, index);
			if (next) {
				setActiveUnit(next);
			}
		}
	}

	/**
	 * removeMove — clears a unit's dest/action, making it unassigned.
	 */
	function removeMove(phase, index) {
		if (phase === 'fleet') {
			setFleetPlans((prev) => {
				let plans = [...prev];
				if (plans[index]) {
					plans[index] = { ...plans[index], dest: '', action: '', actionOptions: [], peaceVote: false };
					fleetPlansRef.current = plans;
				}
				return plans;
			});
		} else {
			setArmyPlans((prev) => {
				let plans = [...prev];
				if (plans[index]) {
					plans[index] = { ...plans[index], dest: '', action: '', actionOptions: [], peaceVote: false };
					armyPlansRef.current = plans;
				}
				return plans;
			});
		}
		// Refresh downstream options
		setTimeout(async () => {
			let currentPlans = phase === 'fleet' ? fleetPlansRef.current : armyPlansRef.current;
			for (let i = index + 1; i < currentPlans.length; i++) {
				await computeOptionsForUnit(phase, i);
			}
			if (phase === 'fleet') {
				for (let i = 0; i < armyPlansRef.current.length; i++) {
					await computeOptionsForUnit('army', i);
				}
			}
			detectPeaceVotesOn(fleetPlansRef.current, armyPlansRef.current);
		}, 0);
	}

	/**
	 * reorderMove — swaps two rows within a phase.
	 */
	async function reorderMove(phase, fromIndex, toIndex) {
		let plans = phase === 'fleet' ? [...fleetPlansRef.current] : [...armyPlansRef.current];
		if (toIndex < 0 || toIndex >= plans.length) return;

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

		// Recompute options for affected units
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
	 * onActionChange — updates the action for a plan row (used by UI action pickers).
	 */
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

	/**
	 * onPerCountryActionChange — updates a per-country action in a compound action.
	 */
	function onPerCountryActionChange(phase, index, countryName, value) {
		let setter = phase === 'fleet' ? setFleetPlans : setArmyPlans;
		setter((prev) => {
			let plans = [...prev];
			let current = plans[index].action;
			let choices = [];
			try {
				let parsed = JSON.parse(current);
				if (Array.isArray(parsed)) choices = parsed;
			} catch (_e) {
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

	// ===== Action picker handlers =====

	/**
	 * onActionPickerSelect — called when user picks an action from the popup picker.
	 * Handles both flat actions and per-country grouped actions.
	 */
	function onActionPickerSelect(countryName, action) {
		let picker = actionPickerState;
		if (!picker) return;
		let { phase, index } = picker;

		if (countryName) {
			// Per-country action (grouped format)
			onPerCountryActionChange(phase, index, countryName, action);
		} else {
			// Simple flat action
			onActionChange(phase, index, action);
		}

		setActionPickerState(null);

		// Auto-advance to next unplanned unit
		let next = findNextUnplannedUnit(phase, index);
		if (next) {
			setActiveUnit(next);
		}
	}

	function dismissActionPicker() {
		setActionPickerState(null);
	}

	// ===== Peace detection =====

	/**
	 * findFirstPeaceStop — finds the first peace-vote-triggering move.
	 * Acts as getNextPeaceAction.
	 */
	function findFirstPeaceStop() {
		let ts = territorySetupRef.current;
		for (let i = 0; i < fleetPlansRef.current.length; i++) {
			let plan = fleetPlansRef.current[i];
			if (plan.peaceVote) {
				let targetCountry = (plan.dest && ts[plan.dest] && ts[plan.dest].country) || countryRef.current;
				return { phase: 'fleet', index: i, country: targetCountry };
			}
		}
		for (let i = 0; i < armyPlansRef.current.length; i++) {
			let plan = armyPlansRef.current[i];
			if (plan.peaceVote) {
				let targetCountry = (plan.dest && ts[plan.dest] && ts[plan.dest].country) || countryRef.current;
				return { phase: 'army', index: i, country: targetCountry };
			}
		}
		return null;
	}

	function getNextPeaceAction() {
		return findFirstPeaceStop();
	}

	// ===== Planning status =====

	function allPlanned() {
		let fPlans = fleetPlansRef.current;
		let aPlans = armyPlansRef.current;
		let peaceStop = findFirstPeaceStop();

		if (peaceStop) {
			if (peaceStop.phase === 'fleet') {
				for (let i = 0; i <= peaceStop.index; i++) {
					if (!fPlans[i].dest) return false;
				}
				return true;
			} else {
				for (let f of fPlans) {
					if (!f.dest) return false;
				}
				for (let i = 0; i <= peaceStop.index; i++) {
					if (!aPlans[i].dest) return false;
				}
				return true;
			}
		}

		for (let f of fPlans) {
			if (!f.dest) return false;
		}
		for (let a of aPlans) {
			if (!a.dest) return false;
		}
		return true;
	}

	function allFleetsMoved() {
		for (let f of fleetPlansRef.current) {
			if (!f.dest) return false;
		}
		return true;
	}

	function getBlockedReason(peaceStop) {
		let fPlans = fleetPlansRef.current;
		let aPlans = armyPlansRef.current;

		if (!peaceStop) {
			let unplannedFleets = fPlans.filter((p) => !p.dest).length;
			let unplannedArmies = aPlans.filter((p) => !p.dest).length;
			let parts = [];
			if (unplannedFleets > 0) parts.push(unplannedFleets + ' fleet move' + (unplannedFleets > 1 ? 's' : ''));
			if (unplannedArmies > 0) parts.push(unplannedArmies + ' army move' + (unplannedArmies > 1 ? 's' : ''));
			return parts.length > 0 ? 'Plan ' + parts.join(' and ') + ' first' : '';
		}

		if (peaceStop.phase === 'army') {
			let unplannedFleets = fPlans.filter((p) => !p.dest).length;
			let unplannedArmies = 0;
			for (let i = 0; i <= peaceStop.index; i++) {
				if (!aPlans[i].dest) unplannedArmies++;
			}
			let parts = [];
			if (unplannedFleets > 0) parts.push(unplannedFleets + ' fleet move' + (unplannedFleets > 1 ? 's' : ''));
			if (unplannedArmies > 0) parts.push(unplannedArmies + ' army move' + (unplannedArmies > 1 ? 's' : ''));
			return parts.length > 0 ? 'Plan ' + parts.join(' and ') + ' first' : '';
		}

		let unplannedFleets = 0;
		for (let i = 0; i <= peaceStop.index; i++) {
			if (!fPlans[i].dest) unplannedFleets++;
		}
		if (unplannedFleets > 0)
			return 'Plan ' + unplannedFleets + ' fleet move' + (unplannedFleets > 1 ? 's' : '') + ' first';
		return '';
	}

	// ===== Submit =====

	async function submitManeuver() {
		SoundManager.playPlace();
		setSubmitting(true);
		try {
			let fleetMan = fleetPlansRef.current.map((p) => [p.origin, p.dest, p.action || '']);
			let armyMan = armyPlansRef.current.map((p) => [p.origin, p.dest, p.action || '']);

			context.setFleetMan(fleetMan);
			context.setArmyMan(armyMan);

			await submitAPI.submitBatchManeuver({
				...context,
				fleetMan,
				armyMan,
			});

			clearDraftFromLocalStorage();
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

	// ===== requestPeace =====

	function requestPeace(phase, index) {
		// Lock everything at and above this index
		setLockLine({ phase, index });

		// Mark rows as locked
		if (phase === 'fleet') {
			setFleetPlans((prev) => {
				let plans = [...prev];
				for (let i = 0; i <= index; i++) {
					plans[i] = { ...plans[i], locked: true };
				}
				fleetPlansRef.current = plans;
				return plans;
			});
		} else {
			// Lock all fleets and army rows up to index
			setFleetPlans((prev) => {
				let plans = prev.map((p) => ({ ...p, locked: true }));
				fleetPlansRef.current = plans;
				return plans;
			});
			setArmyPlans((prev) => {
				let plans = [...prev];
				for (let i = 0; i <= index; i++) {
					plans[i] = { ...plans[i], locked: true };
				}
				armyPlansRef.current = plans;
				return plans;
			});
		}
	}

	// ===== Data loading =====

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

			let priorCompletedMoves = buildCompletedMovesList(cm);

			// Initialize fleet plans
			let initFleetPlans = (cm.pendingFleets || []).map((unit) => ({
				origin: unit.territory,
				dest: '',
				action: '',
				destOptions: [],
				actionOptions: [],
				peaceVote: false,
				locked: false,
			}));

			// Initialize army plans
			let initArmyPlans = (cm.pendingArmies || []).map((unit) => ({
				origin: unit.territory,
				dest: '',
				action: '',
				destOptions: [],
				actionOptions: [],
				peaceVote: false,
				locked: false,
			}));

			// Pre-populate from remainingFleetPlans/remainingArmyPlans if resuming
			let hasRemaining = false;
			if (cm.remainingFleetPlans && cm.remainingFleetPlans.length > 0) {
				for (let i = 0; i < cm.remainingFleetPlans.length && i < initFleetPlans.length; i++) {
					let tuple = cm.remainingFleetPlans[i];
					initFleetPlans[i].dest = tuple[1] || '';
					initFleetPlans[i].action = tuple[2] || '';
				}
				hasRemaining = true;
			}
			if (cm.remainingArmyPlans && cm.remainingArmyPlans.length > 0) {
				for (let i = 0; i < cm.remainingArmyPlans.length && i < initArmyPlans.length; i++) {
					let tuple = cm.remainingArmyPlans[i];
					initArmyPlans[i].dest = tuple[1] || '';
					initArmyPlans[i].action = tuple[2] || '';
				}
				hasRemaining = true;
			}

			// If not resuming from remaining plans, try restoring from localStorage
			if (!hasRemaining) {
				let draft = loadDraftFromLocalStorage(initFleetPlans, initArmyPlans);
				if (draft) {
					for (let i = 0; i < draft.fleetPlans.length; i++) {
						initFleetPlans[i].dest = draft.fleetPlans[i].dest || '';
						initFleetPlans[i].action = draft.fleetPlans[i].action || '';
					}
					for (let i = 0; i < draft.armyPlans.length; i++) {
						initArmyPlans[i].dest = draft.armyPlans[i].dest || '';
						initArmyPlans[i].action = draft.armyPlans[i].action || '';
					}
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
			setLockLine(null);

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
					let opts = await proposalAPI.getUnitActionOptionsFromPlans(
						contextRef.current,
						plan,
						'fleet',
						i,
						initFleetPlans[i].dest
					);
					initFleetPlans[i] = { ...initFleetPlans[i], actionOptions: opts || [] };
					if (Array.isArray(opts) && opts.length === 1) {
						initFleetPlans[i].action = opts[0];
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
					let opts = await proposalAPI.getUnitActionOptionsFromPlans(
						contextRef.current,
						plan,
						'army',
						i,
						initArmyPlans[i].dest
					);
					initArmyPlans[i] = { ...initArmyPlans[i], actionOptions: opts || [] };
					if (Array.isArray(opts) && opts.length === 1) {
						initArmyPlans[i].action = opts[0];
					}
				}
			}

			// Update state with fully computed plans
			setFleetPlans([...initFleetPlans]);
			setArmyPlans([...initArmyPlans]);
			fleetPlansRef.current = initFleetPlans;
			armyPlansRef.current = initArmyPlans;

			// Auto-activate the first unit
			if (initFleetPlans.length > 0) {
				setActiveUnit({ phase: 'fleet', index: 0 });
			} else if (initArmyPlans.length > 0) {
				setActiveUnit({ phase: 'army', index: 0 });
			}
		} catch (e) {
			console.error('ManeuverPlanProvider failed to load:', e);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Load on mount
	useEffect(() => {
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ===== Map interaction effects =====

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
				highlights[plan.origin] = goldColor;
				if (plan.destOptions) {
					selectables = [...plan.destOptions];
				}
			}
		}

		mapInteraction.setInteraction(
			'select-territory',
			selectables,
			countryColor,
			(name, event) => {
				let au = activeUnitRef.current;
				if (au) {
					let clickPos = event ? { x: event.clientX, y: event.clientY } : null;
					assignMove(au.phase, au.index, name, clickPos);
				}
			},
			highlights
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeUnit, loaded, pendingPeace, country, fleetPlans, armyPlans]);

	// Right-click handler: open action picker for an already-assigned territory
	useEffect(() => {
		if (!loaded || !mapInteraction.setOnItemRightClickedCb) return;
		mapInteraction.setOnItemRightClickedCb(() => (name, event) => {
			// Find which plan row has this territory as destination
			for (let i = 0; i < fleetPlansRef.current.length; i++) {
				let plan = fleetPlansRef.current[i];
				if (
					plan.dest === name &&
					plan.actionOptions &&
					(Array.isArray(plan.actionOptions) ? plan.actionOptions.length > 1 : plan.actionOptions)
				) {
					let clickPos = event ? { x: event.clientX, y: event.clientY } : { x: 0, y: 0 };
					setActiveUnit({ phase: 'fleet', index: i });
					setActionPickerState({
						phase: 'fleet',
						index: i,
						position: clickPos,
						actions: plan.actionOptions,
					});
					return;
				}
			}
			for (let i = 0; i < armyPlansRef.current.length; i++) {
				let plan = armyPlansRef.current[i];
				if (
					plan.dest === name &&
					plan.actionOptions &&
					(Array.isArray(plan.actionOptions) ? plan.actionOptions.length > 1 : plan.actionOptions)
				) {
					let clickPos = event ? { x: event.clientX, y: event.clientY } : { x: 0, y: 0 };
					setActiveUnit({ phase: 'army', index: i });
					setActionPickerState({
						phase: 'army',
						index: i,
						position: clickPos,
						actions: plan.actionOptions,
					});
					return;
				}
			}
		});

		return () => {
			if (mapInteractionRef.current.setOnItemRightClickedCb) {
				mapInteractionRef.current.setOnItemRightClickedCb(null);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loaded]);

	// Cleanup map interaction on unmount
	useEffect(() => {
		return () => {
			mapInteractionRef.current.clearInteraction();
		};
	}, []);

	// Push planned moves for arrows (with action and locked fields)
	useEffect(() => {
		if (!loaded || !mapInteraction.setPlannedMoves) return;
		let palette = getCountryColorPalette(context.colorblindMode);
		let countryColor = ensureMapVisible(palette.bright[country] || '#c9a84c');
		let moves = [];
		fleetPlans.forEach((p) => {
			if (p.dest && p.dest !== p.origin) {
				moves.push({
					origin: p.origin,
					dest: p.dest,
					color: countryColor,
					action: p.action || null,
					locked: !!p.locked,
				});
			}
		});
		armyPlans.forEach((p) => {
			if (p.dest && p.dest !== p.origin) {
				// For army moves, find fleet-controlled sea waypoints between origin and dest
				let waypoints = [];
				let ts = territorySetupRef.current;
				if (ts && ts[p.origin] && ts[p.dest]) {
					let originAdj = ts[p.origin].adjacencies || [];
					let destAdj = ts[p.dest].adjacencies || [];
					// Find fleet sea territories adjacent to either origin or dest
					for (let fp of fleetPlans) {
						if (!fp.dest || !ts[fp.dest] || !ts[fp.dest].sea) continue;
						let action = fp.action || '';
						let split = action.split(' ');
						if (split[0] !== '' && split[0] !== 'peace') continue;
						// Check if this fleet's sea is adjacent to origin's landmass or dest's landmass
						let nearOrigin = originAdj.includes(fp.dest);
						let nearDest = destAdj.includes(fp.dest);
						if (nearOrigin || nearDest) {
							waypoints.push(fp.dest);
						}
					}
				}
				moves.push({
					origin: p.origin,
					dest: p.dest,
					color: countryColor,
					action: p.action || null,
					locked: !!p.locked,
					waypoints: waypoints.length > 0 ? waypoints : undefined,
				});
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

		if (mapInteraction.setOnUnitMarkerClickedCb) {
			mapInteraction.setOnUnitMarkerClickedCb(() => (phase, index) => {
				SoundManager.playSelect();
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

	// ===== Computed / derived state =====

	let unassignedFleets = fleetPlans.filter((p) => !p.dest);
	let unassignedArmies = armyPlans.filter((p) => !p.dest);

	let peaceStop = findFirstPeaceStop();
	let canSubmitValue = allPlanned();
	let nextPeace = peaceStop;

	// ===== Context value (memoized) =====

	const contextValue = useMemo(
		() => ({
			// State
			loaded,
			country,
			fleetPlans,
			armyPlans,
			unassignedFleets,
			unassignedArmies,
			activeUnit,
			lockLine,
			pendingPeace,
			priorCompleted,
			submitting,
			currentManeuver,
			territorySetup,

			// Actions
			setActiveUnit,
			assignMove,
			removeMove,
			reorderMove,
			requestPeace,
			submitManeuver,
			submitDictatorVote,
			getNextPeaceAction,
			onActionChange,
			onPerCountryActionChange,
			onActionPickerSelect,
			dismissActionPicker,

			// Action picker
			actionPickerState,

			// Computed / Helpers
			canSubmit: canSubmitValue,
			nextPeace,
			allPlanned,
			allFleetsMoved,
			getBlockedReason,
			findFirstPeaceStop,
			buildCompletedMovesList,
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			loaded,
			country,
			fleetPlans,
			armyPlans,
			activeUnit,
			lockLine,
			pendingPeace,
			priorCompleted,
			submitting,
			currentManeuver,
			territorySetup,
			canSubmitValue,
			actionPickerState,
		]
	);

	return <ManeuverPlanContext.Provider value={contextValue}>{children}</ManeuverPlanContext.Provider>;
}

export default ManeuverPlanProvider;
