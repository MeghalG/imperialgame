/**
 * Game constants and type definitions for Imperial.
 *
 * Replaces magic strings scattered throughout the codebase with named constants.
 * Import from this file instead of using string literals.
 *
 * @module gameConstants
 */

// ---------------------------------------------------------------------------
// Game Modes — drives TurnApp routing and submitAPI state transitions
// ---------------------------------------------------------------------------

/** @enum {string} */
export const MODES = {
	/** All players simultaneously bid on the current country's stock */
	BID: 'bid',
	/** Highest bidder decides to buy or pass */
	BUY_BID: 'buy-bid',
	/** Investor card triggered; players buy stock in turn order */
	BUY: 'buy',
	/** Country leader makes a proposal (chooses a wheel action) */
	PROPOSAL: 'proposal',
	/** Opposition leader counter-proposes (democracy only) */
	PROPOSAL_OPP: 'proposal-opp',
	/** Stockholders vote on leader vs opposition proposal */
	VOTE: 'vote',
	/** Multi-step maneuver continuation — units move one at a time */
	CONTINUE_MAN: 'continue-man',
	/** Peace vote — target country stockholders vote on a peace offer */
	PEACE_VOTE: 'peace-vote',
	/** A country reached 25 points; game over */
	GAME_OVER: 'game-over',
};

// ---------------------------------------------------------------------------
// Wheel Actions — rondel positions, used by ProposalApp and executeProposal
// ---------------------------------------------------------------------------

/** @enum {string} */
export const WHEEL_ACTIONS = {
	FACTORY: 'Factory',
	L_PRODUCE: 'L-Produce',
	R_PRODUCE: 'R-Produce',
	INVESTOR: 'Investor',
	TAXATION: 'Taxation',
	IMPORT: 'Import',
	L_MANEUVER: 'L-Maneuver',
	R_MANEUVER: 'R-Maneuver',
};

// ---------------------------------------------------------------------------
// Government Types — determines proposal flow (leader-only vs leader+opp+vote)
// ---------------------------------------------------------------------------

/** @enum {string} */
export const GOV_TYPES = {
	/** Leader owns >= 50% of stock by denomination; proposals execute immediately */
	DICTATORSHIP: 'dictatorship',
	/** No single player owns >= 50%; opposition counter-proposes, stockholders vote */
	DEMOCRACY: 'democracy',
};

// ---------------------------------------------------------------------------
// Maneuver Action Codes — encoded as strings in fleetMan/armyMan tuples
// ---------------------------------------------------------------------------

/**
 * Action codes used in the third element of ManeuverTuples.
 * Some are prefixes (WAR, BLOW_UP) that get combined with a country/unit.
 * @enum {string}
 */
export const MANEUVER_ACTIONS = {
	/** Normal move; also places tax chip on unowned territory. Encoded as empty string. */
	MOVE: '',
	/** Peaceful entry into foreign territory (army only, non-hostile) */
	PEACE: 'peace',
	/** Hostile entry into foreign territory (army only) */
	HOSTILE: 'hostile',
	/**
	 * Attack prefix. Full form: "war {countryName} {unitType}"
	 * e.g. "war France fleet" or "war Austria army"
	 */
	WAR_PREFIX: 'war',
	/**
	 * Destroy factory prefix. Full form: "blow up {countryName}"
	 * e.g. "blow up France"
	 */
	BLOW_UP_PREFIX: 'blow up',
};

// ---------------------------------------------------------------------------
// Unit Types — used in import options and maneuver war actions
// ---------------------------------------------------------------------------

/** @enum {string} */
export const UNIT_TYPES = {
	FLEET: 'fleet',
	ARMY: 'army',
};

// ---------------------------------------------------------------------------
// Wheel Starting Position
// ---------------------------------------------------------------------------

/** The starting wheel position for countries before their first move */
export const WHEEL_CENTER = 'center';

// ---------------------------------------------------------------------------
// Special Values
// ---------------------------------------------------------------------------

/** Option shown when a player wants to skip their investor buy */
export const PUNT_BUY = 'Punt Buy';

/** Option shown when a player doesn't want to return stock during a buy */
export const NO_RETURN_STOCK = 'None';

// ---------------------------------------------------------------------------
// Game Parameters
// ---------------------------------------------------------------------------

/** Points needed to win the game */
export const WIN_POINTS = 25;

/** Cost per import unit (in dollars) */
export const IMPORT_COST = 1;

/** Cost to build a factory (in dollars) */
export const FACTORY_COST = 5;

