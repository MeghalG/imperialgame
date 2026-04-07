import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import UserContext from './UserContext.js';
import MapInteractionContext from './MapInteractionContext.js';
import ManeuverPlanContext from './ManeuverPlanContext.js';
import * as proposalAPI from './backendFiles/proposalAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { readGameState, readSetup, clearCache } from './backendFiles/stateCache.js';
import useGameState from './useGameState.js';
import { MODES } from './gameConstants.js';
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
	const { gameState: centralGameState } = useGameState();

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
	const [readOnly, setReadOnly] = useState(false);

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

	/**
	 * Recompute convoyFleets for all army plans based on current fleet/army state.
	 * Called after any plan change that could affect convoy assignments.
	 */
	// Convoy assignment computation is now handled by a useEffect below
	// (reacts to fleetPlans/armyPlans state changes to avoid race conditions)

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
			let setter = phase === 'fleet' ? setFleetPlans : setArmyPlans;
			let ref = phase === 'fleet' ? fleetPlansRef : armyPlansRef;
			setter((prev) => {
				let plans = [...prev];
				if (plans[index]) {
					plans[index] = { ...plans[index], destOptions: destOptions || [] };
				}
				ref.current = plans;
				return plans;
			});
		} catch (e) {
			console.error('Failed to compute options for', phase, index, e);
		}
	}

	async function computeActionOptionsForUnit(phase, index, dest, clickPosition) {
		let plan = buildPlan();
		let setter = phase === 'fleet' ? setFleetPlans : setArmyPlans;
		let ref = phase === 'fleet' ? fleetPlansRef : armyPlansRef;

		try {
			let actionOptions = await proposalAPI.getUnitActionOptionsFromPlans(contextRef.current, plan, phase, index, dest);

			// Determine default action and whether to show picker
			let defaultAction = '';
			let showPicker = false;

			if (Array.isArray(actionOptions)) {
				if (actionOptions.length === 0) {
					// No actions needed (e.g. moving to own empty territory)
					defaultAction = '';
				} else if (actionOptions.length === 1) {
					// Only one option — auto-assign it
					defaultAction = actionOptions[0];
				} else {
					// Multiple options — default to first war option, show picker to allow change
					let firstWar = actionOptions.find((a) => a.startsWith('war '));
					defaultAction = firstWar || actionOptions[0];
					showPicker = true;
				}
			} else if (actionOptions && !Array.isArray(actionOptions)) {
				// Grouped format (multi-country) — default to first war, show picker
				let countries = actionOptions.countries || [];
				if (countries.length > 0 && countries[0].actions && countries[0].actions.length > 0) {
					let firstWar = countries[0].actions.find((a) => a.startsWith('war '));
					defaultAction = firstWar || countries[0].actions[0];
				}
				showPicker = true;
			}

			setter((prev) => {
				let plans = [...prev];
				if (plans[index]) {
					plans[index] = { ...plans[index], actionOptions: actionOptions || [], action: defaultAction };
				}
				ref.current = plans;
				return plans;
			});

			// Show picker so player can change from the default
			if (showPicker && clickPosition) {
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

			return !showPicker;
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

	// ===== Shared cascade recomputation =====
	//
	// Called after any plan change (assign, remove, reorder, action change).
	// Recomputes dest options, action options, and peace flags for all
	// affected units. Handles cascade-clearing of invalid moves.
	//
	//  TRIGGER: Row R in phase P changed
	//    1. Recompute dest options for all units after R in phase P
	//    2. If P is 'fleet': recompute ALL army dest options (convoy may change)
	//    3. Cascade-clear: any unit whose dest is no longer reachable
	//    4. Recompute action options for all units with a dest
	//       - If current action is invalid: reset to sensible default
	//    5. Recompute peace vote flags
	//
	async function recomputeAllOptions(changedPhase, startIndex) {
		// Step 1: Recompute dest options for units in the changed phase
		let currentPlans = changedPhase === 'fleet' ? fleetPlansRef.current : armyPlansRef.current;
		for (let i = startIndex; i < currentPlans.length; i++) {
			await computeOptionsForUnit(changedPhase, i);
		}

		// Step 2: If fleet changed, recompute ALL army dest options
		if (changedPhase === 'fleet') {
			for (let i = 0; i < armyPlansRef.current.length; i++) {
				await computeOptionsForUnit('army', i);
			}
		}

		// Step 3: Cascade-clear invalid destinations (both phases)
		for (let ph of ['fleet', 'army']) {
			let setter = ph === 'fleet' ? setFleetPlans : setArmyPlans;
			let ref = ph === 'fleet' ? fleetPlansRef : armyPlansRef;
			setter((prev) => {
				let changed = false;
				let plans = [...prev];
				for (let i = 0; i < plans.length; i++) {
					if (plans[i].dest && plans[i].destOptions && plans[i].destOptions.length > 0) {
						if (!plans[i].destOptions.includes(plans[i].dest)) {
							let cleared = { ...plans[i], dest: '', action: '', actionOptions: [], peaceVote: false };
							if (ph === 'army') cleared.convoyFleets = [];
							plans[i] = cleared;
							changed = true;
						}
					}
				}
				if (changed) ref.current = plans;
				return changed ? plans : prev;
			});
		}

		// Step 4: Recompute action options for all units that still have a dest.
		// If current action is no longer valid, reset to a sensible default.
		for (let ph of ['fleet', 'army']) {
			let plans = ph === 'fleet' ? fleetPlansRef.current : armyPlansRef.current;
			for (let i = 0; i < plans.length; i++) {
				if (plans[i].dest) {
					let newActionOptions = await proposalAPI.getUnitActionOptionsFromPlans(
						contextRef.current,
						buildPlan(),
						ph,
						i,
						plans[i].dest
					);

					// Flatten action options for validation — handles both array and
					// multi-country object formats from getUnitActionOptionsFromPlans
					let flatOptions;
					if (Array.isArray(newActionOptions)) {
						flatOptions = newActionOptions;
					} else if (newActionOptions && newActionOptions.countries) {
						flatOptions = newActionOptions.countries.flatMap((c) => c.actions || []);
						if (newActionOptions.otherActions) {
							flatOptions.push(...newActionOptions.otherActions);
						}
					} else {
						flatOptions = [];
					}

					let currentAction = plans[i].action || '';

					// Check if current action is still valid.
					// Empty flatOptions means no action is needed (plain move) —
					// so any existing action (war/peace/hostile) is INVALID.
					let isValid;
					if (flatOptions.length === 0) {
						// No enemies, no foreign territory — plain move. Clear any stale action.
						isValid = currentAction === '';
					} else {
						isValid = flatOptions.includes(currentAction);
					}

					if (!isValid) {
						// Reset to sensible default: first war if available, otherwise first option,
						// or '' if no options (plain move)
						let defaultAction = flatOptions.find((a) => a.startsWith('war ')) || flatOptions[0] || '';
						let setter = ph === 'fleet' ? setFleetPlans : setArmyPlans;
						let ref = ph === 'fleet' ? fleetPlansRef : armyPlansRef;
						setter((prev) => {
							let updated = [...prev];
							updated[i] = { ...updated[i], action: defaultAction, actionOptions: newActionOptions };
							ref.current = updated;
							return updated;
						});
					} else {
						// Action is still valid — just update the options list
						let setter = ph === 'fleet' ? setFleetPlans : setArmyPlans;
						let ref = ph === 'fleet' ? fleetPlansRef : armyPlansRef;
						setter((prev) => {
							let updated = [...prev];
							if (updated[i].actionOptions !== newActionOptions) {
								updated[i] = { ...updated[i], actionOptions: newActionOptions };
								ref.current = updated;
								return updated;
							}
							return prev;
						});
					}
				}
			}
		}

		// Step 5: Recompute peace flags (convoy assignments handled by useEffect)
		detectPeaceVotesOn(fleetPlansRef.current, armyPlansRef.current);
	}

	/**
	 * assignMove — handles destination selection and auto-computes action options.
	 */
	async function assignMove(phase, index, dest, clickPosition) {
		SoundManager.playDestination();
		setActionPickerState(null);

		let setter = phase === 'fleet' ? setFleetPlans : setArmyPlans;
		let ref = phase === 'fleet' ? fleetPlansRef : armyPlansRef;
		setter((prev) => {
			let plans = [...prev];
			plans[index] = { ...plans[index], dest: dest, action: '', actionOptions: [], peaceVote: false };
			ref.current = plans;
			return plans;
		});

		// Compute action options for the assigned unit (may show picker)
		await computeActionOptionsForUnit(phase, index, dest, clickPosition);

		// Cascade: recompute everything downstream
		await recomputeAllOptions(phase, index + 1);
	}

	/**
	 * removeMove — clears a unit's dest/action, making it unassigned.
	 */
	function removeMove(phase, index) {
		let setter = phase === 'fleet' ? setFleetPlans : setArmyPlans;
		let ref = phase === 'fleet' ? fleetPlansRef : armyPlansRef;
		setter((prev) => {
			let plans = [...prev];
			if (plans[index]) {
				let cleared = { ...plans[index], dest: '', action: '', actionOptions: [], peaceVote: false };
				if (phase === 'army') cleared.convoyFleets = [];
				plans[index] = cleared;
				ref.current = plans;
			}
			return plans;
		});
		// Cascade: recompute everything (setTimeout to let state update settle)
		setTimeout(async () => {
			await recomputeAllOptions(phase, index);
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

		// Cascade: recompute from the earliest affected index
		await recomputeAllOptions(phase, Math.min(fromIndex, toIndex));
	}

	/**
	 * onActionChange — updates the action for a plan row (used by UI action pickers).
	 */
	function onActionChange(phase, index, value) {
		let setter = phase === 'fleet' ? setFleetPlans : setArmyPlans;
		let ref = phase === 'fleet' ? fleetPlansRef : armyPlansRef;
		setter((prev) => {
			let plans = [...prev];
			plans[index] = { ...plans[index], action: value };
			ref.current = plans;
			return plans;
		});
		// Changing an action (e.g. war → peace) affects downstream units'
		// virtual state, so cascade recompute from the next unit.
		setTimeout(async () => {
			await recomputeAllOptions(phase, index + 1);
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
		// Dismiss keeps the default action (war) and advances to next unit
		let picker = actionPickerState;
		setActionPickerState(null);
		if (picker) {
			let next = findNextUnplannedUnit(picker.phase, picker.index);
			if (next) {
				setActiveUnit(next);
			}
		}
	}

	/**
	 * setConvoyFleet — manually override which fleet provides convoy for an army.
	 * @param {number} index — army row index
	 * @param {string} fleetSea — sea territory name of the fleet to use
	 */
	function setConvoyFleet(index, fleetSea) {
		setArmyPlans((prev) => {
			let plans = [...prev];
			if (plans[index]) {
				plans[index] = { ...plans[index], convoyFleets: [fleetSea] };
			}
			armyPlansRef.current = plans;
			return plans;
		});
		// Cascade: other armies may need reassignment
		setTimeout(async () => {
			await recomputeAllOptions('army', 0);
		}, 0);
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
			// Only send tuples for units that have a destination assigned
			let fleetMan = fleetPlansRef.current.map((p) => [p.origin, p.dest || p.origin, p.action || '']);
			let armyMan = armyPlansRef.current.map((p) => [p.origin, p.dest || p.origin, p.action || '']);

			context.setFleetMan(fleetMan);
			context.setArmyMan(armyMan);

			await submitAPI.submitBatchManeuver({
				...context,
				fleetMan,
				armyMan,
			});

			clearDraftFromLocalStorage();
		} catch (e) {
			console.error('ManeuverPlanProvider submitManeuver failed:', e);
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

	async function requestPeace(phase, index) {
		SoundManager.playPlace();
		setSubmitting(true);
		try {
			// Build tuples from current plans — same as submitManeuver
			let fleetMan = fleetPlansRef.current.map((p) => [p.origin, p.dest || p.origin, p.action || '']);
			let armyMan = armyPlansRef.current.map((p) => [p.origin, p.dest || p.origin, p.action || '']);

			context.setFleetMan(fleetMan);
			context.setArmyMan(armyMan);

			await submitAPI.submitBatchManeuver({
				...context,
				fleetMan,
				armyMan,
			});

			// Don't clear draft — peace vote may need remaining plans after
		} catch (e) {
			console.error('ManeuverPlanProvider requestPeace failed:', e);
		} finally {
			setSubmitting(false);
		}
	}

	// ===== Data loading =====

	const loadData = useCallback(async (retryCount = 0) => {
		try {
			let gameState = await readGameState(contextRef.current);
			if (!gameState) {
				console.warn('[ManeuverPlanProvider] loadData: no game state');
				return;
			}
			let cm = gameState.currentManeuver;
			if (!cm) {
				// Cache may be stale — invalidate and retry up to 3 times
				if (retryCount < 3) {
					clearCache();
					await new Promise((r) => setTimeout(r, 300));
					return loadData(retryCount + 1);
				}
				console.warn('[ManeuverPlanProvider] loadData: no currentManeuver after retries');
				return;
			}

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

			let isController = cm.player === contextRef.current.name;

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
				convoyFleets: [],
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
			if (!hasRemaining && isController) {
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
			setReadOnly(!isController);
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

			// Non-controllers get read-only view — skip dest options, action options, auto-activate
			if (!isController) return;

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
					if (Array.isArray(opts)) {
						if (opts.length === 1) {
							initFleetPlans[i].action = opts[0];
						} else if (opts.length > 1 && !initFleetPlans[i].action) {
							// Default to first war option when resuming
							let firstWar = opts.find((a) => a.startsWith('war '));
							initFleetPlans[i].action = firstWar || opts[0];
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
					let opts = await proposalAPI.getUnitActionOptionsFromPlans(
						contextRef.current,
						plan,
						'army',
						i,
						initArmyPlans[i].dest
					);
					initArmyPlans[i] = { ...initArmyPlans[i], actionOptions: opts || [] };
					if (Array.isArray(opts)) {
						if (opts.length === 1) {
							initArmyPlans[i].action = opts[0];
						} else if (opts.length > 1 && !initArmyPlans[i].action) {
							let firstWar = opts.find((a) => a.startsWith('war '));
							initArmyPlans[i].action = firstWar || opts[0];
						}
					}
				}
			}

			// Compute convoy assignments for armies with destinations
			let fleetTuples = initFleetPlans.map((p) => [p.origin, p.dest || '', p.action || '']);
			let armyTuples = initArmyPlans.map((p) => [p.origin, p.dest || '', p.action || '']);
			let { assignments: convoyAssignments } = proposalAPI.computeConvoyAssignments(
				fleetTuples,
				armyTuples,
				tSetup,
				cm.country
			);
			for (let a of convoyAssignments) {
				initArmyPlans[a.armyIndex] = { ...initArmyPlans[a.armyIndex], convoyFleets: a.fleetSeas };
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

	// React to centralized game state changes — reload if still in maneuver, reset if not
	const isFirstCentralRef = useRef(true);
	useEffect(() => {
		if (!centralGameState) return;
		if (isFirstCentralRef.current) {
			isFirstCentralRef.current = false;
			return; // skip initial (loadData already handles mount)
		}
		if (centralGameState.mode === MODES.CONTINUE_MAN && centralGameState.currentManeuver) {
			// Still in maneuver — reload (e.g. after peace vote resolves)
			loadData();
		} else {
			// No longer in maneuver — reset all state so map clears
			setLoaded(false);
			setFleetPlans([]);
			setArmyPlans([]);
			setActiveUnit(null);
			setActionPickerState(null);
			setPendingPeace(null);
			mapInteractionRef.current.clearInteraction();
			if (mapInteractionRef.current.setPlannedMoves) {
				mapInteractionRef.current.setPlannedMoves([]);
			}
			if (mapInteractionRef.current.setUnitMarkers) {
				mapInteractionRef.current.setUnitMarkers([]);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [centralGameState]);

	// ===== Map interaction effects =====

	// Push active unit's destination options to the map hotspot layer
	useEffect(() => {
		if (!loaded || pendingPeace || readOnly) {
			// Not active or read-only — clear any previous interaction
			mapInteractionRef.current.clearInteraction();
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

		return () => {
			mapInteractionRef.current.clearInteraction();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeUnit, loaded, pendingPeace, readOnly, country, fleetPlans, armyPlans]);

	// Right-click handler: open action picker for an already-assigned territory
	useEffect(() => {
		if (!loaded || readOnly || !mapInteraction.setOnItemRightClickedCb) return;
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
		armyPlans.forEach((p, i) => {
			if (p.dest && p.dest !== p.origin) {
				// Use computed convoy assignments for waypoints
				let assignment = convoyAssignments.find((a) => a.armyIndex === i);
				let waypoints = assignment ? assignment.fleetSeas.slice() : [];
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

	// Compute convoy assignments as derived data (not stored in state to avoid update loops)
	const convoyAssignments = useMemo(() => {
		if (!loaded || !territorySetup || !country) return [];
		let fleetTuples = fleetPlans.map((p) => [p.origin, p.dest || '', p.action || '']);
		let armyTuples = armyPlans.map((p) => [p.origin, p.dest || '', p.action || '']);
		let { assignments } = proposalAPI.computeConvoyAssignments(fleetTuples, armyTuples, territorySetup, country);
		return assignments;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loaded, fleetPlans, armyPlans, country, territorySetup]);

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
				countryName: country,
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
				countryName: country,
			});
		});

		mapInteraction.setUnitMarkers(markers);

		if (mapInteraction.setOnUnitMarkerClickedCb && !readOnly) {
			mapInteraction.setOnUnitMarkerClickedCb(() => (phase, index) => {
				SoundManager.playSelect();
				setActiveUnit({ phase, index });
				// Recompute dest options for the activated unit (convoy limits may have changed)
				computeOptionsForUnit(phase, index);
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
			readOnly,
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
			setConvoyFleet,

			// Action picker
			actionPickerState,

			// Computed / Helpers
			convoyAssignments,
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
			readOnly,
			currentManeuver,
			territorySetup,
			canSubmitValue,
			actionPickerState,
			convoyAssignments,
		]
	);

	return <ManeuverPlanContext.Provider value={contextValue}>{children}</ManeuverPlanContext.Provider>;
}

export default ManeuverPlanProvider;
