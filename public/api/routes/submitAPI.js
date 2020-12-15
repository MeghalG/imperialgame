var express = require("express");
var router = express.Router();
const database = require('./firebase');
const helper = require('./helper');

// modes are "buy" "proposal" "vote" "continue-man"

// increment country/round up/actionNumber=0/player up/mode
async function incrementCountry(context) {
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	let countries = await helper.getCountries();
	countries = countries.val();
	let index = countries.indexOf(country);
	// country
	let newCountry = countries[(index+1)%countries.length];
	await database.ref('games/'+context.game+'/countryUp').set(newCountry);
	// round
	if (index==countries.length-1) {
		let round = await database.ref('games/'+context.game+'/round').once('value');
		round = round.val();
		await database.ref('games/'+context.game+'/round').set(round+1);
	}
	// player (remember that current player already set to false)
	let playerUp = await database.ref('games/'+context.game+'/countryInfo/'+newCountry+'/leadership').once('value');
	playerUp = playerUp.val();
	if (playerUp) {
		playerUp=playerUp[0];
	}
	else {
		playerUp="";
	}
	if (playerUp=="") {
		incrementCountry();
		return;
	}
	await database.ref('games/'+context.game+'/playerInfo/'+playerUp+'/myTurn').set(true);
	// acitonNumber
	await database.ref('games/'+context.game+'/actionNumber').set(0);
	// mode 
	await database.ref('games/'+context.game+'/mode').set("proposal");
}

// fix
router.post("/submitBuy/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let playerInfo = await database.ref('games/'+context.game+'/playerInfo').once('value');
	playerInfo = playerInfo.val();
	let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
	countryInfo = countryInfo.val();
	if (context.buyCountry=="Punt Buy") {
		let swissList = await database.ref('games/'+context.game+'/swissList').once('value');
		swissList = swissList.val();
		if (!swissList) {
			swissList = [];
		}
		swissList.push(context.name);
		await database.ref('games/'+context.game+'/swissList').set(swissList);
	}
	else {
		// add to owned stocks & remove returned (note owned is unsorted)
		let owned = playerInfo[context.name]['stock'];
		owned.push({country: context.buyCountry, stock: context.buyStock})
		if (context.returnStock!="None") {
			for (let i in owned) {
				if (owned[i].country==context.buyCountry && owned[i].stock==context.returnStock) {
					owned.splice(i, 1);
				}
			}
		}
		await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/stock').set(owned);
		// remove from availStock
		let availStock = countryInfo[context.buyCountry]['availStock'];
		availStock.splice(availStock.indexOf(context.buyStock),1);
		if (context.returnStock!="None" && context.returnStock!="") {
			availStock.push(context.returnStock)
			availStock.sort();
		}
		await database.ref('games/'+context.game+'/countryInfo/'+context.buyCountry+'/availStock').set(availStock);
		// change player money
		let money = playerInfo[context.name]['money'];
		let costs = await database.ref('setup/stockCosts').once('value');
		costs = costs.val();
		let change = costs[context.buyStock];
		console.log(context.returnStock);
		if (context.returnStock!="None" && context.returnStock!="") {
			change -= costs[context.returnStock];
		}
		console.log(money, change);
		await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/money').set(money-change);
		// increase country money
		let countryMoney = countryInfo[context.buyCountry]['money'];
		await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/money').set(countryMoney+change);
		// off limit the country
		await database.ref('games/'+context.game+'/countryInfo/'+context.buyCountry+'/offLimits').set(true);
	}
	// not their turn
	await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/myTurn').set(false);
	
	let swissRank = playerInfo[context.name]['swiss'];
	if (!swissRank) {
		swissRank = 0;
	}
	let lastBuy = true;
	for (let key in playerInfo) {
		// if there is another buy
		if (playerInfo[key]['swiss'] == swissRank+1) {
			// change player up
			await database.ref('games/'+context.game+'/playerInfo/'+key+'/myTurn').set(true);
			// change action number
			let actionNumber = await database.ref(context.game+'/actionNumber').once('value');
			actionNumber = actionNumber.val();
			database.ref('games/'+context.game+'/actionNumber').set(actionNumber+1);
			lastBuy = false;
		}
	}
	if (lastBuy) {
		// move investor card
		let order = playerInfo[context.name]['order'];
		let numPlayers = Object.keys(playerInfo).length;
		await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/investor').set(false);
		for (let key in playerInfo) {
			if (playerInfo[key]['order']==(order+1)%numPlayers) {
				await database.ref('games/'+context.game+'/playerInfo/'+key+'/investor').set(true);
			}
		}
		// swiss list -> actual swiss
		for (let key in playerInfo) {
			await database.ref('games/'+context.game+'/playerInfo/'+key+'/swiss').set(false);
		}
		let swissList = await database.ref('games/'+context.game+'/swissList').once('value');
		swissList = swissList.val();
		for (let i in swissList) {
			await database.ref('games/'+context.game+'/playerInfo/'+swissList[i]+'/swiss').set(i+1);
		}
		// reset offLimits
		for (let key in countryInfo) {
			await database.ref('games/'+context.game+'/countryInfo/'+key+'/offLimits').set(false);
		}
		// change mode
		database.ref('games/'+context.game+'/mode').set("proposal");
		// increment country
		await incrementCountry(context);
	}
	// change country government
	let stockOwned = [];
	let leadership = countryInfo[context.buyCountry]['leadership'];
	let alreadyOwned = false;
	let amt = context.returnStock;
	if (amt=="None") {
		amt=0;
	}
	let total = amt;
	for (let i in leadership) {
		let t = [leadership[i], 0];
		if (leadership[i]==context.name) {
			alreadyOwned=true;
			t = [leadership[i], context.buyStock-amt, i];
		}
		for (let j in playerInfo[leadership[i]]['stock']) {
			if (playerInfo[leadership[i]]['stock'][j]['country']==context.buyCountry) {
				t[1] += playerInfo[key]['stock'][j]['value'];
				total += t[1];
			}
		}
		stockOwned.push(t);
	}
	if (!alreadyOwned) {
		stockOwned.push([context.name, context.buyStock-amt]);
	}
	stockOwned.sort((a, b) => b[1] - a[1]);
	await database.ref('games/'+context.game+'/countryInfo/'+context.buyCountry+'/leadership').set(stockOwned.map(x => x[0]));
	if (2*stockOwned[0][1]>=total) {
		await database.ref('games/'+context.game+'/countryInfo/'+context.buyCountry+'/gov').set('dictatorship');
	}
	else {
		await database.ref('games/'+context.game+'/countryInfo/'+context.buyCountry+'/gov').set('democracy');
	}
	// add to history
	let history = await database.ref('games/'+context.game+'/history').once('value');
	history = history.val();
	if (!history) {
		history=[];
	}
	history.push(context.name + " bought the " +context.buyCountry+ " " +context.buyStock+ ".")
	await database.ref('games/'+context.game+'/history').set(history);
	res.send("done");
});

