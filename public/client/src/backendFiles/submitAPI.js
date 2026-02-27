import { database } from './firebase.js';
import * as helper from './helper.js';
import emailjs from 'emailjs-com';
import {
	MODES,
	WHEEL_ACTIONS,
	GOV_TYPES,
	MANEUVER_ACTIONS,
	WIN_POINTS,
	FACTORY_COST,
	INVESTOR_BONUS,
	FREE_RONDEL_STEPS,
	RONDEL_STEP_COST,
	PUNT_BUY,
	WHEEL_CENTER,
} from '../gameConstants.js';

/**
 * Persists the updated game state to Firebase, sends email notifications,
 * handles timer adjustments, and archives the previous state to game histories.
 *
 * This is the final step of every turn submission. It:
 * 1. Rounds all money values to 2 decimal places
 * 2. Sends email notifications to players whose myTurn is now true
 * 3. Adjusts chess-clock timer (banked time, increment) for the player(s) who just moved
 * 4. Saves the OLD state as a history snapshot (for undo)
 * 5. Writes the NEW state to Firebase and increments turnID
 *
 * Called at the end of: submitBuy, submitVote, submitNoCounter, submitProposal, bidBuy, bid.
 *
 * @param {GameState} gameState - The modified game state to persist
 * @param {string} gameID - The Firebase game ID
 * @param {Object} context - UserContext with at least { name, game }
 *
 * @bug Empty error handler on the `.set()` callback silently swallows write failures.
 */
async function finalizeSubmit(gameState, gameID, context) {
	let oldState = await database.ref('games/' + gameID).once('value');
	oldState = oldState.val();
	for (let player in gameState.playerInfo) {
		gameState.playerInfo[player].money = parseFloat(gameState.playerInfo[player].money.toFixed(2));
	}
	for (let country in gameState.countryInfo) {
		gameState.countryInfo[country].money = parseFloat(gameState.countryInfo[country].money.toFixed(2));
	}
	emailjs.init(process.env.REACT_APP_EMAILJS_USER_ID);
	for (let key in gameState.playerInfo) {
		if (gameState.playerInfo[key].email && gameState.playerInfo[key].myTurn) {
			emailjs.send(process.env.REACT_APP_EMAILJS_SERVICE_ID, process.env.REACT_APP_EMAILJS_TEMPLATE_ID, {
				to_name: key,
				to_email: gameState.playerInfo[key].email,
			});
		}
	}
	// timer stuff
	let timer = gameState.timer;
	if (timer.timed) {
		let time = 0;
		let offset = await database.ref('/.info/serverTimeOffset').once('value');
		let offsetVal = offset.val() || 0;
		time = Date.now() + offsetVal;
		if (!gameState.sameTurn) {
			for (let key in oldState.playerInfo) {
				if (oldState.playerInfo[key].myTurn) {
					await adjustTime(key, gameState, time);
				}
			}
			timer.lastMove = time;
		} else {
			await adjustTime(context.name, gameState, time);
		}
		timer.pause = 0;
	}
	await database.ref('game histories/' + gameID + '/' + oldState.turnID).set(oldState);
	await database.ref('games/' + gameID).set(gameState, async (error) => {
		if (error) {
			console.error('Firebase write failed in finalizeSubmit:', error);
		} else {
			await database.ref('games/' + gameID + '/turnID').set(gameState.turnID + 1);
		}
	});
}

/**
 * Adjusts a player's banked time after their turn ends (chess-clock style).
 *
 * Calculates remaining time = bankedTime - elapsed + increment.
 * If negative, the player loses 1 point (scoreModifier -= 1) and banked resets to 60s.
 * Otherwise, banked time is updated but never increases beyond its previous value.
 *
 * @param {string} player - Player name whose time to adjust
 * @param {GameState} gameState - Game state (mutated in place)
 * @param {number} t - Current server timestamp in milliseconds
 */
async function adjustTime(player, gameState, t) {
	let time = gameState.timer.pause;
	if (time === 0) {
		time = t;
	}
	let ti =
		gameState.playerInfo[player].banked * 1000 - time + gameState.timer.increment * 1000 + gameState.timer.lastMove;
	if (ti < 0) {
		gameState.playerInfo[player].scoreModifier -= 1;
		gameState.playerInfo[player].banked = 60;
	} else {
		gameState.playerInfo[player].banked = Math.min(
			Math.floor(gameState.playerInfo[player].banked - time / 1000 + gameState.timer.lastMove / 1000) +
				gameState.timer.increment,
			gameState.playerInfo[player].banked
		);
	}
}

/**
 * Advances the game to the next country's turn on the country rotation.
 *
 * Sets countryUp to the next country, increments round if wrapping around,
 * sets mode to PROPOSAL, and makes the new country's leader the active player.
 * If the next country has no leadership (no stock owned), recursively skips it.
 *
 * Called after: a proposal executes (without passing investor), or after buy round ends.
 *
 * @param {GameState} gameState - Game state (mutated in place)
 * @param {Object} context - UserContext with { game } for looking up country order
 */
async function incrementCountry(gameState, context) {
	let country = gameState.countryUp;
	let countries = await helper.getCountries(context);
	let index = countries.indexOf(country);
	// country
	let newCountry = countries[(index + 1) % countries.length];
	let leadership = gameState.countryInfo[newCountry].leadership;
	gameState.countryUp = newCountry;
	// round
	if (index === countries.length - 1) {
		gameState.round += 1;
	}
	// player (remember that current player already set to false)
	let playerUp = '';
	if (leadership) {
		playerUp = leadership[0];
	}
	if (playerUp === '') {
		await incrementCountry(gameState, context);
		return;
	}
	for (let key in gameState.playerInfo) {
		gameState.playerInfo[key].myTurn = false;
	}
	gameState.playerInfo[leadership[0]].myTurn = true;
	gameState.mode = MODES.PROPOSAL;
}

/**
 * Executes a stock purchase: adds stock to player's portfolio, removes from
 * country's available stock, transfers money from player to country treasury.
 *
 * @param {GameState} gameState - Game state (mutated in place)
 * @param {string} player - Player name buying the stock
 * @param {StockEntry} stock - { country, stock } identifying the stock to buy
 * @param {number} price - Purchase price (from stockCosts lookup)
 * @param {Object} context - UserContext (passed to sortStock for country ordering)
 *
 * @bug If availStock doesn't contain stock.stock, indexOf returns -1 and
 *      splice(-1, 1) removes the last element instead of failing gracefully.
 */
function buyStock(gameState, player, stock, price, context) {
	if (!gameState.playerInfo[player].stock) {
		gameState.playerInfo[player].stock = [];
	}
	gameState.playerInfo[player].stock.push(stock);
	let availStock = gameState.countryInfo[stock.country].availStock;
	let idx = availStock.indexOf(stock.stock);
	if (idx !== -1) {
		availStock.splice(idx, 1);
	}
	gameState.playerInfo[player].money -= price;
	gameState.countryInfo[stock.country].money += price;
	helper.sortStock(gameState.playerInfo[player].stock, context);
}

/**
 * Returns a stock from a player's portfolio back to the country's available pool.
 * Reverse of buyStock: removes from owned, adds back to availStock, refunds money.
 *
 * If stock.stock is 0 (the "no return" sentinel), does nothing except remove the
 * matching entry from the player's stock array.
 *
 * @param {GameState} gameState - Game state (mutated in place)
 * @param {string} player - Player name returning the stock
 * @param {StockEntry} stock - { country, stock } identifying the stock to return
 * @param {number} price - Refund price (from stockCosts lookup)
 */
function returnStock(gameState, player, stock, price) {
	let owned = gameState.playerInfo[player].stock;
	for (let i in owned) {
		if (owned[i].country === stock.country && owned[i].stock === stock.stock) {
			owned.splice(i, 1);
		}
	}
	if (stock.stock !== 0) {
		let availStock = gameState.countryInfo[stock.country].availStock;
		availStock.push(stock.stock);
		availStock.sort();
		gameState.playerInfo[player].money += price;
		gameState.countryInfo[stock.country].money -= price;
	}
}

