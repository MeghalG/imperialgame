/**
 * Game constants for Imperial (CommonJS version for Cloud Functions).
 * Kept in sync with public/client/src/gameConstants.js
 * @module gameConstants
 */

const MODES = {
	BID: 'bid',
	BUY_BID: 'buy-bid',
	BUY: 'buy',
	PROPOSAL: 'proposal',
	PROPOSAL_OPP: 'proposal-opp',
	VOTE: 'vote',
	CONTINUE_MAN: 'continue-man',
	PEACE_VOTE: 'peace-vote',
	GAME_OVER: 'game-over',
};

const WHEEL_ACTIONS = {
	FACTORY: 'Factory',
	L_PRODUCE: 'L-Produce',
	R_PRODUCE: 'R-Produce',
	INVESTOR: 'Investor',
	TAXATION: 'Taxation',
	IMPORT: 'Import',
	L_MANEUVER: 'L-Maneuver',
	R_MANEUVER: 'R-Maneuver',
};

const GOV_TYPES = {
	DICTATORSHIP: 'dictatorship',
	DEMOCRACY: 'democracy',
};

const MANEUVER_ACTIONS = {
	MOVE: '',
	PEACE: 'peace',
	HOSTILE: 'hostile',
	WAR_PREFIX: 'war',
	BLOW_UP_PREFIX: 'blow up',
};

const UNIT_TYPES = {
	FLEET: 'fleet',
	ARMY: 'army',
};

const WHEEL_CENTER = 'center';
const PUNT_BUY = 'Punt Buy';
const NO_RETURN_STOCK = 'None';
const WIN_POINTS = 25;
const IMPORT_COST = 1;
const FACTORY_COST = 5;
const INVESTOR_BONUS = 2;
const FREE_RONDEL_STEPS = 3;
const RONDEL_STEP_COST = 2;
const MAX_TAX_POINTS = 15;
const TIMER_VIOLATION_RESET = 60;
const TIMER_VIOLATION_PENALTY = 1;
const STARTING_MONEY_POOL = 61;

module.exports = {
	MODES,
	WHEEL_ACTIONS,
	GOV_TYPES,
	MANEUVER_ACTIONS,
	UNIT_TYPES,
	WHEEL_CENTER,
	PUNT_BUY,
	NO_RETURN_STOCK,
	WIN_POINTS,
	IMPORT_COST,
	FACTORY_COST,
	INVESTOR_BONUS,
	FREE_RONDEL_STEPS,
	RONDEL_STEP_COST,
	MAX_TAX_POINTS,
	TIMER_VIOLATION_RESET,
	TIMER_VIOLATION_PENALTY,
	STARTING_MONEY_POOL,
};
