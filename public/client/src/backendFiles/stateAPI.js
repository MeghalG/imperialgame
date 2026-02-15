import { database } from './firebase.js';
import * as helper from './helper.js';

async function getCountryInfo(context) {
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();
	return countryInfo;
}

// fix
function getCashValue(info) {
	return 5;
}

async function getPlayerInfo(context) {
	let playerInfo = await database.ref('games/' + context.game + '/playerInfo').once('value');
	playerInfo = playerInfo.val();
	for (let key in playerInfo) {
		playerInfo[key]['cashValue'] = getCashValue(playerInfo[key]);
	}
	return playerInfo;
}

export { getCountryInfo, getPlayerInfo };