// fix
router.post("/submitVote/:context", async function(req, res, next) {
	res.send("done");
});

// fix (note this is continue-man) (make sure to set currentManeuver)
router.post("/submitManeuver/:context", async function(req, res, next) {
	res.send("done");
});

// fix (make sure to set currentManeuver)
router.post("/submitProposal/:context", async function(req, res, next) {
	res.send("done");
});

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

// done, needs checking
async function doneBuying(context, players, country) {
	console.log("done method");
	for (let i in players) {
		await database.ref('games/'+context.game+'/playerInfo/'+players[i]+'/bid').remove();
	}
	if (country!="Russia") {
		console.log('doing new country');
		for (let i in players) {
			let b = false;
			let money = await database.ref('games/'+context.game+'/playerInfo/'+players[i]+'/money').once('value');
			money = money.val();
			if (money>=2) {
				b = true;
			}
			await database.ref('games/'+context.game+'/playerInfo/'+players[i]+'/myTurn').set(b);
		}
		// next country
		let countries = await helper.getCountries();
		let index = countries.indexOf(country);
		let newCountry = countries[(index+1)%countries.length];
		await database.ref('games/'+context.game+'/countryUp').set(newCountry);
		// action number 0
		await database.ref('games/'+context.game+'/actionNumber').set(0);
		// bid mode
		await database.ref('games/'+context.game+'/mode').set("bid");
	}
	else {
		incrementCountry(context);
	}
}

