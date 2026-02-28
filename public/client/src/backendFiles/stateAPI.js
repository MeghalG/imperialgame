import * as helper from './helper.js';
import { readGameState } from './stateCache.js';

/**
 * Retrieves the country info object for all countries from the cached game state.
 * Contains each country's money, points, factories, leadership, units, etc.
 *
 * Called from: StateApp to render country status cards showing treasury, points,
 * factories, armies, fleets, and leadership for every country.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Object<string, CountryInfo>>} Map of country name to CountryInfo objects
 */
async function getCountryInfo(context) {
	let gameState = await readGameState(context);
	return gameState ? gameState.countryInfo : null;
}

/**
 * Retrieves the player info for all players from the cached game state, augmented with a
 * computed cashValue field for each player. Contains each player's money, stock, turn status, etc.
 *
 * Also uses countryInfo to compute each player's cash value using helper.computeCash(),
 * which values each stock at $2 per denomination unit plus the player's cash on hand.
 *
 * Called from: StateApp to render player status cards showing money, stocks, scores,
 * and investor status for every player.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<Object<string, PlayerInfo>>} Map of player name to PlayerInfo objects,
 *   each augmented with a cashValue property
 */
async function getPlayerInfo(context) {
	let gameState = await readGameState(context);
	let playerInfo = gameState.playerInfo;
	let countryInfo = gameState.countryInfo;
	for (let key in playerInfo) {
		playerInfo[key]['cashValue'] = helper.computeCash(playerInfo[key], countryInfo);
	}
	return playerInfo;
}

export { getCountryInfo, getPlayerInfo };
