/**
 * helper.js — CommonJS version of pure helper functions for Cloud Functions.
 *
 * Contains ONLY pure functions (no Firebase I/O) from the client-side helper.js.
 * Firebase-dependent functions (getCountries, getPlayersInOrder, sortStock,
 * investorPassed, getStockBelow, getUnsatTerritories, getTimer) are excluded.
 *
 * @module functions/shared/helper
 */

/**
 * Computes the total stock denomination sum owned by each player in a country's
 * leadership chain.
 *
 * @param {string[]} leadership - Array of player names in leadership order
 * @param {Object} playerInfo - Map of player name to PlayerInfo
 * @param {string} country - The country name to sum stock for
 * @returns {Array<[string, number]>} Array of [playerName, totalStockDenom] pairs
 */
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

/**
 * Returns territory names occupied by hostile armies of OTHER countries.
 *
 * @param {Object} countryInfo - Map of country name to CountryInfo
 * @param {string} country - The country to check against (excluded from occupiers)
 * @returns {string[]} Array of occupied territory names (may contain duplicates)
 */
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

/**
 * Returns factory territories for a country NOT occupied by hostile enemies.
 *
 * @param {Object} countryInfo - Map of country name to CountryInfo
 * @param {string} country - The country whose factories to check
 * @returns {string[]} Unoccupied factory territory names
 */
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

/**
 * Computes investor payout amounts for each leadership member of a country.
 *
 * @param {Object} gameState - The complete game state
 * @param {string} country - The country whose investor is paying out
 * @param {string} name - Current player's name (absorbs shortfall)
 * @returns {Array<[string, number]>} Array of [playerName, payoutAmount] pairs
 */
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

/**
 * Distributes tax money among leadership players proportional to stock ownership
 * using a D'Hondt-like allocation method.
 *
 * @param {number} money - Total money to distribute
 * @param {Object} countryInfo - Map of country name to CountryInfo
 * @param {Object} playerInfo - Map of player name to PlayerInfo
 * @param {string} country - The country being taxed
 * @returns {Array<[string, number]>} Array of [playerName, dollarAmount] pairs
 */
