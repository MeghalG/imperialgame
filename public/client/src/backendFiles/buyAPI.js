import { database } from './firebase.js';
import * as helper from './helper.js';

/**
 * Computes which stock denominations a player can actually afford to buy, factoring in
 * the refund from returning an existing stock. Only stocks with denominations higher than
 * the returned stock and with a cost within the player's budget (money + refund) are included.
 *
 * Called from: getCountryOptions, getReturnStockOptions, and getStockOptions as a helper
 * to filter available stocks by affordability.
 *
 * @param {number[]} availStock - Array of available stock denominations for a country
 * @param {number} money - The player's current cash
 * @param {number} returned - The denomination of the stock being returned (0 if none)
 * @param {number[]} costs - Array mapping stock denomination index to its cost in dollars
 * @returns {number[]} Array of stock denominations the player can afford to buy
 */
function realStockOpts(availStock, money, returned, costs) {
	let opts = [];
	money += costs[returned];
	for (let i in availStock) {
		if (money >= costs[availStock[i]] && availStock[i] > returned) {
			opts.push(availStock[i]);
		}
	}
	return opts;
}

/**
 * Returns the list of countries whose stock the current player can buy.
 * A country is buyable if it is not off-limits (already bought this investor round)
 * and the player can afford at least one available stock -- either outright or by
 * returning an existing stock of that country for a refund. Always includes "Punt Buy"
 * as a skip option.
 *
 * Called from: BuyApp and BuyBidApp to populate the country selection dropdown.
 *
 * @param {Object} context - UserContext with { game, name }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @returns {Promise<string[]>} Array of country names the player can buy from, plus "Punt Buy"
 */
async function getCountryOptions(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let countries = await helper.getCountries(context);
	let opts = [];
	let costs = await database.ref(setup + '/stockCosts').once('value');
	costs = costs.val();

	for (let i in countries) {
		let info = gameState.countryInfo[countries[i]];
		let offLimits = info.offLimits;
		let availStock = gameState.countryInfo[countries[i]].availStock;

		if (!availStock) {
			availStock = [];
		}
		let money = gameState.playerInfo[context.name].money;
		if (offLimits === true) {
			continue;
		}
		if (realStockOpts(availStock, money, 0, costs).length !== 0) {
			opts.push(countries[i]);
			continue;
		}
		let owned = gameState.playerInfo[context.name].stock;
		for (let j in owned) {
			if (owned[j].country === countries[i]) {
				if (realStockOpts(availStock, money, owned[j].stock, costs).length > 0) {
					opts.push(countries[i]);
					break;
				}
			}
		}
	}
	opts.push('Punt Buy');
	return opts;
}

/**
 * Returns the stock denominations the player can return (trade in) when buying stock for
 * a selected country. Returning a stock refunds its cost, allowing the player to afford
 * a higher denomination. Includes "None" if the player can afford a stock without returning.
 * Returns an empty array if "Punt Buy" is selected or no valid return options exist.
 *
 * Called from: BuyApp when the player has selected a country, to populate the return stock dropdown.
 *
 * @bug Marked as needing fixes (see "fix" comment in source).
 *
 * @param {Object} context - UserContext with { game, name, buyCountry }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @param {string} context.buyCountry - The country whose stock the player wants to buy
 * @returns {Promise<Array<number|string>>} Array of returnable stock denominations, possibly
 *   including "None". Empty array if buying is not possible or punted.
 */
async function getReturnStockOptions(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let country = context.buyCountry;
	if (country === 'Punt Buy') {
		return [];
	}
	let owned = gameState.playerInfo[context.name].stock;
	let availStock = gameState.countryInfo[country].availStock;
	let money = gameState.playerInfo[context.name].money;
	let costs = await database.ref(setup + '/stockCosts').once('value');
	costs = costs.val();

	let opts = [];
	if (realStockOpts(availStock, money, 0, costs).length > 0) {
		opts.push('None');
	}
	for (let i in owned) {
		if (owned[i].country === country && realStockOpts(availStock, money, owned[i].stock, costs).length > 0) {
			opts.push(owned[i].stock);
		}
	}
	if (opts.length === 1 && opts[0] === 'None') {
		opts = [];
	}
	return opts;
}

/**
 * Returns the stock denominations available for purchase given the selected country
 * and any stock being returned. Factors in the player's money plus the refund from
 * returning stock. Returns an empty array if "Punt Buy" is selected.
 *
 * Called from: BuyApp after the player selects a country and (optionally) a stock to return,
 * to populate the stock denomination dropdown.
 *
 * @param {Object} context - UserContext with { game, name, buyCountry, returnStock }
 * @param {string} context.game - The Firebase game ID
 * @param {string} context.name - The current player's name
 * @param {string} context.buyCountry - The country whose stock the player wants to buy
 * @param {number|string} context.returnStock - The stock denomination being returned ("None" or "" for none)
 * @returns {Promise<number[]>} Array of affordable stock denominations
 */
async function getStockOptions(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let country = context.buyCountry;
	if (country === 'Punt Buy') {
		return [];
	}
	let availStock = gameState.countryInfo[country].availStock;
	let costs = await database.ref(setup + '/stockCosts').once('value');
	costs = costs.val();
	if (!availStock) {
		availStock = [];
	}
	let money = gameState.playerInfo[context.name].money;
	let returned = context.returnStock;
	if (returned === 'None' || returned === '') {
		returned = 0;
	}
	return realStockOpts(availStock, money, returned, costs);
}

export { getCountryOptions, getReturnStockOptions, getStockOptions };
