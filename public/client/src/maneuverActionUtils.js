/**
 * Shared utilities for maneuver action strings and compound action arrays.
 *
 * Action codes used in ManeuverTuple[2]:
 *   ''                     — normal move (empty string)
 *   'peace'                — peaceful entry
 *   'hostile'              — hostile entry
 *   'war {country} {unit}' — declare war (e.g. 'war France fleet')
 *   'blow up {country}'    — destroy factory (e.g. 'blow up Italy')
 *
 * Compound format: [{country, action}]
 *   Used internally to represent multi-destination moves.
 *
 * @module maneuverActionUtils
 */

import { MANEUVER_ACTIONS } from './gameConstants';

// ---------------------------------------------------------------------------
// normalizeAction
// ---------------------------------------------------------------------------

/**
 * Converts a raw action string to the compound array format.
 *
 * @param {string|null} action - Raw action code or JSON-encoded compound array.
 * @returns {{country: string|null, action: string}[]}
 */
export function normalizeAction(action) {
	if (action === null || action === undefined || action === '') {
		return [];
	}

	// Already a JSON compound array?
	if (action.startsWith('[')) {
		try {
			return JSON.parse(action);
		} catch (_e) {
			// fall through to treat as a plain action string
		}
	}

	if (action === MANEUVER_ACTIONS.PEACE) {
		return [{ country: null, action: 'peace' }];
	}

	if (action === MANEUVER_ACTIONS.HOSTILE) {
		return [{ country: null, action: 'hostile' }];
	}

	if (action.startsWith(MANEUVER_ACTIONS.WAR_PREFIX + ' ')) {
		// 'war France fleet' — country is the second token
		const parts = action.split(' ');
		const country = parts[1] || null;
		return [{ country, action }];
	}

	if (action.startsWith(MANEUVER_ACTIONS.BLOW_UP_PREFIX + ' ')) {
		// 'blow up Italy' — country is everything after the prefix
		const country = action.slice(MANEUVER_ACTIONS.BLOW_UP_PREFIX.length + 1) || null;
		return [{ country, action }];
	}

	// Unknown / unrecognised action string — wrap generically
	return [{ country: null, action }];
}

// ---------------------------------------------------------------------------
// denormalizeAction
// ---------------------------------------------------------------------------

/**
 * Converts a compound action array back to the engine's string format.
 *
 * @param {{country: string|null, action: string}[]} compound
 * @returns {string}
 */
export function denormalizeAction(compound) {
	if (!compound || compound.length === 0) {
		return '';
	}

	if (compound.length === 1) {
		return compound[0].action;
	}

	return JSON.stringify(compound);
}

// ---------------------------------------------------------------------------
// formatActionLabel
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable label for a raw action code string.
 *
 * @param {string} action - Raw action code.
 * @returns {string}
 */
export function formatActionLabel(action) {
	if (!action) return '';

	if (action === MANEUVER_ACTIONS.PEACE) {
		return 'Enter peacefully';
	}

	if (action === MANEUVER_ACTIONS.HOSTILE) {
		return 'Enter as hostile occupier';
	}

	if (action.startsWith(MANEUVER_ACTIONS.WAR_PREFIX + ' ')) {
		// 'war France fleet' → 'Declare war on France fleet'
		const rest = action.slice(MANEUVER_ACTIONS.WAR_PREFIX.length + 1);
		return `Declare war on ${rest}`;
	}

	if (action.startsWith(MANEUVER_ACTIONS.BLOW_UP_PREFIX + ' ')) {
		// 'blow up Italy' → 'Destroy Italy factory'
		const country = action.slice(MANEUVER_ACTIONS.BLOW_UP_PREFIX.length + 1);
		return `Destroy ${country} factory`;
	}

	return action;
}

// ---------------------------------------------------------------------------
// formatCompletedAction
// ---------------------------------------------------------------------------

/**
 * Returns a short label for a completed move action (for history / summaries).
 *
 * @param {string} action - Raw action code.
 * @returns {string}
 */
export function formatCompletedAction(action) {
	if (!action) return '';

	if (action === MANEUVER_ACTIONS.PEACE) {
		return 'peace';
	}

	if (action === MANEUVER_ACTIONS.HOSTILE) {
		return 'hostile';
	}

	if (action.startsWith(MANEUVER_ACTIONS.WAR_PREFIX + ' ')) {
		// 'war France fleet' → 'war on France fleet'
		const rest = action.slice(MANEUVER_ACTIONS.WAR_PREFIX.length + 1);
		return `war on ${rest}`;
	}

	if (action.startsWith(MANEUVER_ACTIONS.BLOW_UP_PREFIX + ' ')) {
		// 'blow up Italy' → 'destroy Italy factory'
		const country = action.slice(MANEUVER_ACTIONS.BLOW_UP_PREFIX.length + 1);
		return `destroy ${country} factory`;
	}

	return action;
}

// ---------------------------------------------------------------------------
// actionColor
// ---------------------------------------------------------------------------

/**
 * Returns a CSS colour for the given action code, or undefined for normal moves.
 *
 * @param {string|null} action - Raw action code.
 * @returns {string|undefined}
 */
export function actionColor(action) {
	if (!action) return undefined;

	if (action === MANEUVER_ACTIONS.PEACE) return '#52c41a';
	if (action === MANEUVER_ACTIONS.HOSTILE) return '#fa8c16';
	if (action.startsWith(MANEUVER_ACTIONS.WAR_PREFIX + ' ')) return '#f5222d';
	if (action.startsWith(MANEUVER_ACTIONS.BLOW_UP_PREFIX + ' ')) return '#a8071a';

	return undefined;
}

// ---------------------------------------------------------------------------
// isPeaceAction
// ---------------------------------------------------------------------------

/**
 * Returns true if the action is exactly 'peace'.
 *
 * @param {string|null} action - Raw action code.
 * @returns {boolean}
 */
export function isPeaceAction(action) {
	return action === MANEUVER_ACTIONS.PEACE;
}

// ---------------------------------------------------------------------------
// hasPeaceInAction
// ---------------------------------------------------------------------------

/**
 * Returns true if any entry in a compound action array has action === 'peace'.
 *
 * @param {{country: string|null, action: string}[]} compound
 * @returns {boolean}
 */
export function hasPeaceInAction(compound) {
	if (!compound || compound.length === 0) return false;
	return compound.some((entry) => entry.action === MANEUVER_ACTIONS.PEACE);
}