// done, needs checking
async function setNextBuyer(context, playerInfo, countryInfo, country) {
	console.log("setting next buyer");
	console.log(playerInfo);
	let maxMoney = 2;
	let player = "";
	let players = Object.keys(playerInfo);
	shuffle(players);
	for (let i in players) {
		let money = playerInfo[players[i]].bid;
		if (!money) {
			money=0;
		}
		if (money>=maxMoney) {
			player = players[i];
			maxMoney = money;
		}
	}
	let stockBelow = await helper.getStockBelow(maxMoney, countryInfo[country]);
	console.log("stock", stockBelow);
	console.log("player", player);
	if (stockBelow==0) {
		player = "";
	}
	if (!player) {
		doneBuying(context, players, country);
	}
	else {
		await database.ref('games/'+context.game+'/playerInfo/'+player+'/myTurn').set(true);
	}
	console.log("done setting next buyer");
	return "done";
}

// done, needs checking
router.post("/bidBuy/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let playerInfo = await database.ref('games/'+context.game+'/playerInfo').once('value');
	playerInfo = playerInfo.val();
	let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	let bid = playerInfo[context.name]['bid'];

	// add to owned, remove from availStock, adjust money
	console.log("buybid:", context.buyBid);
	if (context.buyBid) {
		let stock = await helper.getStockBelow(bid, countryInfo[country]);
		let owned = playerInfo[context.name]['stock'];
		if (!owned) {
			owned = [];
		}
		owned.push({country: country, stock: stock})
		await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/stock').set(owned);

		let availStock = countryInfo[country]['availStock'];
		availStock.splice(availStock.indexOf(stock),1);
		await database.ref('games/'+context.game+'/countryInfo/'+country+'/availStock').set(availStock);
		// change player money
		let money = playerInfo[context.name]['money'];
		await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/money').set((money-bid).toString());
		// increase country money
		let countryMoney = countryInfo[country]['money'];
		await database.ref('games/'+context.game+'/countryInfo/'+country+'/money').set((countryMoney+bid).toString());
	}
	await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/bid').remove();
	await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/myTurn').set(false);
	playerInfo = await database.ref('games/'+context.game+'/playerInfo').once('value');
	playerInfo = playerInfo.val();
	setNextBuyer(context, playerInfo, countryInfo, country);

	res.send("done");
});

// done, needs checking
router.post("/bid/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let playerInfo = await database.ref('games/'+context.game+'/playerInfo').once('value');
	playerInfo = playerInfo.val();
	let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();

	await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/bid').set(context.bid);
	await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/myTurn').set(false);
	let newPlayerInfo = await database.ref('games/'+context.game+'/playerInfo').once('value');
	newPlayerInfo = newPlayerInfo.val();

	let doneBidding = true;
	for (let key in newPlayerInfo) {
		if (newPlayerInfo[key].myTurn) {
			doneBidding=false;
		}
	}
	if (!doneBidding) {
		let actionNumber = await database.ref(context.game+'/actionNumber').once('value');
		actionNumber = actionNumber.val();
		await database.ref('games/'+context.game+'/actionNumber').set(actionNumber+1);
		res.send("done");
	}
	else {
		await database.ref('games/'+context.game+'/actionNumber').set(0);
		await database.ref('games/'+context.game+'/mode').set("buy-bid");
		let d = await setNextBuyer(context, newPlayerInfo, countryInfo, country);
		res.send(d);
	}
});

// done, needs checking
router.post("/newGame/:info", async function(req, res, next) {
	let info = JSON.parse(req.params.info);
	let template = await database.ref('template game').once('value');
	template = template.val();
	await database.ref('games/'+info.newGameID).set(template);
	await database.ref('games/'+info.newGameID+"/playerInfo").remove();
	let count = 0;
	for (let i in info.newGamePlayers) {
		if (info.newGamePlayers[i]) {
			count +=1;
		}
	}
	let startingMoney = (61.0/count).toFixed(2);
	for (let i in info.newGamePlayers) {
		if (info.newGamePlayers[i]) {
			await database.ref('games/'+info.newGameID+"/playerInfo/"+info.newGamePlayers[i]).set(template.playerInfo.player);
			await database.ref('games/'+info.newGameID+"/playerInfo/"+info.newGamePlayers[i]+"/money").set(startingMoney);
		}
	}
	res.send("done");
});

module.exports = router;