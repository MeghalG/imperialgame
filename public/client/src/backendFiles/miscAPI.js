import { database } from './firebase.js';
import * as helper from './helper.js';

async function getGameIDs() {
	let ids = await database.ref('games').once('value');
	ids = ids.val();
	if (!ids) {
		return [];
	}
	ids = Object.keys(ids);
	return ids;
}

// done, needs checking
async function getMoney(context) {
	let money = await database.ref('games/' + context.game + '/playerInfo/' + context.name + '/money').once('value');
	money = money.val();
	return money;
}
async function getCountry(context) {
	let country = await database.ref('games/' + context.game + '/countryUp').once('value');
	country = country.val();
	return country;
}

// fix
async function getBid(context) {
	let bid = await database.ref('games/' + context.game + '/playerInfo/' + context.name + '/bid').once('value');
	bid = bid.val();
	return bid;
}

// fix
async function getStock(context) {
	let t = {};
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let country = await database.ref('games/' + context.game + '/countryUp').once('value');
	country = country.val();
	t['country'] = country;
	let bid = await database.ref('games/' + context.game + '/playerInfo/' + context.name + '/bid').once('value');
	bid = bid.val();
	let value = await helper.getStockBelow(bid, countryInfo[country], context);
	t['value'] = value;
	return t;
}

// done
async function getVoteOptions(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	return [gameState.voting['proposal 1'].proposal, gameState.voting['proposal 2'].proposal];
}

// fix
async function getGameState(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	return gameState;
}

export { getGameIDs, getMoney, getCountry, getBid, getStock, getVoteOptions, getGameState };
