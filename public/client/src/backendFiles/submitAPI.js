import { database } from './firebase.js';
import * as helper from './helper.js';
import emailjs from 'emailjs-com';

// modes are "buy" "proposal" "vote" "continue-man", "game-over"

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
		await database.ref('/.info/serverTimeOffset').on('value', function (offset) {
			let offsetVal = offset.val() || 0;
			let serverTime = Date.now() + offsetVal;
			time = serverTime;
		});
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
		} else {
			await database.ref('games/' + gameID + '/turnID').set(gameState.turnID + 1);
		}
	});
}

// player's turn is over
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

// increment country/round up/player up/mode
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
	gameState.mode = 'proposal';
}

// adds to owned, remove from avail, charged player + gives money to country.
function buyStock(gameState, player, stock, price, context) {
	if (!gameState.playerInfo[player].stock) {
		gameState.playerInfo[player].stock = [];
	}
	gameState.playerInfo[player].stock.push(stock);
	let availStock = gameState.countryInfo[stock.country].availStock;
	availStock.splice(availStock.indexOf(stock.stock), 1);
	gameState.playerInfo[player].money -= price;
	gameState.countryInfo[stock.country].money += price;
	helper.sortStock(gameState.playerInfo[player].stock, context);
}

// same as buy, but return
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
		gameState.countryInfo[country].gov = 'dictatorship';
	} else {
		gameState.countryInfo[country].gov = 'democracy';
	}
}

// fix
async function submitBuy(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	gameState.sameTurn = false;
	if (context.buyCountry === 'Punt Buy') {
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

// fix
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
	finalizeSubmit(gameState, context.game, context);
	return 'done';
}

// fix
async function submitNoCounter(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	gameState.sameTurn = false;
	let country = gameState.countryUp;

	gameState.history.push(context.name + " agreed with the leader's proposal for " + country + '.');
	let propContext = helper.unstringifyFunctions(gameState['proposal 1']);
	await executeProposal(gameState, propContext);

	gameState.undo = context.name;
	finalizeSubmit(gameState, context.game, context);

	return 'done';
}

// fix (note this is continue-man) (make sure to set currentManeuver)
function submitManeuver(context) {
	return 'done';
}

function w(x) {
	if (x) {
		return ' with ';
	} else {
		return '';
	}
}

async function makeHistory(gameState, context) {
	let country = gameState.countryUp;

	switch (context.wheelSpot) {
		case 'Investor':
			let amt = helper.getInvestorPayout(gameState, country, context.name);
			let msgs = amt.map((x) => '$' + x[1] + ' to ' + x[0]);
			return country + ' investors, paying ' + msgs.join(', ') + '.';
		case 'L-Produce':
		case 'R-Produce':
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
		case 'Taxation':
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
		case 'Factory':
			return country + ' builds a factory in ' + context.factoryLoc + '.';
		case 'Import':
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
		case 'L-Maneuver':
		case 'R-Maneuver':
			let sortedF = [...context.fleetMan].sort((a, b) => b[2].charCodeAt(0) - a[2].charCodeAt(1));
			let f = sortedF.map((x) => x[0] + ' to ' + x[1] + w(x[2]) + x[2]);
			f = f.join(', ');

			let sortedA = [...context.armyMan].sort((a, b) => b[2].charCodeAt(0) - a[2].charCodeAt(1));
			let a = sortedA.map((x) => x[0] + ' to ' + x[1] + w(x[2]) + x[2]);
			a = a.join(', ');
			return country + ' ' + context.wheelSpot + 's fleets from ' + f + '. It moves armies from ' + a + '.';
	}
}

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
		case 'Investor':
			let amt = helper.getInvestorPayout(gameState, country, context.name);
			let total = 0;
			for (let i in amt) {
				total += amt[i][1];
				gameState.playerInfo[amt[i][0]].money += amt[i][1];
			}
			gameState.countryInfo[country].money -= total;
			break;
		case 'L-Produce':
		case 'R-Produce':
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
		case 'Taxation':
			let taxInfo = await helper.getTaxInfo(gameState.countryInfo, gameState.playerInfo, country);
			gameState.countryInfo[country].points = Math.min(gameState.countryInfo[country].points + taxInfo.points, 25);
			gameState.countryInfo[country].money += taxInfo.money;
			gameState.countryInfo[country].lastTax = Math.min(taxInfo.points + 5, 15);
			for (let tax of taxInfo['tax split']) {
				gameState.playerInfo[tax[0]].money += tax[1];
			}
			if (gameState.countryInfo[country].points === 25) {
				gameState.mode = 'game-over';
				break;
			}
			break;
		case 'Factory':
			gameState.countryInfo[country].factories.push(context.factoryLoc);
			gameState.countryInfo[country].money -= 5;
			if (gameState.countryInfo[country].money < 0) {
				gameState.playerInfo[context.name].money += gameState.countryInfo[country].money;
				gameState.countryInfo[country].money = 0;
			}
			break;
		case 'Import':
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
		case 'L-Maneuver':
		case 'R-Maneuver':
			let fleets = [];
			for (let fleet of context.fleetMan) {
				let split = fleet[2].split(' ');
				if (split[0] === 'war') {
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
				if (split[0] === 'war') {
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
				if (split[0] === 'peace') {
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
				gameState.playerInfo[key].money += 2;
				gameState.playerInfo[key].myTurn = true;
			}
		}
		gameState.mode = 'buy';
	} else {
		await incrementCountry(gameState, context);
	}
	gameState['proposal 1'] = null;
	gameState['proposal 2'] = null;
	// pay spin cost
	let diff = 0;
	if (gameState.countryInfo[country].wheelSpot !== 'center') {
		diff =
			(wheel.indexOf(context.wheelSpot) - wheel.indexOf(gameState.countryInfo[country].wheelSpot) + wheel.length) %
			wheel.length;
	}
	if (diff > 3) {
		gameState.playerInfo[context.name].money -= 2 * (diff - 3);
	}
	gameState.countryInfo[country].wheelSpot = context.wheelSpot;
	gameState.currentManeuver = null;
}

// fix (make sure to set currentManeuver)
async function submitProposal(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let country = gameState.countryUp;
	let leadership = gameState.countryInfo[country].leadership;
	gameState.sameTurn = false;

	gameState.playerInfo[context.name].myTurn = false;
	let history = await makeHistory(gameState, context);
	if (gameState.countryInfo[country].gov === 'dictatorship') {
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
			gameState.mode = 'proposal-opp';
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
			gameState.mode = 'vote';
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
	finalizeSubmit(gameState, context.game, context);
	return 'done';
}

function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		let j = Math.floor(Math.random() * (i + 1));
		let temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
}

// done, needs checking
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
			gameState.mode = 'bid';
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

// done, needs checking
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

// done, needs checking
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
	finalizeSubmit(gameState, context.game, context);
}

