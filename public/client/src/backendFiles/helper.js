import { database } from './firebase.js';

async function getCountries(context) {
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let countries = await database.ref(setup + '/countries').once('value');
	countries = countries.val();
	let t = [null, null, null, null, null, null];
	for (let key in countries) {
		t[countries[key].order - 1] = key;
	}
	return t;
}

async function getPlayersInOrder(context) {
	let playerInfo = await database.ref('games/' + context.game + '/playerInfo').once('value');
	playerInfo = playerInfo.val();
	let t = [null, null, null, null, null, null];
	for (let key in playerInfo) {
		if (playerInfo[key].order) {
			t[playerInfo[key].order - 1] = key;
		} else {
			t = Object.keys(playerInfo);
		}
	}
	return t;
}

// done, needs checking
function getOwnedStock(leadership, playerInfo, country) {
	let amt = [];
	for (let i in leadership) {
		let t = 0;
		for (let j in playerInfo[leadership[i]].stock) {
			if (playerInfo[leadership[i]].stock[j].country === country) {
				t += playerInfo[leadership[i]].stock[j].stock;
			}
		}
		amt.push([leadership[i], t]);
	}
	return amt;
}

// done, needs checking
// gets a list of every territory being sat on currently (has multiplicity)
function getSat(countryInfo, country) {
	let sat = [];
	for (let key in countryInfo) {
		if (key !== country) {
			for (let i in countryInfo[key].armies) {
				if (countryInfo[key].armies[i].hostile) {
					sat.push(countryInfo[key].armies[i].territory);
				}
			}
		}
	}
	return sat;
}

// done, needs checking
function getUnsatFactories(countryInfo, country) {
	let sat = getSat(countryInfo, country);
	let factories = countryInfo[country].factories;
	let opts = [];
	for (let i in factories) {
		if (!sat.includes(factories[i])) {
			opts.push(factories[i]);
		}
	}
	return opts;
}

// done, needs checking
async function getUnsatTerritories(countryInfo, country, portsOnly, context) {
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let allTerritories = await database.ref(setup + '/territories').once('value');
	allTerritories = allTerritories.val();
	let sat = getSat(countryInfo, country);

	let territories = [];
	for (let t in allTerritories) {
		if (allTerritories[t].country === country && !sat.includes(t) && (!portsOnly || allTerritories[t].port)) {
			territories.push(t);
		}
	}
	return territories;
}

function getInvestorPayout(gameState, country, name) {
	let leadership = gameState.countryInfo[country].leadership;
	let amt = getOwnedStock(leadership, gameState.playerInfo, country);

	let total = 0;
	let index = 0;
	for (let i in amt) {
		total += amt[i][1];
		if (amt[i][0] === name) {
			index = i;
		}
	}
	if (total > gameState.countryInfo[country].money) {
		let shortfall = total - gameState.countryInfo[country].money;
		amt[index][1] -= shortfall;
	}
	return amt;
}

// done, needs checking
function getTaxSplit(money, countryInfo, playerInfo, country) {
	let leadership = countryInfo[country].leadership;
	let stockOwned = getOwnedStock(leadership, playerInfo, country);
	let arr = [];
	for (let i in stockOwned) {
		for (let j = 0; j < money; j++) {
			// decimal approximation might be an issue
			arr.push([stockOwned[i][0], stockOwned[i][1], j + 1]);
		}
	}
	arr.sort((a, b) => b[1] * a[2] - a[1] * b[2]);
	let taxSplit = [];
	let taxDict = {};

	for (let i = 0; i < money; i++) {
		if (!Object.keys(taxDict).includes(arr[i][0])) {
			taxDict[arr[i][0]] = 0;
		}
		taxDict[arr[i][0]] += 1;
	}
	for (let i in leadership) {
		if (Object.keys(taxDict).includes(leadership[i])) {
			taxSplit.push([leadership[i], taxDict[leadership[i]]]);
		}
	}
	return taxSplit;
}

// done, needs checking
async function getTaxInfo(countryInfo, playerInfo, country) {
	let ans = {};
	let countryMoney = countryInfo[country].money;
	let numUnits = (countryInfo[country].fleets || []).length + (countryInfo[country].armies || []).length;
	let taxChips = (countryInfo[country].taxChips || []).length;
	let factories = await getUnsatFactories(countryInfo, country);
	let points = taxChips + 2 * factories.length;
	points = Math.min(points, 15);
	let money = points - numUnits;
	if (countryMoney + money < 0) {
		money = 0 - countryMoney;
	}
	ans['points'] = Math.max(points - 5, 0);
	let playerMoney = Math.min(Math.max(points - countryInfo[country].lastTax, 0), countryMoney + money);
	ans['money'] = money - playerMoney;
	// avoid this computation if playerInfo was null
	if (playerInfo) {
		ans['tax split'] = getTaxSplit(playerMoney, countryInfo, playerInfo, country);
	}
	return ans;
}