/**
 * Recalculates leadership and government type for a country after a stock transaction.
 *
 * Adds the player to the leadership array if not already present, then sorts all
 * leaders by total stock denomination owned (descending). If the top stockholder
 * owns >= 50% of all stock, government becomes dictatorship; otherwise democracy.
 *
 * Called after: buyStock (in submitBuy and bidBuy).
 *
 * @param {GameState} gameState - Game state (mutated in place)
 * @param {string} country - Country name to recalculate
 * @param {string} player - Player who just bought stock (ensures they're in leadership)
 */
function changeLeadership(gameState, country, player) {
	let stockOwned = [];
	let leadership = gameState.countryInfo[country].leadership;
	if (!leadership) {
		leadership = [];
	}
	let total = 0;
	if (!leadership.includes(player)) {
		leadership.push(player);
	}
	for (let i in leadership) {
		let t = [leadership[i], 0];
		for (let j in gameState.playerInfo[leadership[i]].stock) {
			if (gameState.playerInfo[leadership[i]]['stock'][j]['country'] === country) {
				t[1] += gameState.playerInfo[leadership[i]]['stock'][j]['stock'];
				total += gameState.playerInfo[leadership[i]]['stock'][j]['stock'];
			}
		}
		stockOwned.push(t);
	}
	stockOwned.sort((a, b) => b[1] - a[1]);
	gameState.countryInfo[country].leadership = stockOwned.map((x) => x[0]);
	if (2 * stockOwned[0][1] >= total) {
		gameState.countryInfo[country].gov = GOV_TYPES.DICTATORSHIP;
	} else {
		gameState.countryInfo[country].gov = GOV_TYPES.DEMOCRACY;
	}
}

/**
 * Submits a stock buy during the Investor round (mode === BUY).
 *
 * The active player either buys a stock (optionally returning one) or "Punt Buy"s
 * (adds themselves to the swiss banking set for a later buy opportunity).
 *
 * After buying:
 * 1. Marks the country as offLimits (can't buy same country twice in one round)
 * 2. Recalculates leadership for that country
 * 3. Looks for the next swiss banking player to buy
 * 4. If no more buyers: moves investor card to next player, activates swiss banking
 *    players, resets offLimits, and advances to the next country (proposal mode)
 *
 * Called from: BuyApp component when player submits their buy action.
 *
 * @param {Object} context - UserContext with { game, name, buyCountry, buyStock, returnStock }
 * @returns {Promise<string>} 'done' on success
 */
async function submitBuy(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	gameState.sameTurn = false;
	if (context.buyCountry === PUNT_BUY) {
		if (!gameState.swissSet) {
			gameState.swissSet = [];
		}
		gameState.swissSet.push(context.name);
	} else {
		let costs = await database.ref(setup + '/stockCosts').once('value');
		costs = costs.val();
		let price = costs[context.buyStock];
		if (!context.returnStock || context.returnStock === 'None') {
			context.returnStock = 0;
		}
		let returnPrice = costs[context.returnStock];
		// buy and return stock
		buyStock(gameState, context.name, { country: context.buyCountry, stock: context.buyStock }, price, context);
		returnStock(gameState, context.name, { country: context.buyCountry, stock: context.returnStock }, returnPrice);

		// off limit the country
		gameState.countryInfo[context.buyCountry].offLimits = true;
		// change leadership
		changeLeadership(gameState, context.buyCountry, context.name);
	}
	// not their turn
	gameState.playerInfo[context.name].myTurn = false;
	// looks for another swiss buy
	gameState.playerInfo[context.name].swiss = false;
	let lastBuy = true;
	let players = await helper.getPlayersInOrder(context);
	for (let i = 0; i < Object.keys(gameState.playerInfo).length - 1; i++) {
		let index =
			(players.indexOf(context.name) - 1 - i + Object.keys(gameState.playerInfo).length) %
			Object.keys(gameState.playerInfo).length;
		if (gameState.playerInfo[players[index]].swiss) {
			gameState.playerInfo[players[index]].myTurn = true;
			lastBuy = false;
			break;
		}
	}

	if (lastBuy) {
		// move investor card
		let numPlayers = Object.keys(gameState.playerInfo).length;
		let investor = '';
		for (let key in gameState.playerInfo) {
			if (gameState.playerInfo[key].investor) {
				investor = key;
			}
		}
		let order = gameState.playerInfo[investor].order;
		gameState.playerInfo[investor].investor = false;
		for (let key in gameState.playerInfo) {
			if (gameState.playerInfo[key].order % numPlayers === (order + 1) % numPlayers) {
				gameState.playerInfo[key].investor = true;
			}
		}
		// swiss list -> actual swiss
		let swissSet = gameState.swissSet || [];
		let permSwiss = helper.getPermSwiss(gameState) || [];
		for (let player of swissSet) {
			gameState.playerInfo[player].swiss = true;
		}
		for (let player of permSwiss) {
			gameState.playerInfo[player].swiss = true;
		}
		// reset offLimits
		for (let key in gameState.countryInfo) {
			gameState.countryInfo[key].offLimits = false;
		}
		// reset swissSet
		gameState.swissSet = null;
		// increment country
		await incrementCountry(gameState, context);
	}
	// add to history
	if (!gameState.history) {
		gameState.history = [];
	}
	// can be modified later so certain actions don't change turnID
	gameState.history.push(
		context.name +
			' bought the ' +
			context.buyCountry +
			' ' +
			context.buyStock +
			' returning the ' +
			context.buyCountry +
			' ' +
			context.returnStock +
			'.'
	);
	gameState.undo = context.name;
	await finalizeSubmit(gameState, context.game, context);
	return 'done';
}

/**
 * Submits a player's vote on the leader vs opposition proposal (mode === VOTE).
 *
 * Adds the voter's stock-weighted vote to the chosen proposal. If a proposal
 * exceeds the threshold (> 50% of total stock + tiebreak), that proposal is
 * executed immediately via executeProposal(), voting state is cleared, and the
 * game moves on. The leader gets a +0.1 bonus on their vote for tiebreaking.
 *
 * Called from: VoteApp component when player casts their vote.
 *
 * @param {Object} context - UserContext with { game, name, vote } where vote is 1 or 2
 * @returns {Promise<string>} 'done' on success
 */
async function submitVote(context) {
	let proposal = null;
	if (context.vote === 1) {
		proposal = 'proposal 1';
	} else {
		proposal = 'proposal 2';
	}
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	gameState.sameTurn = false;
	let country = gameState.voting.country;
	if (!gameState.voting['proposal 1'].voters) {
		gameState.voting['proposal 1'].voters = [];
	}
	if (!gameState.voting['proposal 2'].voters) {
		gameState.voting['proposal 2'].voters = [];
	}

	gameState.sameTurn = true;

	// not my turn
	gameState.playerInfo[context.name].myTurn = false;

	// calculate threshold
	let stock = helper.getOwnedStock(gameState.countryInfo[country].leadership, gameState.playerInfo, country);
	let total = 0;
	for (let i in stock) {
		if (stock[i][0] === context.name) {
			gameState.voting[proposal].votes += stock[i][1];
			gameState.voting[proposal].voters.push(context.name);
			if (i === 0) {
				gameState.voting[proposal].votes += 0.1;
			}
		}
		total += stock[i][1];
	}
	let threshold = (total + 0.01) / 2.0;

	if (gameState.voting[proposal].votes > threshold) {
		gameState.history.push(
			context.name +
				' has voted. ' +
				gameState.voting['proposal 1'].voters.join(', ') +
				" voted for the leader's proposal and " +
				gameState.voting['proposal 2'].voters.join(', ') +
				' voted against.'
		);
		let propContext = helper.unstringifyFunctions(gameState[proposal]);
		await executeProposal(gameState, propContext);
		gameState.sameTurn = false;
		gameState.voting = null;
	} else {
		// change turn
		// add to history
		gameState.history.push(context.name + ' has voted.');
	}

	gameState.undo = context.name;
	await finalizeSubmit(gameState, context.game, context);
	return 'done';
}

