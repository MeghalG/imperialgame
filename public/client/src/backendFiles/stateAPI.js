import { database } from './firebase.js';

/**
 * Retrieves the country info object for all countries from Firebase.
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
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();
	return countryInfo;
}

/**
 * Computes the cash value multiplier for a player's portfolio. Currently hardcoded to
 * return 5 regardless of input.
 *
 * Called from: getPlayerInfo to attach a cashValue field to each player's info.
 *
 * @bug Always returns 5 -- this is a placeholder that needs to be implemented with
 *   actual cash value calculation logic.
 *
 * @param {PlayerInfo} info - The player info object (currently unused)
 * @returns {number} Always returns 5
 */
function getCashValue(info) {
	return 5;
}

/**
 * Retrieves the player info for all players from Firebase, augmented with a computed
 * cashValue field for each player. Contains each player's money, stock, turn status, etc.
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
	let playerInfo = await database.ref('games/' + context.game + '/playerInfo').once('value');
	playerInfo = playerInfo.val();
	for (let key in playerInfo) {
		playerInfo[key]['cashValue'] = getCashValue(playerInfo[key]);
	}
	return playerInfo;
}

export { getCountryInfo, getPlayerInfo };
