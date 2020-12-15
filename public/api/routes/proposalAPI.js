var express = require("express");
var router = express.Router();
const database = require('./firebase');
const helper = require('./helper');

// done, needs checking
router.get("/getPreviousProposalMessage/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	let opp = await database.ref('games/'+context.game+'/countryInfo/'+country+'opp').once('value');
	opp = opp.val();
	let history = await database.ref('games/'+context.game+'/history').once('value');
	history=history.val();
	let mode = await database.ref('games/'+context.game+'/mode').once('value');
	mode=mode.val();
	let currentManeuver = await database.ref('games/'+context.game+'/currentManeuver').once('value');
	currentManeuver = currentManeuver.val();
	if (opp == context.name && mode=='proposal') {
		res.send(history[history.length-1]);
	}
	else if (mode=='continue-man') {
		res.send(currentManeuver);
	}
	else {
		res.send("");
	}
});

// done, needs checking
router.get("/getWheelOptions/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	let wheel = await database.ref('setup/wheel').once('value');
	wheel = wheel.val();
	let currentPos = await database.ref('games/'+context.game+'/countryInfo/'+country+"/wheelSpot").once('value');
	currentPos = currentPos.val();
	let money = await database.ref('games/'+context.game+'/playerInfo/'+context.name+"/money").once('value');
	money = money.val();
	currentPos = currentPos.val();
	if (currentPos == 'center') {
		res.send(wheel);
	}
    else {
		let t = [];
		let index = wheel.indexOf(currentPos);
		t.push(wheel[(index+1)%wheel.length])
		t.push(wheel[(index+2)%wheel.length])
		t.push(wheel[(index+3)%wheel.length])
		if (money>=2) {
			t.push(wheel[(index+4)%wheel.length])
		}
		if (money>=4) {
			t.push(wheel[(index+5)%wheel.length])
		}
		if (money>=6) {
			t.push(wheel[(index+6)%wheel.length])
		}
		res.send(t);
	}
});

// done, needs checking
router.get("/getLocationOptions/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let territories = await database.ref('setup/territories').once('value');
	territories = territories.val();
	let factories = countryInfo[country].factories;
	let opts = [];
	let sat = helper.getSat(countryInfo);
	for (let key in territories) {
		if (territories[key].country==country) {
			if (!sat.includes(key) && !factories.includes(key)) {
				opts.push(key)
			}
		}
	}
	res.send(opts);
});

// done, needs checking
router.get("/getFleetProduceOptions/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let territories = await database.ref('setup/territories').once('value');
	territories = territories.val();
	let countrysetup = await database.ref('setup/countries').once('value');
	countrysetup = countrysetup.val();
	let fleets = countryInfo[country].fleets;
	let unsatFactories = helper.getUnsatFactories(countryInfo, country);
	let t = [];
	for (let i in unsatFactories) {
		if (territories[unsatFactories[i]].port) {
			t.push(factories[i])
		}
	}
	res.send({
		items: t,
		limit: countrysetup[country].fleetLimit-fleets.length,
	});
});

// done, needs checking
router.get("/getArmyProduceOptions/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let territories = await database.ref('setup/territories').once('value');
	territories = territories.val();
	let countrysetup = await database.ref('setup/countries').once('value');
	countrysetup = countrysetup.val();
	let armies = countryInfo[country].armies;
	let unsatFactories = helper.getUnsatFactories(countryInfo, country);
	let t = [];
	for (let i in unsatFactories) {
		if (!territories[unsatFactories[i]].port) {
			t.push(factories[i])
		}
	}
	res.send({
		items: t,
		limit: countrysetup[country].armyLimit-armies.length,
	});
});

// done, needs checking
router.get("/getInvestorMessage/:context", async function(req, res, next) {
	let s = "The investor will pay out ";
	let context = JSON.parse(req.params.context);
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	let playerInfo = await database.ref('games/'+context.game+'/playerInfo').once('value');
	playerInfo = playerInfo.val();
	let leadership = countryInfo[context.buyCountry]['leadership'];
	let amt = helper.getOwnedStock(leadership, playerInfo, country);
	let msgs = amt.map(x => "$" +x[1]+ " to " +x[0]);
	s+=msgs.join(", ")
	s+="."
	res.send(s);
});

// done, needs checking
router.get("/getTaxMessage/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	let playerInfo = await database.ref('games/'+context.game+'/playerInfo').once('value');
	playerInfo = playerInfo.val();
	let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
	countryInfo = countryInfo.val();
	taxInfo = helper.getTaxInfo(countryInfo, playerInfo, country);

	s = country+ " will tax for " +taxInfo.points+ " points, and $" +taxInfo.money+ " into its treasury. Greatness is distributed ";
	splits = taxInfo['tax split'].map(x => "$" +x[1]+ " to " +x[0]).join(", ");
	s+= splits + "."
	
	res.send("");
});

// fix
router.get("/getFleetOptions/:context", async function(req, res, next) {
	let choices = [[["Budapest"], ["Vienna", "Prague"]],[["Budapest"], ["Vienna", "Prague"]]];
	res.send(choices);
});

// fix
router.get("/getFleetPeaceOptions/:context", async function(req, res, next) {
	let tempd = {Budapest: ["gao", "bear"], "North Atlantic": ["aok", "is"]};
	res.send(tempd);
});

// the actions so far are submittable
router.get("/legalFleetMove/:context", function(req, res, next) {
	res.send(true);
});
// the actions move all the fleets without peace proposals (so armies can be moved)
router.get("/allFleetsNoPeace/:context", function(req, res, next) {
	res.send(true);
});

// fix
router.get("/getArmyOptions/:context", function(req, res, next) {
	let choices = [[["Budapest"], ["Vienna", "Prague"]],[["Budapest"], ["Vienna", "Prague"]]];
	res.send(choices);
});

// fix
router.get("/getArmyPeaceOptions/:context", function(req, res, next) {
	let tempd = {Budapest: ["gao", "bear"], "North Atlantic": ["aok", "is"]};
	res.send(tempd);
});

// the actions so far are submittable
router.get("/legalArmyMove/:context", function(req, res, next) {
	res.send(true);
});
// the actions move all the fleets without peace proposals (so armies can be moved)
router.get("/allArmiesNoPeace/:context", function(req, res, next) {
	res.send(true);
});

// fix
router.get("/getImportOptions", function(req, res, next) {
	res.send({
		labels: ["Import #1", "Import #2", "Import #3"],
		options: ["Army in Vienna", "Army in Lemberg", "Fleet in Trieste", "Army in Trieste"]
	});
});

module.exports = router;