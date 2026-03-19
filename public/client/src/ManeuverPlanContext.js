import React from 'react';

/**
 * ManeuverPlanContext
 *
 * Shared React Context for the maneuver redesign, enabling multiple components to coordinate
 * on a multi-row plan system where players assign fleet and army orders row-by-row.
 *
 * **Consumers:**
 * - FloatingTurnPanel: displays plan list, locked state, and row highlights
 * - MapApp: renders action picker popup and submit FAB (floating action button)
 * - ManeuverPlanProvider (wrapper): fetches initial plans and provides actions
 * - ArrowLayer: renders movement arrows for active/planned moves
 * - TransportLayer: renders fleet transport icons for planned moves
 *
 * **Plan structure:**
 * Each row (fleet or army) can be in three states:
 * 1. Unassigned: origin only, waiting for player to select destination + action
 * 2. Draft: origin, destination, and action selected, but not submitted
 * 3. Locked: submitted and cannot be modified (only visible for historical reference)
 *
 * **Peace flow:**
 * When peace is requested mid-turn, the next unsubmitted row locks and triggers a vote.
 * Once resolved, the next unsubmitted row becomes active. lockLine tracks the boundary.
 */
const ManeuverPlanContext = React.createContext({
	// ===== State =====

	/**
	 * @type {boolean}
	 * True when initial plans have been fetched from Firebase.
	 */
	loaded: false,

	/**
	 * @type {string}
	 * The current country (color) performing maneuvers (e.g. 'Austria').
	 */
	country: '',

	/**
	 * @type {Array<{origin, dest, action, destOptions, actionOptions, peaceVote, locked}>}
	 * Fleet movement plans. Each object represents one row in the fleet section.
	 * - origin: string (territory)
	 * - dest: string (territory) or null if unassigned
	 * - action: Array<{country, action}> or null — compound action (e.g. fleet transport)
	 * - destOptions: string[] — valid destinations for this fleet
	 * - actionOptions: string[] — valid actions at the current destination
	 * - peaceVote: { dictator, resolution } or null — pending peace vote result if locked
	 * - locked: boolean — true if submitted or awaiting peace vote resolution
	 */
	fleetPlans: [],

	/**
	 * @type {Array<{origin, dest, action, destOptions, actionOptions, peaceVote, locked, convoyFleets}>}
	 * Army movement plans. Same shape as fleetPlans plus:
	 * - convoyFleets: string[] — sea territories where fleets provide convoy for this army (empty = land-only)
	 */
	armyPlans: [],

	/**
	 * @type {Array<{origin}>}
	 * Fleets with no order assigned yet.
	 */
	unassignedFleets: [],

	/**
	 * @type {Array<{origin}>}
	 * Armies with no order assigned yet.
	 */
	unassignedArmies: [],

	/**
	 * @type {{phase: 'fleet'|'army', index: number} | null}
	 * Currently selected unit (which row is being edited). Used to highlight rows and show the action picker.
	 */
	activeUnit: null,

	/**
	 * @type {{phase: 'fleet'|'army', index: number} | null}
	 * Boundary of locked rows. Everything at or above this index is locked.
	 * Set when peace is requested and updated after peace vote is resolved.
	 */
	lockLine: null,

	/**
	 * @type {{dictator: string, question: string, choices: {yes, no, abstain}} | null}
	 * Pending dictator peace vote (fired when a peace is requested).
	 */
	pendingPeace: null,

	/**
	 * @type {string[]}
	 * Completed move strings from prior peace rounds in this turn.
	 * Used to display history of submitted moves.
	 */
	priorCompleted: [],

	/**
	 * @type {boolean}
	 * True while submitting the maneuver to Firebase.
	 */
	submitting: false,

	// ===== Actions =====

	/**
	 * Set which unit (row) is currently being edited.
	 * @param {null | {phase: 'fleet'|'army', index: number}} unit
	 */
	setActiveUnit: () => {},

	/**
	 * Assign a move to a row (transition from unassigned to draft).
	 * @param {string} phase — 'fleet' or 'army'
	 * @param {number} index — row index
	 * @param {string} dest — destination territory
	 * @param {Array<{country, action}>} action — compound action
	 */
	assignMove: () => {},

	/**
	 * Remove a move (revert a draft row back to unassigned).
	 * @param {string} phase — 'fleet' or 'army'
	 * @param {number} index — row index
	 */
	removeMove: () => {},

	/**
	 * Reorder rows within a phase (drag-and-drop support).
	 * @param {string} phase — 'fleet' or 'army'
	 * @param {number} fromIndex — current row index
	 * @param {number} toIndex — new row index
	 */
	reorderMove: () => {},

	/**
	 * Request a peace vote on behalf of the dictator at the given row.
	 * Locks everything at and below this row, fires pendingPeace state.
	 * @param {string} phase — 'fleet' or 'army'
	 * @param {number} index — row index where peace is requested
	 */
	requestPeace: () => {},

	/**
	 * Submit all remaining draft rows to Firebase.
	 * Clears draft state and locks all submitted rows.
	 */
	submitManeuver: () => {},

	/**
	 * Submit the dictator's peace vote resolution (yes/no/abstain).
	 * Resolves pendingPeace and unlocks the next row for assignment.
	 * @param {string} choice — 'yes', 'no', or 'abstain'
	 */
	submitDictatorVote: () => {},

	/**
	 * Fetch the next peace action after a vote is resolved.
	 * Transitions from pendingPeace to the next unsubmitted row.
	 * @returns {null | {phase, index, country}}
	 */
	getNextPeaceAction: () => null,

	/**
	 * Manually override which fleet provides convoy for an army.
	 * @param {number} index — army row index
	 * @param {string} fleetSea — sea territory name of the fleet to use
	 */
	setConvoyFleet: () => {},

	// ===== Computed / Helpers =====

	/**
	 * @type {Array<{armyIndex: number, fleetSeas: string[]}>}
	 * Computed convoy assignments — which fleet(s) each army uses for sea transport.
	 * Empty fleetSeas = land-only move. Derived from current fleet/army plans.
	 */
	convoyAssignments: [],

	/**
	 * @type {boolean}
	 * True if there are unsubmitted draft rows to submit (i.e. user has made at least one move).
	 */
	canSubmit: false,

	/**
	 * @type {null | {phase, index, country}}
	 * The next row to be assigned after peace vote resolution (or null if all are assigned).
	 */
	nextPeace: null,
});

export default ManeuverPlanContext;