// fix to remove used stock
async function getStockBelow(price, countryInfo, context) {
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let stockCosts = await database.ref(setup + '/stockCosts').once('value');
	stockCosts = stockCosts.val();
	let availStock = countryInfo['availStock'];
	let i = 0;
	if (price < stockCosts[1]) {
		return 0;
	}
	while (stockCosts[i] <= price && i <= stockCosts.length) {
		i += 1;
	}
	while (!availStock.includes(i - 1)) {
		i -= 1;
		if (i === 1) {
			break;
		}
	}
	return i - 1;
}

function computeScore(playerInfo, countryInfos) {
	let score = 0;
	for (let i in playerInfo.stock) {
		let value = Math.floor(countryInfos[playerInfo.stock[i].country].points / 5);
		let amt = playerInfo.stock[i].stock;
		score += value * amt;
	}
	score += playerInfo.money;
	score += playerInfo.scoreModifier;
	return score;
}
function computeCash(playerInfo, countryInfos) {
	let score = 0;
	for (let i in playerInfo.stock) {
		let amt = playerInfo.stock[i].stock;
		score += 2 * amt;
	}
	score += playerInfo.money;
	return score;
}

async function sortStock(stocks, context) {
	let countries = await getCountries(context);
	stocks.sort((a, b) => countries.indexOf(a.country) - countries.indexOf(b.country) || a.stock - b.stock);
}

function getPermSwiss(gameState) {
	let players = Object.keys(gameState.playerInfo);
	for (let key in gameState.countryInfo) {
		if (gameState.countryInfo[key].gov === 'democracy') {
			if (players.includes(gameState.countryInfo[key].leadership[0])) {
				players.splice(players.indexOf(gameState.countryInfo[key].leadership[0]), 1);
			}
			if (players.includes(gameState.countryInfo[key].leadership[1])) {
				players.splice(players.indexOf(gameState.countryInfo[key].leadership[1]), 1);
			}
		}
		if (gameState.countryInfo[key].gov === 'dictatorship') {
			if (players.includes(gameState.countryInfo[key].leadership[0])) {
				players.splice(players.indexOf(gameState.countryInfo[key].leadership[0]), 1);
			}
		}
	}
	return players;
}

async function investorPassed(oldWheel, newWheel, context) {
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let wheel = await database.ref(setup + '/wheel').once('value');
	wheel = wheel.val();
	if (oldWheel === 'center') {
		return newWheel === 'Investor';
	}
	let inv = wheel.indexOf('Investor');
	let o = wheel.indexOf(oldWheel);
	let n = wheel.indexOf(newWheel);

	return (n - o + wheel.length) % wheel.length >= (inv - o + wheel.length) % wheel.length && inv !== o;
}

// add tiebreaks
function getWinner(gameState) {
	let maxScore = 0;
	let player = '';
	for (let key in gameState.playerInfo) {
		let score = computeScore(gameState.playerInfo[key], gameState.countryInfo);
		if (score > maxScore) {
			maxScore = score;
			player = key;
		}
	}
	return player;
}

function stringifyFunctions(d) {
	let newDict = {};
	for (let key in d) {
		if (key.substring(0, 3) === 'set' || key.substring(0, 5) === 'reset') {
			newDict[key] = d[key].toString();
		} else {
			newDict[key] = d[key];
		}
	}
	return newDict;
}

function unstringifyFunctions(d) {
	let newDict = {};
	for (let key in d) {
		if (key.substring(0.3) === 'set' || key.substring(0, 5) === 'reset') {
			newDict[key] = eval('(' + d[key] + ')');
		} else {
			newDict[key] = d[key];
		}
	}
	return newDict;
}

async function getTimer(context) {
	if (!context.game) {
		return {
			timed: false,
			increment: 0,
			pause: 0,
			lastMove: 0,
			banked: {},
		};
	}
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let banked = {};
	for (let key in gameState.playerInfo) {
		banked[key] = gameState.playerInfo[key].banked;
	}
	return {
		timed: gameState.timer.timed,
		increment: gameState.timer.increment,
		pause: gameState.timer.pause,
		lastMove: gameState.timer.lastMove,
		banked: banked,
	};
}

export {
	getCountries,
	getPlayersInOrder,
	getOwnedStock,
	getSat,
	getUnsatFactories,
	getUnsatTerritories,
	getInvestorPayout,
	getTaxSplit,
	getTaxInfo,
	getStockBelow,
	computeScore,
	computeCash,
	sortStock,
	getPermSwiss,
	investorPassed,
	getWinner,
	stringifyFunctions,
	unstringifyFunctions,
	getTimer,
};