/**
 * Opposition agrees with the leader's proposal (no counter-proposal).
 *
 * Skips the vote phase entirely and executes the leader's proposal directly.
 * Used when the opposition player clicks "Agree" instead of making a counter-proposal.
 *
 * Called from: ProposalAppOpp component when opposition agrees.
 *
 * @param {Object} context - UserContext with { game, name }
 * @returns {Promise<string>} 'done' on success
 */
async function submitNoCounter(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	gameState.sameTurn = false;
	let country = gameState.countryUp;

	gameState.history.push(context.name + " agreed with the leader's proposal for " + country + '.');
	let propContext = helper.unstringifyFunctions(gameState['proposal 1']);
	await executeProposal(gameState, propContext);

	gameState.undo = context.name;
	await finalizeSubmit(gameState, context.game, context);

	return 'done';
}

/**
 * Initializes step-by-step maneuver mode. Called from submitProposal when
 * the selected wheel action is L/R-Maneuver.
 *
 * Sets up currentManeuver with pending fleet/army lists, charges the wheel
 * spin cost, and switches mode to CONTINUE_MAN.
 *
 * @param {GameState} gameState - Game state (mutated in place)
 * @param {Object} context - UserContext with { name, game, wheelSpot }
 */
async function enterManeuver(gameState, context) {
	let country = gameState.countryUp;
	let fleets = gameState.countryInfo[country].fleets || [];
	let armies = gameState.countryInfo[country].armies || [];

	// Determine return mode and proposal slot
	let gov = gameState.countryInfo[country].gov;
	let returnMode, proposalSlot;
	if (gov === GOV_TYPES.DICTATORSHIP) {
		returnMode = 'execute';
		proposalSlot = 0;
	} else if (gameState.mode === MODES.PROPOSAL) {
		returnMode = MODES.PROPOSAL_OPP;
		proposalSlot = 1;
	} else {
		returnMode = MODES.VOTE;
		proposalSlot = 2;
	}

	// Set up currentManeuver
	gameState.currentManeuver = {
		country: country,
		player: context.name,
		wheelSpot: context.wheelSpot,
		phase: fleets.length > 0 ? 'fleet' : 'army',
		unitIndex: 0,
		pendingFleets: JSON.parse(JSON.stringify(fleets)),
		pendingArmies: JSON.parse(JSON.stringify(armies)),
		completedFleetMoves: [],
		completedArmyMoves: [],
		returnMode: returnMode,
		proposalSlot: proposalSlot,
		pendingPeace: null,
	};

	// If no units at all, skip directly to completion
	if (fleets.length === 0 && armies.length === 0) {
		await completeManeuver(gameState, context);
		return;
	}

	gameState.mode = MODES.CONTINUE_MAN;
	for (let key in gameState.playerInfo) {
		gameState.playerInfo[key].myTurn = false;
	}
	gameState.playerInfo[context.name].myTurn = true;
}

/**
 * Completes the step-by-step maneuver after all units have been moved.
 * Assembles full fleetMan/armyMan arrays and either executes immediately
 * (dictatorship) or stores as a proposal (democracy).
 *
 * @param {GameState} gameState - Game state (mutated in place)
 * @param {Object} context - UserContext with { name, game }
 */
async function completeManeuver(gameState, context) {
	let cm = gameState.currentManeuver;
	let fullContext = {
		name: cm.player,
		game: context.game,
		wheelSpot: cm.wheelSpot,
		fleetMan: cm.completedFleetMoves || [],
		armyMan: cm.completedArmyMoves || [],
	};

	if (cm.returnMode === 'execute') {
		// Dictatorship: execute immediately
		await executeProposal(gameState, fullContext);
	} else if (cm.returnMode === MODES.PROPOSAL_OPP) {
		// Democracy leader: store as proposal 1
		let history = await makeHistory(gameState, fullContext);
		gameState.history.push(cm.player + ' proposes as the leader: ' + history);
		gameState['proposal 1'] = helper.stringifyFunctions(fullContext);
		gameState.mode = MODES.PROPOSAL_OPP;
		let country = cm.country;
		let opposition = gameState.countryInfo[country].leadership[1];
		for (let key in gameState.playerInfo) {
			gameState.playerInfo[key].myTurn = false;
		}
		gameState.playerInfo[opposition].myTurn = true;
	} else if (cm.returnMode === MODES.VOTE) {
		// Democracy opposition: store as proposal 2
		let history = await makeHistory(gameState, fullContext);
		gameState.history.push(cm.player + ' proposes as the opposition: ' + history);
		gameState['proposal 2'] = helper.stringifyFunctions(fullContext);
		let country = cm.country;
		let leadership = gameState.countryInfo[country].leadership;
		for (let player of leadership) {
			gameState.playerInfo[player].myTurn = true;
		}
		gameState.mode = MODES.VOTE;
		let l = gameState.history.length;
		gameState.voting = {
			country: country,
			'proposal 1': {
				proposal: gameState.history[l - 2],
				votes: 0,
				voters: [],
			},
			'proposal 2': {
				proposal: gameState.history[l - 1],
				votes: 0,
				voters: [],
			},
		};
	}
	gameState.currentManeuver = null;
}

/**
 * Submits one unit's movement in the step-by-step maneuver flow.
 * Processes the current unit's destination and action, handles peace
 * offer detection, and advances to the next unit or completes the maneuver.
 *
 * @param {Object} context - UserContext with { game, name, maneuverDest, maneuverAction }
 * @returns {Promise<string>} 'done' on success
 */
async function submitManeuver(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let cm = gameState.currentManeuver;
	if (!cm) return 'done';

	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let territorySetup = await database.ref(setup + '/territories').once('value');
	territorySetup = territorySetup.val();

	gameState.sameTurn = true;

	// Get current unit info
	let phase = cm.phase;
	let unitIndex = cm.unitIndex;
	let pendingUnits = phase === 'fleet' ? cm.pendingFleets : cm.pendingArmies;
	let currentUnit = pendingUnits[unitIndex];
	let origin = currentUnit.territory;
	let dest = context.maneuverDest;
	let action = context.maneuverAction || '';

	// Build ManeuverTuple
	let tuple = [origin, dest, action];

	// Check if this is a peace offer to foreign territory
	let split = action.split(' ');
	if (split[0] === MANEUVER_ACTIONS.PEACE && dest !== origin) {
		let destCountry = territorySetup[dest].country;
		// Peace is only meaningful when entering another country's territory
		if (destCountry && destCountry !== cm.country) {
			let targetGov = gameState.countryInfo[destCountry].gov;
			if (targetGov === GOV_TYPES.DICTATORSHIP) {
				// Dictatorship: dictator decides
				let dictator = gameState.countryInfo[destCountry].leadership[0];
				cm.pendingPeace = {
					origin: origin,
					destination: dest,
					targetCountry: destCountry,
					unitType: phase,
					tuple: tuple,
				};
				for (let key in gameState.playerInfo) {
					gameState.playerInfo[key].myTurn = false;
				}
				gameState.playerInfo[dictator].myTurn = true;
				// Stay in continue-man mode; the dictator sees accept/reject
				gameState.undo = context.name;
				await finalizeSubmit(gameState, context.game, context);
				return 'done';
			} else {
				// Democracy: all stockholders of target country vote
				let leadership = gameState.countryInfo[destCountry].leadership;
				let totalStock = 0;
				for (let player of leadership) {
					for (let s of gameState.playerInfo[player].stock || []) {
						if (s.country === destCountry) {
							totalStock += s.stock;
						}
					}
				}
				gameState.peaceVote = {
					movingCountry: cm.country,
					targetCountry: destCountry,
					unitType: phase,
					origin: origin,
					destination: dest,
					acceptVotes: 0,
					rejectVotes: 0,
					voters: [],
					totalStock: totalStock,
					tuple: tuple,
				};
				gameState.mode = MODES.PEACE_VOTE;
				for (let key in gameState.playerInfo) {
					gameState.playerInfo[key].myTurn = false;
				}
				// Exclude players from the proposing country's leadership
				for (let player of leadership) {
					// Only target country stockholders vote, not the proposing player
					// (though the proposing player might own stock in the target country,
					// they are the one making the peace offer so they don't vote)
					if (player !== cm.player) {
						gameState.playerInfo[player].myTurn = true;
					}
				}
				gameState.undo = context.name;
				await finalizeSubmit(gameState, context.game, context);
				return 'done';
			}
		}
	}

	// Normal move (not a peace offer to foreign territory): add tuple and advance
	if (phase === 'fleet') {
		if (!cm.completedFleetMoves) cm.completedFleetMoves = [];
		cm.completedFleetMoves.push(tuple);
	} else {
		if (!cm.completedArmyMoves) cm.completedArmyMoves = [];
		cm.completedArmyMoves.push(tuple);
	}
	cm.unitIndex++;

	// Check phase transition
	if (phase === 'fleet' && cm.unitIndex >= (cm.pendingFleets || []).length) {
		cm.phase = 'army';
		cm.unitIndex = 0;
	}

	// Check completion
	if (cm.phase === 'army' && cm.unitIndex >= (cm.pendingArmies || []).length) {
		await completeManeuver(gameState, context);
		gameState.sameTurn = false;
		gameState.undo = context.name;
		await finalizeSubmit(gameState, context.game, context);
		return 'done';
	}

	// More units to move — stay in continue-man
	for (let key in gameState.playerInfo) {
		gameState.playerInfo[key].myTurn = false;
	}
	gameState.playerInfo[cm.player].myTurn = true;
	gameState.undo = context.name;
	await finalizeSubmit(gameState, context.game, context);
	return 'done';
}