function getTaxSplit(money, countryInfo, playerInfo, country) {
	let leadership = countryInfo[country].leadership;
	let stockOwned = getOwnedStock(leadership, playerInfo, country);
	let arr = [];
	for (let i in stockOwned) {
		for (let j = 0; j < money; j++) {
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

/**
 * Computes full taxation breakdown for a country.
 *
 * NOTE: The client-side version is async because it awaits getUnsatFactories,
 * but getUnsatFactories is actually synchronous. This server version is also
 * synchronous. Callers that `await` it will still work fine.
 *
 * @param {Object} countryInfo - Map of country name to CountryInfo
 * @param {Object|null} playerInfo - Map of player name to PlayerInfo, or null
 * @param {string} country - The country being taxed
 * @returns {{points: number, money: number, 'tax split'?: Array}} Tax breakdown
 */
function getTaxInfo(countryInfo, playerInfo, country) {
	let ans = {};
	let countryMoney = countryInfo[country].money;
	let numUnits = (countryInfo[country].fleets || []).length + (countryInfo[country].armies || []).length;
	let taxChips = (countryInfo[country].taxChips || []).length;
	let factories = getUnsatFactories(countryInfo, country);
	let points = taxChips + 2 * factories.length;
	points = Math.min(points, 15);
	let money = points - numUnits;
	if (countryMoney + money < 0) {
		money = 0 - countryMoney;
	}
	ans['points'] = Math.max(points - 5, 0);
	let playerMoney = Math.min(Math.max(points - countryInfo[country].lastTax, 0), countryMoney + money);
	ans['money'] = money - playerMoney;
	if (playerInfo) {
		ans['tax split'] = getTaxSplit(playerMoney, countryInfo, playerInfo, country);
	}
	return ans;
}

/**
 * Computes a player's total victory score.
 *
 * @param {Object} playerInfo - Player's info object with stock, money, scoreModifier
 * @param {Object} countryInfos - Map of country name to CountryInfo
 * @returns {number} Total victory score
 */
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

/**
 * Computes a player's total cash value (liquid assets).
 *
 * @param {Object} playerInfo - Player's info object with stock and money
 * @param {Object} countryInfos - Map of country name to CountryInfo (unused)
 * @returns {number} Total cash value
 */
function computeCash(playerInfo, countryInfos) {
	let score = 0;
	for (let i in playerInfo.stock) {
		let amt = playerInfo.stock[i].stock;
		score += 2 * amt;
	}
	score += playerInfo.money;
	return score;
}

/**
 * Sorts stock entries in-place by country order, then by denomination.
 * Pure version that takes the countries array directly (no Firebase).
 *
 * @param {Array} stocks - Array of stock entries to sort (mutated in place)
 * @param {string[]} countries - Ordered array of country names
 */
function sortStock(stocks, countries) {
	stocks.sort((a, b) => countries.indexOf(a.country) - countries.indexOf(b.country) || a.stock - b.stock);
}

/**
 * Returns players eligible for "permanent Swiss banking" — players not in
 * any country's leadership.
 *
 * @param {Object} gameState - The complete game state
 * @returns {string[]} Player names not in any leadership chain
 */
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

/**
 * Determines the winning player (highest victory score with tiebreakers).
 *
 * @param {Object} gameState - The complete game state
 * @returns {string} The winning player's name
 */
function getWinner(gameState) {
	let maxScore = -Infinity;
	let tiedPlayers = [];
	for (let key in gameState.playerInfo) {
		let score = computeScore(gameState.playerInfo[key], gameState.countryInfo);
		if (score > maxScore) {
			maxScore = score;
			tiedPlayers = [key];
		} else if (score === maxScore) {
			tiedPlayers.push(key);
		}
	}
	if (tiedPlayers.length <= 1) return tiedPlayers[0] || '';

	let maxPoints = -Infinity;
	for (let country in gameState.countryInfo) {
		if (gameState.countryInfo[country].points > maxPoints) {
			maxPoints = gameState.countryInfo[country].points;
		}
	}
	let topNations = [];
	for (let country in gameState.countryInfo) {
		if (gameState.countryInfo[country].points === maxPoints) {
			topNations.push(country);
		}
	}
	let bestInvestment = -Infinity;
	let investmentTied = [];
	for (let player of tiedPlayers) {
		let investment = 0;
		for (let s of gameState.playerInfo[player].stock || []) {
			if (topNations.includes(s.country)) {
				investment += s.stock;
			}
		}
		if (investment > bestInvestment) {
			bestInvestment = investment;
			investmentTied = [player];
		} else if (investment === bestInvestment) {
			investmentTied.push(player);
		}
	}
	if (investmentTied.length === 1) return investmentTied[0];

	let bestMoney = -Infinity;
	let winner = investmentTied[0];
	for (let player of investmentTied) {
		if (gameState.playerInfo[player].money > bestMoney) {
			bestMoney = gameState.playerInfo[player].money;
			winner = player;
		}
	}
	return winner;
}

/**
 * Converts function values in a dictionary to their string representations.
 *
 * @param {Object} d - Dictionary potentially containing function values
 * @returns {Object} New dictionary with functions converted to strings
 */
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

/**
 * Reconverts stringified function values back into no-op function stubs.
 *
 * @param {Object} d - Dictionary with stringified function values
 * @returns {Object} New dictionary with no-op function stubs
 */
function unstringifyFunctions(d) {
	let newDict = {};
	for (let key in d) {
		if (key.substring(0, 3) === 'set' || key.substring(0, 5) === 'reset') {
			newDict[key] = function () {};
		} else {
			newDict[key] = d[key];
		}
	}
	return newDict;
}

module.exports = {
	getOwnedStock,
	getSat,
	getUnsatFactories,
	getInvestorPayout,
	getTaxSplit,
	getTaxInfo,
	computeScore,
	computeCash,
	sortStock,
	getPermSwiss,
	getWinner,
	stringifyFunctions,
	unstringifyFunctions,
};
