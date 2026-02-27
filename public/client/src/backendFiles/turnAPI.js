import { database } from './firebase.js';
import * as helper from './helper.js';
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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
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
	let players = await database.ref('games/' + context.game + '/playerInfo').once('value');
	players = Object.keys(players.val());
	if (!players.includes(name)) {
		return 'Log in as a player to take your turn.';
	}
	let myTurn = await database.ref('games/' + context.game + '/playerInfo/' + name + '/myTurn').once('value');
	myTurn = myTurn.val();
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
	let mode = await database.ref('games/' + context.game + '/mode').once('value');
	mode = mode.val();
	let turn = await database.ref('games/' + context.game + '/playerInfo/' + context.name + '/myTurn').once('value');
	turn = turn.val();
	if (context.name && turn) {
		return mode;
	} else {
		return 'non-turn';
	}
}

/**
 * Retrieves the current turn ID from Firebase. The turn ID is an auto-incrementing counter
 * that changes each time a turn is submitted, allowing components to detect state changes
 * and re-render.
 *
 * Called from: GameApp to listen for turn changes and trigger UI updates.
 *
 * @caveat The original author noted: "probably update turnID at the end of submit methods
 *   and listen for them instead."
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<number>} The current turn ID number
 */
async function getTurnID(context) {
	let turnID = await database.ref('games/' + context.game + '/turnID').once('value');
	turnID = turnID.val();
	return turnID;
}

/**
 * Checks whether the current player can undo the last action. The undo field in Firebase
 * stores the name of the last player who submitted a turn. Only that player can undo.
 * Returns the player's name if they can undo, or false otherwise.
 *
 * Called from: TurnApp to conditionally show the undo button.
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<string|false>} The player's name if undo is available, or false
 */
async function undoable(context) {
	let undoPlayer = await database.ref('games/' + context.game + '/undo').once('value');
	undoPlayer = undoPlayer.val();
	return undoPlayer === context.name && context.name;
}

/**
 * Checks whether it is currently the player's turn. Returns the myTurn boolean from
 * the player's info in Firebase. Returns false if the player name or game ID is not set.
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
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let myTurn = (gameState.playerInfo[context.name] || {}).myTurn;
	return myTurn;
}

export { getTitle, getTurnTitle, getMode, getTurnID, undoable, getMyTurn };