/**
 * Handles a dictator's accept/reject decision on a peace offer.
 * Called when the target country is a dictatorship and a unit wants to enter peacefully.
 *
 * @param {Object} context - UserContext with { game, name, peaceVoteChoice } where choice is 'accept' or 'reject'
 * @returns {Promise<string>} 'done' on success
 */
async function submitDictatorPeaceVote(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let cm = gameState.currentManeuver;
	if (!cm || !cm.pendingPeace) return 'done';

	gameState.sameTurn = true;

	let peace = cm.pendingPeace;
	let tuple;
	if (context.peaceVoteChoice === 'accept') {
		tuple = [peace.origin, peace.destination, MANEUVER_ACTIONS.PEACE];
		gameState.history.push(
			context.name + ' accepts the peace offer from ' + cm.country + ' at ' + peace.destination + '.'
		);
	} else {
		// Rejected: find an enemy unit at the destination to make it a war
		let targetCountry = peace.targetCountry;
		// Find the first enemy unit at destination
		let virtualFleets = gameState.countryInfo[targetCountry].fleets || [];
		let virtualArmies = gameState.countryInfo[targetCountry].armies || [];
		let foundUnit = null;
		for (let f of virtualFleets) {
			if (f.territory === peace.destination) {
				foundUnit = targetCountry + ' fleet';
				break;
			}
		}
		if (!foundUnit) {
			for (let a of virtualArmies) {
				if (a.territory === peace.destination) {
					foundUnit = targetCountry + ' army';
					break;
				}
			}
		}
		if (foundUnit) {
			tuple = [peace.origin, peace.destination, 'war ' + foundUnit];
		} else {
			// No enemy unit found; treat as hostile entry instead
			tuple = [peace.origin, peace.destination, MANEUVER_ACTIONS.HOSTILE];
		}
		gameState.history.push(
			context.name + ' rejects the peace offer from ' + cm.country + ' at ' + peace.destination + '.'
		);
	}

	// Add the resolved tuple
	if (cm.phase === 'fleet') {
		if (!cm.completedFleetMoves) cm.completedFleetMoves = [];
		cm.completedFleetMoves.push(tuple);
	} else {
		if (!cm.completedArmyMoves) cm.completedArmyMoves = [];
		cm.completedArmyMoves.push(tuple);
	}
	cm.pendingPeace = null;
	cm.unitIndex++;

	// Check phase transition
	if (cm.phase === 'fleet' && cm.unitIndex >= (cm.pendingFleets || []).length) {
		cm.phase = 'army';
		cm.unitIndex = 0;
	}

	// Check completion
	if (cm.phase === 'army' && cm.unitIndex >= (cm.pendingArmies || []).length) {
		await completeManeuver(gameState, context);
		gameState.sameTurn = false;
		gameState.undo = context.name;
		await finalizeSubmit(gameState, context.game, context);
		return 'done';
	}

	// More units to move
	for (let key in gameState.playerInfo) {
		gameState.playerInfo[key].myTurn = false;
	}
	gameState.playerInfo[cm.player].myTurn = true;
	gameState.undo = context.name;
	await finalizeSubmit(gameState, context.game, context);
	return 'done';
}

/**
 * Submits a stockholder's vote on a peace offer (mode === PEACE_VOTE).
 * Target country is a democracy; stockholders vote weighted by stock denomination.
 *
 * @param {Object} context - UserContext with { game, name, peaceVoteChoice } where choice is 'accept' or 'reject'
 * @returns {Promise<string>} 'done' on success
 */
async function submitPeaceVote(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let pv = gameState.peaceVote;
	if (!pv) return 'done';
	let cm = gameState.currentManeuver;
	if (!cm) return 'done';

	gameState.sameTurn = true;
	gameState.playerInfo[context.name].myTurn = false;

	// Calculate voter's stock weight
	let targetCountry = pv.targetCountry;
	let leadership = gameState.countryInfo[targetCountry].leadership;
	let voterWeight = 0;
	for (let s of gameState.playerInfo[context.name].stock || []) {
		if (s.country === targetCountry) {
			voterWeight += s.stock;
		}
	}
	// Leader tiebreak bonus
	if (leadership[0] === context.name) {
		voterWeight += 0.1;
	}

	if (context.peaceVoteChoice === 'accept') {
		pv.acceptVotes += voterWeight;
	} else {
		pv.rejectVotes += voterWeight;
	}
	if (!pv.voters) pv.voters = [];
	pv.voters.push(context.name);

	let threshold = (pv.totalStock + 0.01) / 2.0;

	if (pv.acceptVotes > threshold) {
		// Accepted
		let tuple = [pv.origin, pv.destination, MANEUVER_ACTIONS.PEACE];
		if (cm.phase === 'fleet') {
			if (!cm.completedFleetMoves) cm.completedFleetMoves = [];
			cm.completedFleetMoves.push(tuple);
		} else {
			if (!cm.completedArmyMoves) cm.completedArmyMoves = [];
			cm.completedArmyMoves.push(tuple);
		}
		gameState.history.push(
			pv.targetCountry + ' stockholders accept the peace offer from ' + pv.movingCountry + ' at ' + pv.destination + '.'
		);
		gameState.peaceVote = null;
		cm.unitIndex++;

		// Check phase transition
		if (cm.phase === 'fleet' && cm.unitIndex >= (cm.pendingFleets || []).length) {
			cm.phase = 'army';
			cm.unitIndex = 0;
		}

		// Check completion
		if (cm.phase === 'army' && cm.unitIndex >= (cm.pendingArmies || []).length) {
			await completeManeuver(gameState, context);
			gameState.sameTurn = false;
			gameState.undo = context.name;
			await finalizeSubmit(gameState, context.game, context);
			return 'done';
		}

		// Return to continue-man
		gameState.mode = MODES.CONTINUE_MAN;
		for (let key in gameState.playerInfo) {
			gameState.playerInfo[key].myTurn = false;
		}
		gameState.playerInfo[cm.player].myTurn = true;
	} else if (pv.rejectVotes > threshold) {
		// Rejected — becomes war
		let foundUnit = null;
		let virtualFleets = gameState.countryInfo[targetCountry].fleets || [];
		let virtualArmies = gameState.countryInfo[targetCountry].armies || [];
		for (let f of virtualFleets) {
			if (f.territory === pv.destination) {
				foundUnit = targetCountry + ' fleet';
				break;
			}
		}
		if (!foundUnit) {
			for (let a of virtualArmies) {
				if (a.territory === pv.destination) {
					foundUnit = targetCountry + ' army';
					break;
				}
			}
		}
		let tuple;
		if (foundUnit) {
			tuple = [pv.origin, pv.destination, 'war ' + foundUnit];
		} else {
			tuple = [pv.origin, pv.destination, MANEUVER_ACTIONS.HOSTILE];
		}

		if (cm.phase === 'fleet') {
			if (!cm.completedFleetMoves) cm.completedFleetMoves = [];
			cm.completedFleetMoves.push(tuple);
		} else {
			if (!cm.completedArmyMoves) cm.completedArmyMoves = [];
			cm.completedArmyMoves.push(tuple);
		}
		gameState.history.push(
			pv.targetCountry + ' stockholders reject the peace offer from ' + pv.movingCountry + ' at ' + pv.destination + '.'
		);
		gameState.peaceVote = null;
		cm.unitIndex++;

		// Check phase transition
		if (cm.phase === 'fleet' && cm.unitIndex >= (cm.pendingFleets || []).length) {
			cm.phase = 'army';
			cm.unitIndex = 0;
		}

		// Check completion
		if (cm.phase === 'army' && cm.unitIndex >= (cm.pendingArmies || []).length) {
			await completeManeuver(gameState, context);
			gameState.sameTurn = false;
			gameState.undo = context.name;
			await finalizeSubmit(gameState, context.game, context);
			return 'done';
		}

		// Return to continue-man
		gameState.mode = MODES.CONTINUE_MAN;
		for (let key in gameState.playerInfo) {
			gameState.playerInfo[key].myTurn = false;
		}
		gameState.playerInfo[cm.player].myTurn = true;
	}
	// Else: more votes needed, stay in peace-vote mode

	gameState.undo = context.name;
	await finalizeSubmit(gameState, context.game, context);
	return 'done';
}