/** Bonus money investor card holder receives when investor is passed */
export const INVESTOR_BONUS = 2;

/** Number of free rondel steps before paying (steps 4+ cost $2 each) */
export const FREE_RONDEL_STEPS = 3;

/** Cost per extra rondel step beyond the free steps */
export const RONDEL_STEP_COST = 2;

/** Maximum taxation points per tax event */
export const MAX_TAX_POINTS = 15;

/** Default banked time (seconds) a player gets after a timer violation */
export const TIMER_VIOLATION_RESET = 60;

/** Score penalty for a timer violation */
export const TIMER_VIOLATION_PENALTY = 1;

/** Starting money pool divided among players: 61 / playerCount */
export const STARTING_MONEY_POOL = 61;

// ---------------------------------------------------------------------------
// JSDoc Type Definitions
// ---------------------------------------------------------------------------

/**
 * The complete game state object stored at games/{gameID}/ in Firebase.
 *
 * @typedef {Object} GameState
 * @property {string} mode - Current game phase (one of MODES values)
 * @property {string} countryUp - Name of the country whose turn it is
 * @property {number} round - Current round number
 * @property {number} turnID - Auto-incrementing turn counter
 * @property {string} setup - Firebase path to the setup config (e.g. "setups/standard")
 * @property {boolean} sameTurn - True if the turn hasn't fully changed
 * @property {string|null} undo - Player name who last submitted (can undo), or null
 * @property {string[]} history - Human-readable history messages
 * @property {Object|null} ['proposal 1'] - Stringified leader's proposal context, or null
 * @property {Object|null} ['proposal 2'] - Stringified opposition's proposal context, or null
 * @property {VotingState|null} voting - Vote tracking, or null when not voting
 * @property {string[]} [bidBuyOrder] - Ordered player names by bid (buy-bid mode only)
 * @property {string[]|null} [swissSet] - Players who punted this investor round
 * @property {Object|null} [currentManeuver] - Maneuver state (stub)
 * @property {TimerState} timer - Timer configuration and state
 * @property {Object<string, PlayerInfo>} playerInfo - Player data keyed by name
 * @property {Object<string, CountryInfo>} countryInfo - Country data keyed by country name
 */

/**
 * Per-player state stored at games/{gameID}/playerInfo/{name}/.
 *
 * @typedef {Object} PlayerInfo
 * @property {number} money - Player's cash (float, rounded to 2 decimals on save)
 * @property {boolean} myTurn - True if this player should act right now
 * @property {boolean} investor - True if this player holds the investor card
 * @property {number} order - Turn order (1-based), set by wealth after bidding
 * @property {boolean} swiss - True if this player gets a swiss banking buy
 * @property {StockEntry[]} stock - Stocks owned by this player
 * @property {number} scoreModifier - Points added/subtracted (e.g. timer penalties)
 * @property {string} email - Email for turn notifications (may be empty)
 * @property {number} banked - Banked time in seconds (chess-clock)
 * @property {number} [bid] - Current bid amount (transient, deleted after bid round)
 */

/**
 * Per-country state stored at games/{gameID}/countryInfo/{country}/.
 *
 * @typedef {Object} CountryInfo
 * @property {number} money - Country treasury
 * @property {number} points - Victory points (0-25)
 * @property {string[]} factories - Territory names where this country has factories
 * @property {string} wheelSpot - Current rondel position (action name or "center")
 * @property {string} gov - Government type: "dictatorship" or "democracy"
 * @property {string[]} leadership - Player names sorted by stock ownership desc. [0]=leader, [1]=opposition.
 * @property {number[]} availStock - Available stock denominations for purchase
 * @property {boolean} offLimits - True if stock was already bought this investor round
 * @property {number} lastTax - Points threshold from last taxation
 * @property {string[]} taxChips - Territory names where this country has tax chips
 * @property {FleetUnit[]} [fleets] - Fleet units (may be undefined if no fleets)
 * @property {ArmyUnit[]} [armies] - Army units (may be undefined if no armies)
 */

/**
 * A stock entry in a player's portfolio.
 *
 * @typedef {Object} StockEntry
 * @property {string} country - Country name (e.g. "Austria")
 * @property {number} stock - Stock denomination/value (1-8, maps to stockCosts index)
 */

/**
 * A fleet unit on the board.
 *
 * @typedef {Object} FleetUnit
 * @property {string} territory - Territory name where the fleet is located
 * @property {boolean} hostile - Always true for fleets
 */