// done, needs checking
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
		gameState.mode = 'buy-bid';
		setBidBuyOrder(gameState);
		await setNextBuyer(context, gameState, country);
	}
	gameState.undo = context.name;
	finalizeSubmit(gameState, context.game, context);

	return 'done';
}

// done, needs checking
async function newGame(info) {
	let gameState = await database.ref('template game').once('value');
	gameState = gameState.val();
	let count = 0;
	for (let i in info.newGamePlayers) {
		if (info.newGamePlayers[i]) {
			count += 1;
		}
	}
	let startingMoney = parseFloat(61.0 / count.toFixed(2));

	let templatePlayer = gameState.playerInfo.player;
	templatePlayer.money = startingMoney;
	delete gameState.playerInfo.player;
	let timer = gameState.timer;
	if (timer.timed) {
		await database.ref('/.info/serverTimeOffset').on('value', function (offset) {
			let offsetVal = offset.val() || 0;
			let serverTime = Date.now() + offsetVal;
			timer.lastMove = serverTime;
		});
	}
	for (let i in info.newGamePlayers) {
		if (info.newGamePlayers[i]) {
			gameState.playerInfo[info.newGamePlayers[i]] = templatePlayer;
			if (timer.timed) {
				gameState.playerInfo[info.newGamePlayers[i]].banked = timer.banked;
			}
		}
	}
	let p = info.newGamePlayers.filter(Boolean).join(', ');
	gameState.history = ['The game has begun with players ' + p + '.'];
	await database.ref('games/' + info.newGameID).set(gameState, async (error) => {
		if (error) {
		} else {
			await database.ref('games/' + info.newGameID + '/turnID').set(gameState.turnID + 1);
		}
	});
	return 'done';
}

async function undo(context) {
	let oldTurnID = await database.ref('games/' + context.game + '/turnID').once('value');
	oldTurnID = oldTurnID.val() - 1;
	let gameState = await database.ref('game histories/' + context.game + '/' + oldTurnID).once('value');
	gameState = gameState.val();
	await database.ref('/.info/serverTimeOffset').on('value', function (offset) {
		let offsetVal = offset.val() || 0;
		let serverTime = Date.now() + offsetVal;
		gameState.timer.lastMove = serverTime;
	});

	await database.ref('game histories/' + context.game + '/' + oldTurnID).remove();
	await database.ref('games/' + context.game).set(gameState, async (error) => {
		if (error) {
		} else {
			await database.ref('games/' + context.game + '/turnID').set(oldTurnID);
		}
	});
	return 'done';
}

export { submitBuy, submitVote, submitNoCounter, submitManeuver, submitProposal, bidBuy, bid, newGame, undo };