/**
 * Helper for maneuver history strings. Returns ' with ' if the action code
 * is non-empty (war/peace/blow up), or '' for plain moves.
 *
 * @param {string} x - The maneuver action code
 * @returns {string} ' with ' or ''
 */
function w(x) {
	if (x) {
		return ' with ';
	} else {
		return '';
	}
}

/**
 * Builds a human-readable history string describing a wheel action proposal.
 *
 * Generates text like "Austria taxes for 3 points, and $5 into its treasury."
 * or "France L-Maneuvers fleets from X to Y with war Austria fleet."
 *
 * Called from: executeProposal (to record what happened) and submitProposal
 * (to record the proposal before it happens).
 *
 * @param {GameState} gameState - Current game state
 * @param {Object} context - Proposal context with wheelSpot and action-specific fields
 * @returns {Promise<string>} Human-readable description of the action
 */
async function makeHistory(gameState, context) {
	let country = gameState.countryUp;

	switch (context.wheelSpot) {
		case WHEEL_ACTIONS.INVESTOR:
			let amt = helper.getInvestorPayout(gameState, country, context.name);
			let msgs = amt.map((x) => '$' + x[1] + ' to ' + x[0]);
			return country + ' investors, paying ' + msgs.join(', ') + '.';
		case WHEEL_ACTIONS.L_PRODUCE:
		case WHEEL_ACTIONS.R_PRODUCE:
			return (
				country +
				' ' +
				context.wheelSpot +
				's armies in ' +
				(context.armyProduce || []).join(', ') +
				' and fleets in ' +
				(context.fleetProduce || []).join(', ') +
				'.'
			);
		case WHEEL_ACTIONS.TAXATION:
			let taxInfo = await helper.getTaxInfo(gameState.countryInfo, gameState.playerInfo, country);
			let s =
				country +
				' taxes for ' +
				taxInfo.points +
				' points, and $' +
				taxInfo.money +
				' into its treasury. Greatness is distributed ';
			let splits = taxInfo['tax split'].map((x) => '$' + x[1] + ' to ' + x[0]).join(', ');
			if (splits === '') {
				splits = 'to no one';
			}
			s += splits + '.';
			return s;
		case WHEEL_ACTIONS.FACTORY:
			return country + ' builds a factory in ' + context.factoryLoc + '.';
		case WHEEL_ACTIONS.IMPORT:
			let fleets = [];
			let armies = [];
			for (let i in context.import.types) {
				if (context.import.types[i] === 'fleet') {
					fleets.push(context.import.territories[i]);
				}
				if (context.import.types[i] === 'army') {
					armies.push(context.import.territories[i]);
				}
			}
			return country + ' imports fleets in ' + fleets.join(', ') + ' and armies in ' + armies.join(', ') + '.';
		case WHEEL_ACTIONS.L_MANEUVER:
		case WHEEL_ACTIONS.R_MANEUVER:
			let sortedF = [...context.fleetMan].sort((a, b) => b[2].charCodeAt(0) - a[2].charCodeAt(1));
			let f = sortedF.map((x) => x[0] + ' to ' + x[1] + w(x[2]) + x[2]);
			f = f.join(', ');

			let sortedA = [...context.armyMan].sort((a, b) => b[2].charCodeAt(0) - a[2].charCodeAt(1));
			let a = sortedA.map((x) => x[0] + ' to ' + x[1] + w(x[2]) + x[2]);
			a = a.join(', ');
			return country + ' ' + context.wheelSpot + 's fleets from ' + f + '. It moves armies from ' + a + '.';
		default:
			break;
	}
}

/**
 * Executes a wheel action proposal, mutating the game state accordingly.
 *
 * This is the core game engine function (226 lines). Each wheel action is a
 * case in a switch statement that modifies countryInfo/playerInfo:
 *
 * - **Investor**: Pays out money from country treasury to stockholders proportionally.
 * - **L-Produce / R-Produce**: Creates new fleet/army units at unsaturated factory locations.
 * - **Taxation**: Awards victory points, adds money to treasury, distributes greatness to stockholders.
 *   If points reach WIN_POINTS, sets mode to GAME_OVER.
 * - **Factory**: Builds a factory in a territory. Costs $5 from country (shortfall from player).
 * - **Import**: Places up to 3 new units. Costs $1 each from country (shortfall from player).
 * - **L-Maneuver / R-Maneuver**: Moves all fleets/armies, resolving wars, placing tax chips,
 *   handling peaceful/hostile entry, and destroying factories.
 *
 * After executing the action:
 * - Checks if the Investor slot was passed on the rondel (triggers buy mode)
 * - Otherwise advances to next country (proposal mode)
 * - Clears proposals, pays rondel spin cost ($2 per step beyond 3), updates wheelSpot
 *
 * @param {GameState} gameState - Game state (mutated in place)
 * @param {Object} context - Proposal context (unstringified) with wheelSpot and action fields
 */
