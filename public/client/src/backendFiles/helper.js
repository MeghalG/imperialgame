import { readGameState, readSetup } from './stateCache.js';

/**
 * Retrieves the list of countries for the current game, ordered by their setup order (1-6).
 * Reads the setup configuration from Firebase to determine the country names and their order.
 * The returned array has null entries for missing order positions.
 *
 * Called from: Many components (mapAPI, buyAPI, helper functions) to get the canonical
 * country list in display order.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<(string|null)[]>} Array of 6 elements, each a country name or null,
 *   indexed by (order - 1)
 */
async function getCountries(context) {
	let gameState = await readGameState(context);
	let countries = await readSetup(gameState.setup + '/countries');
	let t = [null, null, null, null, null, null];
	for (let key in countries) {
		t[countries[key].order - 1] = key;
	}
	return t;
}

/**
 * Retrieves the list of players ordered by their turn order (1-based).
 * If any player lacks an order property, falls back to returning all player names
 * in Firebase iteration order (unordered).
 *
 * Called from: StateApp and other components to display players in their proper turn order.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<(string|null)[]>} Array of up to 6 elements, each a player name or null,
 *   indexed by (order - 1). Falls back to an unsorted array of player names.
 */
async function getPlayersInOrder(context) {
	let gameState = await readGameState(context);
	let playerInfo = gameState.playerInfo;
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

/**
 * Computes the total stock denomination sum owned by each player in a country's leadership chain.
 * Iterates through each leader/opposition player and sums their stock holdings for the given country.
 *
 * Called from: getInvestorPayout, getTaxSplit, and other functions that need to know
 * how much stock each leadership member owns.
 *
 * @param {string[]} leadership - Array of player names in leadership order ([leader, opposition])
 * @param {Object<string, PlayerInfo>} playerInfo - Map of player name to PlayerInfo
 * @param {string} country - The country name to sum stock for
 * @returns {Array<[string, number]>} Array of [playerName, totalStockDenomination] pairs,
 *   one per leadership member
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
 * Returns a list of territory names currently occupied (sat on) by hostile armies
 * of OTHER countries. Territories can appear multiple times if multiple hostile armies
 * occupy them (has multiplicity).
 *
 * Called from: getUnsatFactories, getLocationOptions, and getUnsatTerritories to determine
 * which territories are blocked by enemy occupation.
 *
 * @param {Object<string, CountryInfo>} countryInfo - Map of country name to CountryInfo
 * @param {string} country - The country to check occupation against (excluded from occupiers)
 * @returns {string[]} Array of territory names occupied by hostile armies of other countries
 *   (may contain duplicates if multiple armies occupy the same territory)
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
 * Returns the list of factory territories for a country that are NOT currently occupied
 * by hostile enemy armies. Only unsaturated (unoccupied) factories can produce units.
 *
 * Called from: getFleetProduceOptions, getArmyProduceOptions, and getTaxInfo to determine
 * which factories are active/productive.
 *
 * @param {Object<string, CountryInfo>} countryInfo - Map of country name to CountryInfo
 * @param {string} country - The country whose factories to check
 * @returns {string[]} Array of factory territory names that are not occupied by enemies
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
 * Returns the list of home territories for a country that are NOT currently occupied
 * by hostile enemy armies. Optionally filters to only port territories (for fleet imports).
 *
 * Called from: getImportOptions to determine which territories can receive imported units.
 *
 * @param {Object<string, CountryInfo>} countryInfo - Map of country name to CountryInfo
 * @param {string} country - The country whose territories to check
 * @param {boolean} portsOnly - If true, only returns port territories (for fleet imports)
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<string[]>} Array of unoccupied home territory names
 */
async function getUnsatTerritories(countryInfo, country, portsOnly, context) {
	let gameState = await readGameState(context);
	let allTerritories = await readSetup(gameState.setup + '/territories');
	let sat = getSat(countryInfo, country);

	let territories = [];
	for (let t in allTerritories) {
		if (allTerritories[t].country === country && !sat.includes(t) && (!portsOnly || allTerritories[t].port)) {
			territories.push(t);
		}
	}
	return territories;
}

/**
 * Computes the investor payout amounts for each leadership member of a country.
 * Each leader receives an amount equal to their stock denomination total, paid from
 * the country's treasury. If the treasury cannot cover all payouts, the shortfall
 * is deducted from the current player's payout.
 *
 * Called from: proposalAPI.getInvestorMessage and submitAPI when executing investor actions.
 *
 * @param {GameState} gameState - The complete game state
 * @param {string} country - The country whose investor is paying out
 * @param {string} name - The current player's name (absorbs shortfall if treasury is low)
 * @returns {Array<[string, number]>} Array of [playerName, payoutAmount] pairs for each
 *   leadership member
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
 * Distributes tax money among leadership players proportional to their stock ownership
 * using a D'Hondt-like allocation method. The money is divided into $1 units and each
 * unit is assigned to the player with the highest ratio of stock-owned to dollars-received.
 *
 * Called from: getTaxInfo to compute the "greatness" distribution during taxation.
 *
 * @caveat The original author noted: "decimal approximation might be an issue" in the
 *   sorting comparison.
 *
 * @param {number} money - Total money to distribute to players
 * @param {Object<string, CountryInfo>} countryInfo - Map of country name to CountryInfo
 * @param {Object<string, PlayerInfo>} playerInfo - Map of player name to PlayerInfo
 * @param {string} country - The country being taxed
 * @returns {Array<[string, number]>} Array of [playerName, dollarAmount] pairs for each
 *   leadership member who receives money
 */
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

/**
 * Computes the full taxation breakdown for a country: victory points earned, money
 * flowing into/out of the treasury, and the player payout split.
 *
 * Points = min(taxChipCount + 2 * unsatFactoryCount, 15). Treasury money = points - unitCount.
 * If treasury would go negative, money is capped. Player payout ("greatness") is based on
 * the points exceeding the lastTax threshold, capped by available treasury.
 *
 * Called from: proposalAPI.getTaxMessage, mapAPI.getCurrentTax, and submitAPI during taxation execution.
 *
 * @param {Object<string, CountryInfo>} countryInfo - Map of country name to CountryInfo
 * @param {Object<string, PlayerInfo>|null} playerInfo - Map of player name to PlayerInfo,
 *   or null to skip computing the tax split
 * @param {string} country - The country being taxed
 * @returns {Promise<{points: number, money: number, 'tax split'?: Array<[string, number]>}>}
 *   Object with:
 *   - points: Victory points earned (after subtracting 5)
 *   - money: Net money change for the treasury (negative means treasury pays out)
 *   - 'tax split': Player payout distribution (only if playerInfo is not null)
 */
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

/**
 * Finds the highest available stock denomination whose cost does not exceed the given price.
 * Searches the stockCosts array to find the highest cost index <= price, then walks
 * downward to find one that is still in the available stock pool.
 *
 * Called from: turnAPI.getTitle and miscAPI.getStock to determine which stock a bid amount buys.
 *
 * @bug Marked as needing fixes: "fix to remove used stock" -- may return stocks that
 *   are already purchased.
 *
 * @param {number} price - The maximum price (e.g. the player's bid amount)
 * @param {CountryInfo} countryInfo - The country info object (needs availStock field)
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<number>} The stock denomination (index) the price covers, or 0 if none affordable
 */
async function getStockBelow(price, countryInfo, context) {
	let gameState = await readGameState(context);
	let stockCosts = await readSetup(gameState.setup + '/stockCosts');
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

/**
 * Computes a player's total victory score. Score is calculated as:
 * sum(floor(countryPoints / 5) * stockDenomination) for each stock held,
 * plus the player's cash, plus any score modifier (e.g. timer penalties).
 *
 * Called from: getWinner and StateApp to display player scores and determine the winner.
 *
 * @param {PlayerInfo} playerInfo - The player's info object with stock, money, scoreModifier
 * @param {Object<string, CountryInfo>} countryInfos - Map of country name to CountryInfo
 * @returns {number} The player's total victory score
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
 * Computes a player's total cash value (liquid assets). Calculated as:
 * sum(2 * stockDenomination) for each stock held, plus the player's cash.
 * Each stock is valued at $2 per denomination unit regardless of the country's points.
 *
 * Called from: StateApp to display the player's cash value for comparison.
 *
 * @param {PlayerInfo} playerInfo - The player's info object with stock and money
 * @param {Object<string, CountryInfo>} countryInfos - Map of country name to CountryInfo
 *   (currently unused but passed for consistency with computeScore)
 * @returns {number} The player's total cash value
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
 * Sorts an array of stock entries in-place, first by country order (matching the game's
 * canonical country ordering), then by stock denomination ascending within each country.
 *
 * Called from: StateApp and PlayerApp to display a player's stock holdings in a
 * consistent, readable order.
 *
 * @param {StockEntry[]} stocks - Array of stock entries to sort (mutated in place)
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<void>} Sorts in place; no return value
 */
async function sortStock(stocks, context) {
	let countries = await getCountries(context);
	stocks.sort((a, b) => countries.indexOf(a.country) - countries.indexOf(b.country) || a.stock - b.stock);
}

/**
 * Returns the list of players who are eligible for "permanent Swiss banking" -- players
 * who are not in any country's leadership (neither leader nor opposition in democracies,
 * neither leader in dictatorships). These players always get a Swiss banking buy opportunity
 * during investor rounds.
 *
 * Called from: submitAPI during investor card processing to determine who gets Swiss banking.
 *
 * @param {GameState} gameState - The complete game state
 * @returns {string[]} Array of player names not in any country's leadership chain
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
 * Determines whether the rondel movement from oldWheel to newWheel passes through
 * (or lands on) the Investor position. If oldWheel is "center", checks if newWheel
 * IS "Investor". Otherwise, checks if the clockwise distance from old to Investor
 * is less than or equal to the distance from old to new.
 *
 * Called from: submitAPI to determine if an Investor card payout is triggered when
 * a country moves on the rondel.
 *
 * @param {string} oldWheel - The country's previous rondel position (or "center")
 * @param {string} newWheel - The country's new rondel position
 * @param {Object} context - UserContext with { game }
 * @param {string} context.game - The Firebase game ID
 * @returns {Promise<boolean>} True if the Investor position was passed or landed on
 */
async function investorPassed(oldWheel, newWheel, context) {
	let gameState = await readGameState(context);
	let wheel = await readSetup(gameState.setup + '/wheel');
	if (oldWheel === 'center') {
		return newWheel === 'Investor';
	}
	let inv = wheel.indexOf('Investor');
	let o = wheel.indexOf(oldWheel);
	let n = wheel.indexOf(newWheel);

	return (n - o + wheel.length) % wheel.length >= (inv - o + wheel.length) % wheel.length && inv !== o;
}

/**
 * Determines the winning player by finding the one with the highest victory score.
 * Uses computeScore to calculate each player's total score.
 *
 * Tiebreaking: if two players have the same score, the one with higher cash value
 * (computeCash) wins. If still tied, the one with more raw money wins.
 * If all tiebreakers are equal, the first player found wins (iteration order).
 *
 * Called from: turnAPI.getTitle when the game is over to display the winner.
 *
 * @param {GameState} gameState - The complete game state
 * @returns {string} The name of the winning player
 */
function getWinner(gameState) {
	let maxScore = -Infinity;
	let maxCash = -Infinity;
	let maxMoney = -Infinity;
	let player = '';
	for (let key in gameState.playerInfo) {
		let score = computeScore(gameState.playerInfo[key], gameState.countryInfo);
		let cash = computeCash(gameState.playerInfo[key], gameState.countryInfo);
		let money = gameState.playerInfo[key].money;
		if (
			score > maxScore ||
			(score === maxScore && cash > maxCash) ||
			(score === maxScore && cash === maxCash && money > maxMoney)
		) {
			maxScore = score;
			maxCash = cash;
			maxMoney = money;
			player = key;
		}
	}
	return player;
}

/**
 * Converts function values in a dictionary to their string representations for Firebase storage.
 * Only converts keys that start with "set" or "reset" (React state setter functions).
 * Other values are passed through unchanged. This allows game state containing setter
 * functions to be serialized for Firebase.
 *
 * Called from: submitAPI before saving proposal context to Firebase, since Firebase
 * cannot store JavaScript functions.
 *
 * @param {Object} d - Dictionary potentially containing function values
 * @returns {Object} New dictionary with functions converted to strings via .toString()
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
 * Reconverts stringified function values back into executable functions using eval().
 * Only converts keys that start with "set" or "reset" (React state setter functions).
 * Other values are passed through unchanged. This restores game state loaded from Firebase
 * back to a usable form with working setter functions.
 *
 * Called from: submitAPI after loading proposal context from Firebase to restore
 * the setter functions.
 *
 * @caveat Uses eval() to reconstruct functions, which is a security concern if the
 *   stored strings are ever tampered with. The ESLint no-eval warning is suppressed.
 *
 * @param {Object} d - Dictionary with stringified function values
 * @returns {Object} New dictionary with string function representations converted back
 *   to executable functions via eval()
 */
function unstringifyFunctions(d) {
	let newDict = {};
	for (let key in d) {
		if (key.substring(0, 3) === 'set' || key.substring(0, 5) === 'reset') {
			// eslint-disable-next-line no-eval
			newDict[key] = eval('(' + d[key] + ')');
		} else {
			newDict[key] = d[key];
		}
	}
	return newDict;
}

/**
 * Retrieves the timer configuration and banked time for each player.
 * If no game is set in the context, returns a default disabled timer object.
 * Otherwise reads the game state and collects each player's banked time.
 *
 * Called from: GameApp to initialize the chess-clock timer display and track
 * remaining time for each player.
 *
 * @param {Object} context - UserContext with { game }
 * @param {string} [context.game] - The Firebase game ID (may be undefined/null)
 * @returns {Promise<{timed: boolean, increment: number, pause: number, lastMove: number, banked: Object<string, number>}>}
 *   Timer state object with:
 *   - timed: Whether the game uses timed turns
 *   - increment: Seconds added per turn
 *   - pause: Server timestamp when paused (0 = not paused)
 *   - lastMove: Server timestamp of the last move
 *   - banked: Map of player name to banked seconds remaining
 */
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
	let gameState = await readGameState(context);
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
