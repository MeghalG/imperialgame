import { database } from './firebase.js';
import * as helper from './helper.js';

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

// done, needs checking
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

// fix
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

// done
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