async function executeProposal(gameState, context) {
	let country = gameState.countryUp;
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let wheel = await database.ref(setup + '/wheel').once('value');
	wheel = wheel.val();
	let territorySetup = await database.ref(setup + '/territories').once('value');
	territorySetup = territorySetup.val();
	let history = await makeHistory(gameState, context);
	gameState.history.push(context.name + "'s proposal occurs: " + history);
	switch (context.wheelSpot) {
		case WHEEL_ACTIONS.INVESTOR:
			let amt = helper.getInvestorPayout(gameState, country, context.name);
			let total = 0;
			for (let i in amt) {
				total += amt[i][1];
				gameState.playerInfo[amt[i][0]].money += amt[i][1];
			}
			gameState.countryInfo[country].money -= total;
			break;
		case WHEEL_ACTIONS.L_PRODUCE:
		case WHEEL_ACTIONS.R_PRODUCE:
			if (!context.fleetProduce) {
				context.fleetProduce = [];
			}
			if (!context.armyProduce) {
				context.armyProduce = [];
			}
			for (let fleet of context.fleetProduce) {
				if (!gameState.countryInfo[country].fleets) {
					gameState.countryInfo[country].fleets = [];
				}
				gameState.countryInfo[country].fleets.push({ territory: fleet, hostile: true });
			}
			for (let army of context.armyProduce) {
				if (!gameState.countryInfo[country].armies) {
					gameState.countryInfo[country].armies = [];
				}
				gameState.countryInfo[country].armies.push({ territory: army, hostile: true });
			}
			break;
		case WHEEL_ACTIONS.TAXATION:
			let taxInfo = await helper.getTaxInfo(gameState.countryInfo, gameState.playerInfo, country);
			gameState.countryInfo[country].points = Math.min(
				gameState.countryInfo[country].points + taxInfo.points,
				WIN_POINTS
			);
			gameState.countryInfo[country].money += taxInfo.money;
			gameState.countryInfo[country].lastTax = Math.min(taxInfo.points + 5, 15);
			for (let tax of taxInfo['tax split']) {
				gameState.playerInfo[tax[0]].money += tax[1];
			}
			if (gameState.countryInfo[country].points === WIN_POINTS) {
				gameState.mode = MODES.GAME_OVER;
				// Early return so incrementCountry does not overwrite game-over mode.
				// Still clean up proposals, pay spin cost, and update wheelSpot.
				gameState['proposal 1'] = null;
				gameState['proposal 2'] = null;
				let winDiff = 0;
				if (gameState.countryInfo[country].wheelSpot !== WHEEL_CENTER) {
					winDiff =
						(wheel.indexOf(context.wheelSpot) -
							wheel.indexOf(gameState.countryInfo[country].wheelSpot) +
							wheel.length) %
						wheel.length;
				}
				if (winDiff > FREE_RONDEL_STEPS) {
					gameState.playerInfo[context.name].money -= RONDEL_STEP_COST * (winDiff - FREE_RONDEL_STEPS);
				}
				gameState.countryInfo[country].wheelSpot = context.wheelSpot;
				gameState.currentManeuver = null;
				return;
			}
			break;
		case WHEEL_ACTIONS.FACTORY:
			gameState.countryInfo[country].factories.push(context.factoryLoc);
			gameState.countryInfo[country].money -= FACTORY_COST;
			if (gameState.countryInfo[country].money < 0) {
				gameState.playerInfo[context.name].money += gameState.countryInfo[country].money;
				gameState.countryInfo[country].money = 0;
			}
			break;
		case WHEEL_ACTIONS.IMPORT:
			for (let i in context.import.types) {
				if (!context.import.types) {
					context.import.types = [];
				}
				if (!context.import.territories) {
					context.import.territories = [];
				}
				if (context.import.types[i] === 'fleet') {
					if (!gameState.countryInfo[country].fleets) {
						gameState.countryInfo[country].fleets = [];
					}
					gameState.countryInfo[country].fleets.push({ territory: context.import.territories[i], hostile: true });
				}
				if (context.import.types[i] === 'army') {
					if (!gameState.countryInfo[country].armies) {
						gameState.countryInfo[country].armies = [];
					}
					gameState.countryInfo[country].armies.push({ territory: context.import.territories[i], hostile: true });
				}
				if (context.import.types[i] === 'army' || context.import.types[i] === 'fleet') {
					if (gameState.countryInfo[country].money >= 1) {
						gameState.countryInfo[country].money -= 1;
					} else {
						gameState.playerInfo[context.name].money -= 1;
					}
				}
			}
			break;
		case WHEEL_ACTIONS.L_MANEUVER:
		case WHEEL_ACTIONS.R_MANEUVER:
			let fleets = [];
			for (let fleet of context.fleetMan) {
				let split = fleet[2].split(' ');
				if (split[0] === MANEUVER_ACTIONS.WAR_PREFIX) {
					if (split[2] === 'fleet') {
						for (let i in gameState.countryInfo[split[1]].fleets) {
							if (gameState.countryInfo[split[1]].fleets[i].territory === fleet[1]) {
								gameState.countryInfo[split[1]].fleets.splice(i, 1);
								break;
							}
						}
					} else {
						for (let i in gameState.countryInfo[split[1]].armies) {
							if (gameState.countryInfo[split[1]].armies[i].territory === fleet[1]) {
								gameState.countryInfo[split[1]].armies.splice(i, 1);
								break;
							}
						}
					}
					continue;
				}
				if (!fleet[2]) {
					// remove other country's tax chip
					for (let country in gameState.countryInfo) {
						let taxChips = gameState.countryInfo[country].taxChips || [];
						while (taxChips.includes(fleet[1])) {
							taxChips.splice(taxChips.indexOf(fleet[1]), 1);
						}
					}
					if (!gameState.countryInfo[country].taxChips) {
						gameState.countryInfo[country].taxChips = [];
					}
					// first clause is not necessary
					if (!gameState.countryInfo[country].taxChips.includes(fleet[1]) && !territorySetup[fleet[1]].country) {
						gameState.countryInfo[country].taxChips.push(fleet[1]);
					}
				}
				fleets.push({ territory: fleet[1], hostile: true });
			}
			gameState.countryInfo[country].fleets = fleets;

			let armies = [];
			let sortedArmyMan = [...context.armyMan].sort((a, b) => b[2].charCodeAt(0) - a[2].charCodeAt(1));
			for (let army of sortedArmyMan) {
				let hostile = true;
				let split = army[2].split(' ');
				if (split[0] === MANEUVER_ACTIONS.WAR_PREFIX) {
					if (split[2] === 'fleet') {
						for (let i in gameState.countryInfo[split[1]].fleets) {
							if (gameState.countryInfo[split[1]].fleets[i].territory === army[1]) {
								gameState.countryInfo[split[1]].fleets.splice(i, 1);
								break;
							}
						}
					} else {
						for (let i in gameState.countryInfo[split[1]].armies) {
							if (gameState.countryInfo[split[1]].armies[i].territory === army[1]) {
								gameState.countryInfo[split[1]].armies.splice(i, 1);
								break;
							}
						}
					}
					continue;
				}
				if (!army[2]) {
					// remove other country's tax chip
					for (let country in gameState.countryInfo) {
						let taxChips = gameState.countryInfo[country].taxChips || [];
						while (taxChips.includes(army[1])) {
							taxChips.splice(taxChips.indexOf(army[1]), 1);
						}
					}
					if (!gameState.countryInfo[country].taxChips) {
						gameState.countryInfo[country].taxChips = [];
					}
					if (!gameState.countryInfo[country].taxChips.includes(army[1]) && !territorySetup[army[1]].country) {
						gameState.countryInfo[country].taxChips.push(army[1]);
					}
				}
				if (split[0] === MANEUVER_ACTIONS.PEACE) {
					if (territorySetup[army[1]].country && territorySetup[army[1]].country !== country) {
						hostile = false;
					}
				}
				if (split[0] === 'blow') {
					if (gameState.countryInfo[split[2]].factories.includes(army[1])) {
						gameState.countryInfo[split[2]].factories.splice(
							gameState.countryInfo[split[2]].factories.indexOf(army[1]),
							1
						);
					}
					continue;
				}
				armies.push({ territory: army[1], hostile: hostile });
			}
			gameState.countryInfo[country].armies = armies;

			break;
		default:
			break;
	}
	// if investor was passed
	let investorPassed = await helper.investorPassed(
		gameState.countryInfo[country].wheelSpot,
		context.wheelSpot,
		context
	);
	if (investorPassed) {
		// change mode and player up
		for (let key in gameState.playerInfo) {
			gameState.playerInfo[key].myTurn = false;
			if (gameState.playerInfo[key].investor) {
				gameState.playerInfo[key].money += INVESTOR_BONUS;
				gameState.playerInfo[key].myTurn = true;
			}
		}
		gameState.mode = MODES.BUY;
	} else {
		await incrementCountry(gameState, context);
	}
	gameState['proposal 1'] = null;
	gameState['proposal 2'] = null;
	// pay spin cost
	let diff = 0;
	if (gameState.countryInfo[country].wheelSpot !== WHEEL_CENTER) {
		diff =
			(wheel.indexOf(context.wheelSpot) - wheel.indexOf(gameState.countryInfo[country].wheelSpot) + wheel.length) %
			wheel.length;
	}
	if (diff > FREE_RONDEL_STEPS) {
		gameState.playerInfo[context.name].money -= RONDEL_STEP_COST * (diff - FREE_RONDEL_STEPS);
	}
	gameState.countryInfo[country].wheelSpot = context.wheelSpot;
	gameState.currentManeuver = null;
}

