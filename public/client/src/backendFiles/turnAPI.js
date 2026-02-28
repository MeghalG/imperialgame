import * as helper from './helper.js';
import { readGameState } from './stateCache.js';
import { MODES, GOV_TYPES } from '../gameConstants.js';

/**
 * Builds a human-readable title string describing the current turn state.
 * Includes which player(s) are up and what action they need to take based on the game mode.
 * For example: "Alice up with bidding on Austria." or "Bob up with Austria as autocratic leader."
 * In game-over mode, returns the winner's name.
 *
 * Called from: GameApp or MainApp to display the current turn status header.
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<string>} Human-readable turn status message
 */
async function getTitle(context) {
	let gameState = await readGameState(context);
	let mode = gameState.mode;
	let country = gameState.countryUp;
	let players = [];
	for (let key in gameState.playerInfo) {
		if (gameState.playerInfo[key].myTurn) {
			players.push(key);
		}
	}

	let s = players.join(', ');
	s += ' up with ';

	switch (mode) {
		case MODES.BID:
			s += 'bidding on ' + country + '.';
			break;
		case MODES.BUY_BID:
			let stock = await helper.getStockBelow(
				gameState.playerInfo[players[0]].bid,
				gameState.countryInfo[country],
				context
			);
			s += 'deciding on buying the ' + country + ' ' + stock + '.';
			break;
		case MODES.BUY:
			s += 'a buy on ' + gameState.countryUp + ' investor.';
			break;
		case MODES.PROPOSAL:
			if (gameState.countryInfo[country].gov === GOV_TYPES.DICTATORSHIP) {
				s += country + ' as autocratic leader.';
			} else {
				s += country + ' as democratic leader.';
			}
			break;
		case MODES.PROPOSAL_OPP:
			s += country + ' as democratic opposition.';
			break;
		case MODES.VOTE:
			s += 'votes.';
			break;
		case MODES.CONTINUE_MAN:
			if (gameState.currentManeuver && gameState.currentManeuver.pendingPeace) {
				let peace = gameState.currentManeuver.pendingPeace;
				s += 'a peace decision on ' + peace.targetCountry + ' territory (' + peace.destination + ').';
			} else {
				s += 'continuing the ' + country + ' maneuver.';
			}
			break;
		case MODES.PEACE_VOTE:
			if (gameState.peaceVote) {
				s +=
					'voting on a peace offer from ' +
					gameState.peaceVote.movingCountry +
					' at ' +
					gameState.peaceVote.destination +
					'.';
			} else {
				s += 'a peace vote.';
			}
			break;
		case MODES.GAME_OVER:
			s = helper.getWinner(gameState) + ' has won.';
			break;
		default:
			break;
	}
	return s;
}

/**
 * Returns a short prompt telling the current player whether it is their turn.
 * If the player is not in the game, prompts them to log in. If it is their turn,
 * returns "Take Your Turn." Otherwise returns "Not Your Turn."
 *
 * Called from: TurnApp to display the turn prompt above the action controls.
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<string>} One of: "Take Your Turn.", "Not Your Turn.", or
 *   "Log in as a player to take your turn."
 */
async function getTurnTitle(context) {
	let name = context.name;
	let gameState = await readGameState(context);
	let players = Object.keys(gameState.playerInfo);
	if (!players.includes(name)) {
		return 'Log in as a player to take your turn.';
	}
	let myTurn = gameState.playerInfo[name].myTurn;
	if (myTurn) {
		return 'Take Your Turn.';
	} else {
		return 'Not Your Turn.';
	}
}

/**
 * Returns the current game mode if it is the player's turn, otherwise returns "non-turn".
 * This is used by TurnApp to decide which action component to render. If the player's
 * name is not set or it is not their turn, the static (read-only) view is shown.
 *
 * Called from: TurnApp to determine which mode-specific component to render.
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<string>} The game mode string (e.g. "bid", "proposal") or "non-turn"
 */
async function getMode(context) {
	let gameState = await readGameState(context);
	let mode = gameState.mode;
	let turn = (gameState.playerInfo[context.name] || {}).myTurn;
	if (context.name && turn) {
		return mode;
	} else {
		return 'non-turn';
	}
}

/**
 * Retrieves the current turn ID from the cached game state. The turn ID is an
 * auto-incrementing counter that changes each time a turn is submitted, allowing
 * components to detect state changes and re-render.
 *
 * Called from: GameApp to listen for turn changes and trigger UI updates.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<number>} The current turn ID number
 */
async function getTurnID(context) {
	let gameState = await readGameState(context);
	return gameState.turnID;
}

/**
 * Checks whether the current player can undo the last action. The undo field in the
 * game state stores the name of the last player who submitted a turn. Only that player
 * can undo. Returns the player's name if they can undo, or false otherwise.
 *
 * Called from: TurnApp to conditionally show the undo button.
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<string|false>} The player's name if undo is available, or false
 */
async function undoable(context) {
	let gameState = await readGameState(context);
	let undoPlayer = gameState.undo;
	return undoPlayer === context.name && context.name;
}

/**
 * Checks whether it is currently the player's turn. Returns the myTurn boolean from
 * the player's info. Returns false if the player name or game ID is not set.
 *
 * Called from: GameApp and other components to determine if the current player should
 * see active controls or a read-only view.
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<boolean>} True if it is the player's turn, false otherwise
 */
async function getMyTurn(context) {
	if (!context.name || !context.game) {
		return false;
	}
	let gameState = await readGameState(context);
	let myTurn = (gameState.playerInfo[context.name] || {}).myTurn;
	return myTurn;
}

/**
 * Consolidated turn state reader. Computes all values TurnApp needs from a single
 * cached game state read, eliminating redundant Firebase calls.
 *
 * Called from: TurnApp.newTurn() instead of 4 separate turnAPI calls.
 *
 * @param {Object} context - UserContext with { game, name }
 * @returns {Promise<{turnTitle: string, mode: string, undoable: string|false, turnID: number}>}
 */
async function getTurnState(context) {
	let gameState = await readGameState(context);

	// turnTitle
	let name = context.name;
	let players = Object.keys(gameState.playerInfo);
	let turnTitle;
	if (!players.includes(name)) {
		turnTitle = 'Log in as a player to take your turn.';
	} else if (gameState.playerInfo[name].myTurn) {
		turnTitle = 'Take Your Turn.';
	} else {
		turnTitle = 'Not Your Turn.';
	}

	// mode
	let turn = (gameState.playerInfo[context.name] || {}).myTurn;
	let mode = context.name && turn ? gameState.mode : 'non-turn';

	// undoable
	let undoPlayer = gameState.undo;
	let canUndo = undoPlayer === context.name && context.name;

	// turnID
	let turnID = gameState.turnID;

	return { turnTitle, mode, undoable: canUndo, turnID };
}

export { getTitle, getTurnTitle, getMode, getTurnID, undoable, getMyTurn, getTurnState };