/**
 * An army unit on the board.
 *
 * @typedef {Object} ArmyUnit
 * @property {string} territory - Territory name where the army is located
 * @property {boolean} hostile - True = occupying/hostile. False = peaceful passage.
 */

/**
 * A maneuver instruction for a single unit (fleet or army).
 * Stored as a 3-element array: [origin, destination, actionCode].
 *
 * actionCode values:
 * - "" (empty) — normal move, places tax chip on unowned territory
 * - "peace" — peaceful entry into foreign territory
 * - "hostile" — hostile entry (army only)
 * - "war {country} {unitType}" — destroy an enemy unit
 * - "blow up {country}" — destroy a factory
 *
 * @typedef {[string, string, string]} ManeuverTuple
 */

/**
 * Import action data specifying up to 3 unit imports.
 *
 * @typedef {Object} ImportData
 * @property {string[]} types - Array of "fleet" or "army" for each import slot
 * @property {string[]} territories - Array of territory names for each import slot
 */

/**
 * Vote tracking state. Only exists during vote mode.
 *
 * @typedef {Object} VotingState
 * @property {string} country - Country being voted on
 * @property {ProposalVote} ['proposal 1'] - Leader's proposal vote data
 * @property {ProposalVote} ['proposal 2'] - Opposition's proposal vote data
 */

/**
 * Vote data for a single proposal.
 *
 * @typedef {Object} ProposalVote
 * @property {string} proposal - Human-readable proposal description
 * @property {number} votes - Vote tally (stock denomination sum + 0.1 leader bonus)
 * @property {string[]} voters - Player names who voted for this
 */

/**
 * Timer configuration and state.
 *
 * @typedef {Object} TimerState
 * @property {boolean} timed - Whether this game uses timed turns
 * @property {number} increment - Seconds added per turn (chess-clock increment)
 * @property {number} pause - Server timestamp when paused (0 = not paused)
 * @property {number} lastMove - Server timestamp of last move
 * @property {number} banked - Default banked time in seconds (template value)
 */

/**
 * Static territory data from the setup configuration.
 *
 * @typedef {Object} TerritorySetup
 * @property {string|null} country - Owning country name, or null if neutral/sea
 * @property {string|boolean} [port] - Truthy if port territory; may be adjacent sea name
 * @property {boolean} [sea] - True if sea territory
 * @property {string[]} adjacencies - Adjacent territory names
 * @property {number[]} unitCoords - [x, y] pixel coordinates for drawing units
 * @property {number[]} factoryCoords - [x, y] pixel coordinates for drawing factories
 * @property {number[]} taxChipCoords - [x, y] pixel coordinates for drawing tax chips
 */

/**
 * Tracks step-by-step maneuver progress during continue-man mode.
 * Stored at games/{gameID}/currentManeuver in Firebase.
 *
 * @typedef {Object} CurrentManeuver
 * @property {string} country - Country being maneuvered (e.g. "Austria")
 * @property {string} player - Player building the proposal
 * @property {string} wheelSpot - "L-Maneuver" or "R-Maneuver"
 * @property {"fleet"|"army"} phase - Current phase
 * @property {number} unitIndex - Index into pendingFleets or pendingArmies
 * @property {FleetUnit[]} pendingFleets - Original fleet positions
 * @property {ArmyUnit[]} pendingArmies - Original army positions
 * @property {ManeuverTuple[]} completedFleetMoves - Resolved fleet ManeuverTuples
 * @property {ManeuverTuple[]} completedArmyMoves - Resolved army ManeuverTuples
 * @property {string} returnMode - Where to go after all units done ("execute", "proposal-opp", "vote")
 * @property {number} proposalSlot - Which proposal slot to fill (0=execute, 1=leader, 2=opposition)
 * @property {Object|null} [pendingPeace] - Pending dictatorship peace vote info
 */

/**
 * Peace vote state for democracy target countries.
 * Stored at games/{gameID}/peaceVote in Firebase during peace-vote mode.
 *
 * @typedef {Object} PeaceVote
 * @property {string} movingCountry - Country making the peace offer
 * @property {string} targetCountry - Country that owns the territory
 * @property {"fleet"|"army"} unitType - Type of moving unit
 * @property {string} origin - Where the unit is coming from
 * @property {string} destination - Territory being entered
 * @property {number} acceptVotes - Weighted accept vote total
 * @property {number} rejectVotes - Weighted reject vote total
 * @property {string[]} voters - Player names who have voted
 * @property {number} totalStock - Sum of all stock denominations for threshold
 */