/**
 * Submits a player's proposal for a wheel action (mode === PROPOSAL or PROPOSAL_OPP).
 *
 * Flow depends on government type and which player is submitting:
 *
 * **Dictatorship** (leader only): Executes the proposal immediately via executeProposal().
 *
 * **Democracy — Leader** (leadership[0]):
 *   - Stores the proposal in gameState['proposal 1'] (stringified with stringifyFunctions)
 *   - Sets mode to PROPOSAL_OPP, switches turn to opposition (leadership[1])
 *
 * **Democracy — Opposition** (leadership[1]):
 *   - Stores counter-proposal in gameState['proposal 2'] (stringified)
 *   - Sets mode to VOTE, creates voting state, makes all leadership players active
 *
 * Called from: ProposalApp (leader) and ProposalAppOpp (opposition).
 *
 * @param {Object} context - UserContext with wheelSpot and action-specific fields
 *                           (e.g. factoryLoc, fleetProduce, armyMan, etc.)
 * @returns {Promise<string>} 'done' on success
 */
async function submitProposal(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let country = gameState.countryUp;
	let leadership = gameState.countryInfo[country].leadership;
	gameState.sameTurn = false;

	gameState.playerInfo[context.name].myTurn = false;

	// For maneuver actions, enter step-by-step mode instead of the normal flow
	if (context.wheelSpot === WHEEL_ACTIONS.L_MANEUVER || context.wheelSpot === WHEEL_ACTIONS.R_MANEUVER) {
		// Pay spin cost and update wheel position before entering maneuver
		let setup = await database.ref('games/' + context.game + '/setup').once('value');
		setup = setup.val();
		let wheel = await database.ref(setup + '/wheel').once('value');
		wheel = wheel.val();
		let diff = 0;
		if (gameState.countryInfo[country].wheelSpot !== WHEEL_CENTER) {
			diff =
				(wheel.indexOf(context.wheelSpot) - wheel.indexOf(gameState.countryInfo[country].wheelSpot) + wheel.length) %
				wheel.length;
		}
		if (diff > FREE_RONDEL_STEPS) {
			gameState.playerInfo[context.name].money -= RONDEL_STEP_COST * (diff - FREE_RONDEL_STEPS);
		}
		gameState.countryInfo[country].wheelSpot = context.wheelSpot;

		await enterManeuver(gameState, context);
		gameState.undo = context.name;
		await finalizeSubmit(gameState, context.game, context);
		return 'done';
	}

	let history = await makeHistory(gameState, context);
	if (gameState.countryInfo[country].gov === GOV_TYPES.DICTATORSHIP) {
		await executeProposal(gameState, context);
	} else {
		if (context.name === leadership[0]) {
			// change whose turn
			gameState.playerInfo[leadership[1]].myTurn = true;
			// put context in proposal 1
			gameState['proposal 1'] = helper.stringifyFunctions(context);
			// add to history

			gameState.history.push(context.name + ' proposes as the leader: ' + history);
			// change mode to proposal-opp
			gameState.mode = MODES.PROPOSAL_OPP;
		} else {
			// put context in proposal 2
			gameState['proposal 2'] = helper.stringifyFunctions(context);
			// change whose turn
			for (let player of leadership) {
				gameState.playerInfo[player].myTurn = true;
			}
			// add to history
			await gameState.history.push(context.name + ' proposes as the opposition: ' + history);
			// mode to vote
			gameState.mode = MODES.VOTE;
			let l = gameState.history.length;
			gameState.voting = {
				country: country,
				'proposal 1': {
					proposal: gameState.history[l - 2],
					votes: 0,
					voters: [],
				},
				'proposal 2': {
					proposal: gameState.history[l - 1],
					votes: 0,
					voters: [],
				},
			};
		}
	}

	gameState.undo = context.name;
	await finalizeSubmit(gameState, context.game, context);
	return 'done';
}

/**
 * Fisher-Yates shuffle. Randomizes array in place.
 * Used to break ties randomly in bid ordering and player ordering.
 *
 * @param {Array} array - Array to shuffle (mutated in place)
 */
function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		let j = Math.floor(Math.random() * (i + 1));
		let temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
}

/**
 * Handles the end of a bid/buy round when no more players can buy stock.
 *
 * If the country is NOT Russia and at least one player can afford stock ($2+),
 * sets up a new bid round for the next country. Otherwise:
 * 1. Clears all bids
 * 2. Sets player order by wealth (richest first, ties broken randomly)
 * 3. Assigns the investor card to the richest player
 * 4. Sets up swiss banking for permanently eligible players
 * 5. Advances to the next country (proposal mode)
 *
 * Special case: Russia is the last country in the initial bidding phase.
 * After Russia, the game transitions from bidding to the proposal cycle.
 *
 * @param {Object} context - UserContext with { game }
 * @param {GameState} gameState - Game state (mutated in place)
 * @param {string} country - The country whose bid round just ended
 */
async function doneBuying(context, gameState, country) {
	let players = Object.keys(gameState.playerInfo);
	for (let i in players) {
		delete gameState.playerInfo[players[i]].bid;
	}
	if (country !== 'Russia') {
		let existsB = false;
		for (let i in players) {
			let b = false;
			let money = gameState.playerInfo[players[i]].money;
			// note i'm too lazy to use stockCosts here
			if (money >= 2) {
				b = true;
				existsB = true;
			}
			gameState.playerInfo[players[i]].myTurn = b;
		}
		// if no one's turn then same as if country was russia
		if (existsB) {
			// next country
			let countries = await helper.getCountries(context);
			let index = countries.indexOf(country);
			let newCountry = countries[(index + 1) % countries.length];
			gameState.countryUp = newCountry;
			// bid mode
			gameState.mode = MODES.BID;
			return;
		}
	}
	// set order
	let t = [];
	for (let key in gameState.playerInfo) {
		t.push([gameState.playerInfo[key].money, key]);
	}
	shuffle(t);
	t.sort((a, b) => b[0] - a[0]);
	for (let i in t) {
		gameState.playerInfo[t[i][1]].order = parseInt(i) + 1;
	}
	gameState.playerInfo[t[0][1]].investor = true;
	// set swiss people
	if (!gameState.swissSet) {
		gameState.swissSet = [];
	}
	let permSwiss = helper.getPermSwiss(gameState);
	for (let i in permSwiss) {
		gameState.swissSet.push(permSwiss[i]);
	}

	await incrementCountry(gameState, context);
}

/**
 * Sorts players who submitted bids in descending order by bid amount.
 * Ties are broken randomly (via shuffle before sort). Sets gameState.bidBuyOrder
 * and logs the bid order to history.
 *
 * Called when all players have submitted bids (mode transitions to BUY_BID).
 *
 * @param {GameState} gameState - Game state (mutated in place: sets bidBuyOrder, pushes history)
 */
