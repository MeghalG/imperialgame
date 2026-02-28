import { database } from './firebase.js';
import * as helper from './helper.js';
import { readGameState } from './stateCache.js';

/**
 * Retrieves all existing game IDs from Firebase. Returns an empty array if no games exist.
 *
 * Called from: EnterApp and LoginApp to display the list of available games for the player
 * to join or spectate.
 *
 * @returns {Promise<string[]>} Array of game ID strings, or empty array if none exist
 */
async function getGameIDs() {
	let ids = await database.ref('games').once('value');
	ids = ids.val();
	if (!ids) {
		return [];
	}
	ids = Object.keys(ids);
	return ids;
}

/**
 * Retrieves the current player's cash amount from Firebase.
 *
 * Called from: BidApp to display how much money the player has available for bidding.
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<number>} The player's current money
 */
async function getMoney(context) {
	let gameState = await readGameState(context);
	return gameState.playerInfo[context.name].money;
}
/**
 * Retrieves the name of the country whose turn it currently is.
 *
 * Called from: BidApp, BuyBidApp, and other components to display which country
 * is currently active.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<string>} The name of the current country (e.g. "Austria")
 */
async function getCountry(context) {
	let gameState = await readGameState(context);
	return gameState.countryUp;
}

/**
 * Retrieves the current player's bid amount from Firebase.
 *
 * Called from: BuyBidApp to display the player's winning bid when deciding whether to buy.
 *
 * @bug Marked as needing fixes (see "fix" comment in source).
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<number>} The player's current bid amount
 */
async function getBid(context) {
	let gameState = await readGameState(context);
	return gameState.playerInfo[context.name].bid;
}

/**
 * Retrieves the stock information for the buy-bid decision. Returns an object with the
 * current country and the stock denomination that the player's bid can afford.
 * Uses helper.getStockBelow to find the highest denomination the bid covers.
 *
 * Called from: BuyBidApp to display which stock the player would receive if they buy.
 *
 * @bug Marked as needing fixes (see "fix" comment in source).
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<{country: string, value: number}>} Object with the country name
 *   and the stock denomination value the bid covers
 */
async function getStock(context) {
	let gameState = await readGameState(context);
	let country = gameState.countryUp;
	let bid = gameState.playerInfo[context.name].bid;
	let value = await helper.getStockBelow(bid, gameState.countryInfo[country], context);
	return { country: country, value: value };
}

/**
 * Retrieves the two proposal descriptions that players vote between.
 * Returns an array with proposal 1 (leader's proposal) and proposal 2 (opposition's proposal).
 *
 * Called from: VoteApp to display both proposals for the player to vote on.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<[string, string]>} Array of two proposal description strings
 */
async function getVoteOptions(context) {
	let gameState = await readGameState(context);
	return [gameState.voting['proposal 1'].proposal, gameState.voting['proposal 2'].proposal];
}

/**
 * Retrieves the complete game state object from Firebase. This is a heavy operation
 * that fetches the entire games/{gameID} node.
 *
 * Called from: Various components that need the full game state for complex computations.
 *
 * @bug Marked as needing fixes (see "fix" comment in source).
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<GameState>} The complete game state object
 */
async function getGameState(context) {
	let gameState = await readGameState(context);
	return gameState;
}

export { getGameIDs, getMoney, getCountry, getBid, getStock, getVoteOptions, getGameState };