async function setBidBuyOrder(gameState) {
	let p = Object.keys(gameState.playerInfo);
	shuffle(p);
	let players = [];
	for (let elt of p) {
		if (gameState.playerInfo[elt].bid !== undefined) {
			players.push(elt);
		}
	}
	players.sort((a, b) => gameState.playerInfo[b].bid - gameState.playerInfo[a].bid);
	gameState.bidBuyOrder = players;
	let a = players.map((x) => x + ' bidding $' + gameState.playerInfo[x].bid);
	let s = a.join(', ');
	gameState.history.push('The ' + gameState.countryUp + ' bids in order were ' + s + '.');
}

/**
 * Finds the next player in bidBuyOrder who can afford stock, and makes it their turn.
 * If no player can afford stock (getStockBelow returns 0), calls doneBuying() to end the round.
 *
 * @param {Object} context - UserContext with { game }
 * @param {GameState} gameState - Game state (mutated in place)
 * @param {string} country - The country being bid on
 */
async function setNextBuyer(context, gameState, country) {
	let money = 0;
	let player = '';
	if (gameState.bidBuyOrder.length > 0) {
		player = gameState.bidBuyOrder[0];
		money = gameState.playerInfo[player].bid;
	}
	let stockBelow = await helper.getStockBelow(money, gameState.countryInfo[country], context);
	if (stockBelow === 0) {
		player = '';
	}
	if (!player) {
		await doneBuying(context, gameState, country);
	} else {
		gameState.playerInfo[player].myTurn = true;
	}
}

/**
 * Highest bidder decides to buy or pass on the stock they bid on (mode === BUY_BID).
 *
 * If context.buyBid is true, buys the highest stock the player can afford
 * (at their bid price) and recalculates leadership. Otherwise, logs a decline.
 * Either way, removes the player from bidBuyOrder and finds the next buyer.
 *
 * Called from: BuyBidApp component when player clicks Buy or Pass.
 *
 * @param {Object} context - UserContext with { game, name, buyBid (boolean) }
 */
async function bidBuy(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	gameState.sameTurn = false;
	let country = gameState.countryUp;
	let bid = gameState.playerInfo[context.name].bid;
	let stock = await helper.getStockBelow(bid, gameState.countryInfo[country], context);

	// add to owned, remove from availStock, adjust money
	if (context.buyBid) {
		buyStock(gameState, context.name, { country: country, stock: stock }, bid, context);
		changeLeadership(gameState, country, context.name);
		gameState.history.push(context.name + ' buys the ' + country + ' ' + stock + '.');
	} else {
		gameState.history.push(context.name + ' declines the ' + country + ' ' + stock + '.');
	}
	delete gameState.playerInfo[context.name].bid;
	gameState.bidBuyOrder.splice(0, 1);
	gameState.playerInfo[context.name].myTurn = false;

	await setNextBuyer(context, gameState, country);
	gameState.undo = context.name;
	await finalizeSubmit(gameState, context.game, context);
}

/**
 * Submits a player's bid for the current country's stock (mode === BID).
 *
 * All players bid simultaneously. Each player's bid is stored on their playerInfo.
 * When all players have bid (no one's myTurn is true), transitions to BUY_BID mode:
 * sorts bids, and the highest bidder gets first choice.
 *
 * Called from: BidApp component when player submits their bid amount.
 *
 * @param {Object} context - UserContext with { game, name, bid (number) }
 * @returns {Promise<string>} 'done' on success
 */
async function bid(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	gameState.sameTurn = false;
	let country = gameState.countryUp;

	gameState.playerInfo[context.name].bid = context.bid;
	gameState.playerInfo[context.name].myTurn = false;
	gameState.history.push(context.name + ' has submitted a bid for ' + country + '.');

	let doneBidding = true;
	for (let key in gameState.playerInfo) {
		if (gameState.playerInfo[key].myTurn) {
			doneBidding = false;
		}
	}
	gameState.sameTurn = true;
	if (doneBidding) {
		gameState.sameTurn = false;
		gameState.mode = MODES.BUY_BID;
		setBidBuyOrder(gameState);
		await setNextBuyer(context, gameState, country);
	}
	gameState.undo = context.name;
	await finalizeSubmit(gameState, context.game, context);

	return 'done';
}

/**
 * Creates a new game from the template, initializing all players and writing to Firebase.
 *
 * 1. Reads the 'template game' from Firebase
 * 2. Calculates starting money: 61 / playerCount
 * 3. Replaces the template 'player' entry with actual player names
 * 4. Initializes timer if the game is timed
 * 5. Writes the new game state to games/{newGameID}
 *
 * Called from: EnterApp when creating a new game.
 *
 * @param {Object} info - { newGameID: string, newGamePlayers: string[6] }
 *                        newGamePlayers has up to 6 entries; empty strings are skipped
 * @returns {Promise<string>} 'done' on success
 */
async function newGame(info) {
	let gameState = await database.ref('template game').once('value');
	gameState = gameState.val();
	let count = 0;
	for (let i in info.newGamePlayers) {
		if (info.newGamePlayers[i]) {
			count += 1;
		}
	}
	let startingMoney = parseFloat((61.0 / count).toFixed(2));

	let templatePlayer = gameState.playerInfo.player;
	templatePlayer.money = startingMoney;
	delete gameState.playerInfo.player;
	let timer = gameState.timer;
	if (timer.timed) {
		let offset = await database.ref('/.info/serverTimeOffset').once('value');
		let offsetVal = offset.val() || 0;
		let serverTime = Date.now() + offsetVal;
		timer.lastMove = serverTime;
	}
	for (let i in info.newGamePlayers) {
		if (info.newGamePlayers[i]) {
			gameState.playerInfo[info.newGamePlayers[i]] = { ...templatePlayer };
			if (timer.timed) {
				gameState.playerInfo[info.newGamePlayers[i]].banked = timer.banked;
			}
		}
	}
	let p = info.newGamePlayers.filter(Boolean).join(', ');
	gameState.history = ['The game has begun with players ' + p + '.'];
	await database.ref('games/' + info.newGameID).set(gameState, async (error) => {
		if (error) {
			console.error('Firebase write failed in newGame:', error);
		} else {
			await database.ref('games/' + info.newGameID + '/turnID').set(gameState.turnID + 1);
		}
	});
	return 'done';
}

/**
 * Undoes the last turn by restoring the previous game state from history.
 *
 * 1. Reads the previous turnID (current - 1)
 * 2. Loads the game state snapshot from game histories
 * 3. Updates the timer's lastMove to current server time
 * 4. Removes the history entry
 * 5. Writes the restored state back to games/{gameID}
 *
 * Only the player who last submitted (gameState.undo === name) can undo.
 * The undoable() check in turnAPI.js gates the UI.
 *
 * @param {Object} context - UserContext with { game, name }
 * @returns {Promise<string>} 'done' on success
 */
async function undo(context) {
	let oldTurnID = await database.ref('games/' + context.game + '/turnID').once('value');
	oldTurnID = oldTurnID.val() - 1;
	let gameState = await database.ref('game histories/' + context.game + '/' + oldTurnID).once('value');
	gameState = gameState.val();
	let offset = await database.ref('/.info/serverTimeOffset').once('value');
	let offsetVal = offset.val() || 0;
	gameState.timer.lastMove = Date.now() + offsetVal;

	await database.ref('game histories/' + context.game + '/' + oldTurnID).remove();
	await database.ref('games/' + context.game).set(gameState, async (error) => {
		if (error) {
			console.error('Firebase write failed in undo:', error);
		} else {
			await database.ref('games/' + context.game + '/turnID').set(oldTurnID);
		}
	});
	return 'done';
}

export {
	submitBuy,
	submitVote,
	submitNoCounter,
	submitManeuver,
	submitDictatorPeaceVote,
	submitPeaceVote,
	submitProposal,
	bidBuy,
	bid,
	newGame,
	undo,
	// Internal functions exported for testing
	buyStock,
	returnStock,
	changeLeadership,
	incrementCountry,
	adjustTime,
	enterManeuver,
	completeManeuver,
	executeProposal,
};
