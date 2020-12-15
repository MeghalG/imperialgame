// postColors: posts country colors to api

// getDisplayState: gets country info to be displayed.

// getBuyCountryOptions: input: player, returns legal countries to buy for the player

//

/*

var express = require("express");
var router = express.Router();
const firebase = require('firebase');

var config = {
	apiKey: "AIzaSyACA3o0NyzICYS4gFol3Emm9FGmpx-x7kA",
	authDomain: "imperialgame-e8a12.firebaseapp.com",
	databaseURL: "https://imperialgame-e8a12.firebaseio.com/",
	storageBucket: "gs://imperialgame-e8a12.appspot.com",
};
firebase.initializeApp(config);
var database = firebase.database();

database.ref('setup').once('value')
	.then(snapshot => snapshot.val())
	.then(snapshot => console.log(snapshot));

// unchangeable data

var stockCosts = [2, 4, 6, 9, 12, 16, 20, 25];
var countries = ["Austria", "Italy", "France", "England", "Germany", "Russia"];
var countryLocs = [
	["Vienna", "Budapest", "Prague", "Lemberg", "Trieste"],
	["Rome", "Naples", "Florence", "Venice", "Genoa"],
	["Paris", "Bordeaux", "Dijon", "Marseille", "Brest"],
	["London", "Liverpool", "Edinburgh", "Sheffield", "Dublin"],
	["Berlin", "Hamburg", "Cologne", "Munich", "Danzig"],
	["Moscow", "Odessa", "Warsaw", "Kiev", "St Petersburg"]
];

var factoryCoordinates = {
	Vienna: ["59.5%","45.7%"],
	Budapest: ["65.2%","48.8%"],
	Prague: ["56.5%","38.5%"],
	Lemberg: ["73.7%","39.1%"],
	Trieste: ["57.9%","52.7%"],
	Rome: ["53.8%","65.7%"],
	Naples: ["58.7%","70.9%"],
	Florence: ["49.7%","61.3%"],
	Venice: ["50.1%","54.9%"],
	Genoa: ["44.8%","55.3%"],
	Paris: ["34.9%","39.3%"],
	Bordeaux: ["26.9%","54.1%"],
	Dijon: ["39.3%","46.6%"],
	Marseille: ["37.6%","57%"],
	Brest: ["23.8%","38%"],
	London: ["31.4%","29.2%"],
	Liverpool: ["26.8%","21.3%"],
	Edinburgh: ["27.5%","11.4%"],
	Sheffield: ["30.9%","21.7%"],
	Dublin: ["20.4%","19.6%"],
	Berlin: ["54.7%","29.2%"],
	Hamburg: ["48%","25.4%"],
	Cologne: ["43.7%","34.1%"],
	Munich: ["51.9%","41.5%"],
	Danzig: ["63.2%","22%"],
	Moscow: ["87.1%","10%"],
	Odessa: ["87.3%","44.6%"],
	Warsaw: ["69.2%","29.9%"],
	Kiev: ["84.3%","32.7%"],
	"St Petersburg": ["79.4%","-0.5%"],
}
var taxChipCoordinates = {
	Romania: ["83.3%", "57.9%"],
	Bulgaria: ["83%", "65.2%"],
	"Western Balkans": ["73.6%", "66.5%"],
	Greece: ["75.3%", "78%"],
	Turkey: ["97%", "77.5%"],
	"Black Sea": ["96.9%", "60.4%"],
	"Eastern Med": ["96.6%", "91.6%"],
	"Ionian Sea": ["69.8%", "91.5%"],
	Tunis: ["48.6%", "94.8%"],
	Algeria: ["34.5%", "94.8%"],
	Morocco: ["15%", "94.8%"],
	Spain: ["20.2%", "71.1%"],
	Portugal: ["11.8%", "65.6%"],
	"Western Med": ["44.1%", "83.4%"],
	"Bay of Biscay": ["17.2%", "48.2%"],
	"North Atlantic": ["14.7%", "30%"],
	"North Sea": ["43.0%,13.8%"],
	Norway: ["51.9%","0.1%"],
	Sweden: ["60.7%","3.3%"],
	Denmark: ["54.8%","18.2%"],
	Holland: ["45.4%","28.6%"],
	Belgium: ["42.1%","36.6%"],
	"Baltic Sea": ["66.7%","12.3%"],
}
var unitCoordinates = {
	Romania: ["77.6%", "60.4%"],
	Bulgaria: ["77.2%", "68%"],
	"Western Balkans": ["68.2%", "69.2%"],
	Greece: ["71%", "80.5%"],
	Turkey: ["92.3%", "79.8%"],
	"Black Sea": ["90.6%", "62.9%"],
	"Eastern Med": ["89%", "96.5%"],
	"Ionian Sea": ["62.8%", "93.9%"],
	Tunis: ["43.7%", "97.3%"],
	Algeria: ["29.4%", "97.3%"],
	Morocco: ["9.4%", "97.3%"],
	Spain: ["16.4%", "73.6%"],
	Portugal: ["8.3%", "74%"],
	"Western Med": ["26.3%", "85.9%"],
	"Bay of Biscay": ["12.9%", "50.5%"],
	"North Atlantic": ["6.9%", "34.5%"],
	"North Sea": ["36.6%","16.0%"],
	Norway: ["46.7%","2.2%"],
	Sweden: ["55.9%","5.6%"],
	Denmark: ["49.0%","20.3%"],
	Holland: ["42.1%","33.8%"],
	Belgium: ["39.4%","39.0%"],
	"Baltic Sea": ["63.8%","19.5%"],
	Kiev: ["84.1%","38.3%"],
	Moscow: ["86.9%","15.8%"],
	Odessa: ["87.3%","50.1%"],
	Warsaw: ["69.1%","35.5%"],
	Prague: ["56.4%","44%"],
	Lemberg: ["73.7%","44.6%"],
	Budapest: ["65.0%","54.3%"],
	"St Petersburg": ["79.2%","5.2%"],
	Vienna: ["59.4%","51.3%"],
	Trieste: ["57.7%","58.2%"],
	Genoa: ["44.7%","60.8%"],
	Florence: ["49.7%","66.9%"],
	Rome: ["53.8%","71.2%"],
	Naples: ["58.8%","76.6%"],
	Venice: ["50.0%","60.6%"],
	Bordeaux: ["26.7%","59.5%"],
	Dijon: ["39.1%","52.3%"],
	Paris: ["34.9%","44.8%"],
	Brest: ["24.8%","43.3%"],
	Marseille: ["37.6%","62.6%"],
	Berlin: ["54.6%","34.8%"],
	Danzig: ["63.1%","27.6%"],
	Hamburg: ["48%","31.0%"],
	Cologne: ["43.7%","39.6%"],
	Munich: ["51.8%","47.3%"],
	Dublin: ["20.3%","24.9%"],
}

var ports = {
	Trieste:"Ionian Sea", 
	Naples: "Western Med", Venice: "Ionian Sea", Genoa: "Western Med", 
	Bordeaux: "Bay of Biscay", Marseille: "Western Med", Brest: "English Channel", 
	Liverpool: "North Atlantic", Edinburgh: "North Sea", London: "English Channel", Dublin: "North Atlantic", 
	Hamburg: "North Sea", Danzig: "Baltic Sea", 
	Odessa: "Black Sea", "St Petersburg": "Baltic Sea"
};
var seas = ["Black Sea", "Eastern Med", "Ionian Sea", "Western Med", "Bay of Biscay", "English Channel", "North Atlantic", "North Sea", "Baltic Sea"];
// var wheel = ["Factory", "R-Produce", "R-Maneuver", "Investor", "Import", "L-Produce", "L-Maneuver", "Taxation"];
var adjacencies = {
	Vienna: ["Munich", "Prague", "Budapest", "Trieste", "Venice", "Genoa"],
	Budapest: ["Vienna", "Lemberg", "Romania", "Western Balkans", "Trieste", "Prague"],
	Prague: ["Danzig", "Warsaw", "Lemberg", "Budapest", "Vienna", "Munich"],
	Lemberg: ["Warsaw", "Kiev", "Romania", "Budapest", "Prague", ],
	Trieste: ["Vienna", "Budapest", "Western Balkans", "Ionian Sea", "Venice"],
	Rome: ["Florence", "Venice", "Naples", "Ionian Sea", "Western Med"],
	Naples: ["Western Med", "Rome", "Ionian Sea"],
	Florence: ["Genoa", "Venice", "Rome", "Western Med"],
	Venice: ["Rome", "Florence", "Genoa", "Vienna", "Trieste", "Ionian Sea"],
	Genoa: ["Marseille", "Vienna", "Venice", "Florence", "Western Med"],
	Paris: ["English Channel", "Belgium", "Dijon", "Brest", ],
	Bordeaux: ["Brest", "Dijon", "Marseille", "Spain", "Bay of Biscay", ],
	Dijon: ["Paris", "Belgium", "Munich", "Marseille", "Bordeaux", "Brest"],
	Marseille: ["Bordeaux", "Dijon", "Genoa", "Spain", "Western Med"],
	Brest: ["Bay of Biscay", "English Channel", "Paris", "Dijon" , "Bordeaux"],
	London: ["English Channel", "Liverpool", "Sheffield", "North Atlantic", "North Sea"],
	Liverpool: ["London", "Edinburgh", "Sheffield", "North Atlantic"],
	Edinburgh: ["Liverpool", "Sheffield", "North Sea", "North Atlantic"],
	Sheffield: ["Edinburgh", "Liverpool", "London", "North Sea"],
	Dublin: ["North Atlantic"],
	Berlin: ["Munich", "Cologne", "Hamburg", "Danzig", "Baltic Sea"],
	Hamburg: ["Holland", "Denmark", "Berlin", "Cologne", "North Sea"],
	Cologne: ["Berlin", "Holland", "Belgium", "Hamburg", "Munich"],
	Munich: ["Vienna", "Prague", "Berlin", "Cologne", "Belgium", "Dijon"],
	Danzig: ["Baltic Sea", "St Petersburg", "Warsaw", "Prague", "Berlin"],
	Moscow: ["St Petersburg", "Kiev", "Warsaw"],
	Odessa: ["Kiev", "Romania", "Black Sea"],
	Warsaw: ["St Petersburg", "Danzig", "Prague", "Lemberg", "Kiev", "Moscow"],
	Kiev: ["Warsaw", "Moscow", "Odessa", "Romania", "Lemberg"],
	"St Petersburg": ["Baltic Sea", "Moscow", "Warsaw", "Danzig"],
	"Black Sea": ["Odessa", "Bulgaria", "Romania", "Turkey", "Eastern Med"],
	Turkey: ["Black Sea", "Bulgaria", "Eastern Med"],
	"Eastern Med": ["Turkey", "Greece", "Ionian Sea", "Black Sea"],
	Romania: ["Western Balkans", "Budapest", "Lemberg", "Bulgaria", "Odessa", "Black Sea", "Kiev"],
	Bulgaria: ["Western Balkans", "Romania", "Black Sea", "Turkey", "Greece"],
	"Western Balkans": ["Trieste", "Budapest", "Romania", "Bulgaria", "Greece", "Ionian Sea"],
	Greece: ["Western Balkans", "Bulgaria", "Eastern Med", "Ionian Sea"],
	"Ionian Sea": ["Venice", "Rome", "Naples", "Trieste", "Western Balkans", "Greece", "Tunis", "Eastern Med", "Western Med"],
	Tunis: ["Algeria", "Western Med", "Ionian Sea"],
	Algeria: ["Morocco", "Tunis", "Western Med"],
	Morocco: ["Algeria", "Bay of Biscay"],
	"Western Med": ["Marseille", "Genoa", "Florence", "Rome", "Naples", "Ionian Sea", "Tunis", "Algeria", "Spain", "Bay of Biscay"],
	Spain: ["Portugal", "Bay of Biscay", "Bordeaux", "Marseille", "Western Med"],
	Portugal: ["Spain", "Bay of Biscay"],
	"Bay of Biscay": ["Spain", "Portugal", "Western Med", "Bordeaux", "North Atlantic", "English Channel", "Brest", "Morocco"],
	"English Channel": ["London", "Bay of Biscay", "North Atlantic", "North Sea", "Holland", "Belgium", "Brest", "Paris"],
	"North Atlantic": ["Bay of Biscay", "English Channel", "North Sea", "Dublin", "Liverpool", "London", "Edinburgh"],
	Belgium: ["Paris", "Dijon", "Munich", "Cologne", "Holland", "English Channel"],
	Holland: ["Belgium", "Cologne", "Hamburg", "English Channel", "North Sea"],
	"North Sea": ["Denmark", "Norway", "Edinburgh", "Sheffield", "London", "Holland", "Hamburg", "North Atlantic", "English Channel", "Baltic Sea"],
	Denmark: ["North Sea", "Baltic Sea", "Hamburg"],
	Norway: ["Sweden", "Baltic Sea", "North Sea"],
	Sweden: ["Norway", "Baltic Sea"],
	"Baltic Sea": ["Norway", "Sweden", "Denmark", "St Petersburg", "Danzig", "Berlin", "North Sea"],
}

function nullIfUndefined(x) {
	if (x === undefined) {
		return "";
	}
	else {
		return x;
	}
}

for (let key in unitCoordinates) {
	database.ref('setup/territories/'+key).set({
		'adjacencies': adjacencies[key],
		'country': null,
		'factoryCoords': nullIfUndefined(factoryCoordinates[key]),
		'unitCoords': nullIfUndefined(unitCoordinates[key]),
		'taxChipCoords': nullIfUndefined(taxChipCoordinates[key]),
		'port': false,
		'factory': false,
		'sea': false,
	})
}

var playerNames = ["aok", "megaol"];
// turn state
// modes are "buy" "proposal" "vote" "continue-man"
var mode = "buy";
var round = 1;
var country = 0;
var availStock = new Array(6).fill(0).map(x => new Array(8).fill(true));
var playerStock = new Array(playerNames.length).fill(0).map(x => new Array(6).fill(0).map(x => []).map(x => []));
var money = new Array(playerNames.length).fill(50);
var countryMoney = new Array(6).fill(30);
var playersUp = [true, false];
var name = 0;
var buyCountry = 0;
var buyStock = 0;
var investorCard = 0;
var wheelSpot = 0;
var loc = 0;
var fleets = new Array(6).fill(0).map(x => []); //currently all units are fleet
fleets[0]=["Vienna", "Paris", "Dublin"];
var armies = new Array(6).fill(0).map(x => []);
armies[1]=["Vienna", "Budapest", "Brest"];
armies[3]=["Warsaw", "Moscow"];
var factories = [["Vienna", "Budapest"], ["Rome", "Naples"], ["Paris", "Bordeaux"], ["London", "Liverpool"],["Berlin", "Hamburg"], ["Moscow", "Odessa"]]
var sat = new Array(6).fill(0).map(x => []);
var taxChips = [];
var fleetDests = [];
var leader = new Array(6).fill("");
var opp = new Array(6).fill("");
var points = new Array(6).fill(0);

function countryStock(p, c) {

}

// only works if there has been at most 1 buy since last update or game start
function fixOwnerships() {
	for (c=0; c<6; c++) {
		c+=1;
	}
}

function advanceTurn() {
	if (country == 5) {
		round+=1;
		country = 0
	}
	else {
		country+=1;
	}
}

function factory() {
	factories[country][loc]=true;
	countryMoney[country]-=5;
}

function investor() {
	for (i=0; i<playerStock.length; i++) {
		for (j=0; j<playerStock[i][country].length; j++) {
			money[i] += playerStock[i][country][j]
		}
	}
}

function destinationsF(f) {
	d=[];
	for (i=0; i<f.length; i++) {
		t = [];
		if (Object.keys(ports).includes(f[i])) {
			t=[ports[f[i]]];
		}
		else {
			t.push(f[i]);
			for (j=0; j<adjacencies[f[i]].length; j++) {
				if (seas.includes(adjacencies[f[i]][j])) {
					t.push(adjacencies[f[i]][j]);
				}
			}
		}
		d.push([f[i],t]);
	}
}
// add seas
// fix to include temporary versions
function getCountryNeighborsAndSeas(l) {
	n = [];
	for (i=0; i<l.length; i++) {
		c = countryLocs.indexOf(l[i])
		for (j=0; j<adjacencies[l[i]].length; j++) {
			if (countryLocs[c].includes(adjacencies[l[i]][j])&& !sat.includes(adjacencies[l[i]][j])) {
				n.push(adjacencies[l[i]][j]);
			}
		}
	}
	n=Array.from(new Set(n));
	if (n.sort().join(',') == l.sort().join(',')) {
		return l;
	}
	else {
		return getNeighboringLocs(n);
	}
}

function destinationsA(a) {
	d=[];
	for (i=0; i<a.length; i++) {
		t = [];
		m = getCountryNeighborsAndSeas(a[i]);
		t.push(a[i]);
		for (k=0; k<m.length; k++) {
			for (j=0; j<adjacencies[m[k]].length; j++) {
				t.push(adjacencies[a[i]][j]);
			}
		}
		t=Array.from(new Set(t));
		d.push([a[i],t]);
	}
}

router.get("/getSeaFactories", function(req, res, next) {
	fc = new Array(6).fill(0).map(x => []);
	for (let i=0; i<6; i++) {
		for (let j=0; j<factories[i].length; j++) {
			if (Object.keys(ports).includes(factories[i][j])) {
				fc[i].push(factoryCoordinates[factories[i][j]]);
			}
		}
	}
	res.send(fc);
});
router.get("/getLandFactories", function(req, res, next) {
	fc = new Array(6).fill(0).map(x => []);
	for (let i=0; i<6; i++) {
		for (let j=0; j<factories[i].length; j++) {
			if (!Object.keys(ports).includes(factories[i][j])) {
				fc[i].push(factoryCoordinates[factories[i][j]]);
			}
		}
	}
	res.send(fc);
});
router.get("/getTaxChips", function(req, res, next) {
	tx = new Array(6).fill(0).map(x => []);
	for (let i=0; i<6; i++) {
		for (let j=0; j<taxChips[i].length; j++) {
			tx[i].push(taxChipCoordinates[taxChips[i][j]]);
		}
	}
	res.send(tx);
});
router.get("/getUnits", function(req, res, next) {
	un = [];
	t = {};
	for (let i=0; i<6; i++) {
		for (let j=0; j<fleets[i].length; j++) {
			console.log(fleets[i][j]);
			if (!Object.keys(t).includes(fleets[i][j])) {
				t[fleets[i][j]]=new Array(6).fill(0).map(x => [0,0]);
			}
			t[fleets[i][j]][i][0]+=1;
		}
	}
	for (let i=0; i<6; i++) {
		for (let j=0; j<armies[i].length; j++) {
			if (!Object.keys(t).includes(armies[i][j])) {
				t[armies[i][j]]=new Array(6).fill(0).map(x => [0,0]);
			}
			t[armies[i][j]][i][1]+=1;
		}
	}
	for (var key in t) {
		un.push([unitCoordinates[key],t[key]]);
	}
	res.send(un);
});
router.get("/getPlayerNames", function(req, res, next) {
	res.send(playerNames);
});
router.get("/getMode", function(req, res, next) {
	res.send(mode);
});
router.post("/submitVote", function(req, res, next) {
	mode="proposal";
	res.send("done");
});
router.post("/submitManeuver", function(req, res, next) {
	mode="vote";
	res.send("done");
});
router.post("/submitBuy", function(req, res, next) {
	playerStock[name][buyCountry].push(stocks[buyStock]);
	availStock[buyCountry][buyStock]=false;
	name = 0;
	buyCountry = 0;
	buyStock = "";
	money[name] = money[name]-stockCosts[buyStock];
	advanceTurn();
	// next mode
	mode = "proposal";
	res.send("done");
});
router.post("/submitProposal", function(req, res, next) {
	if (wheel[wheelSpot]=="R-produce" || wheel[wheelSpot]=="L-produce") {
		fleets[country].concat(produce());
	}
	if (wheel[wheelSpot]=="Factory") {
		factory();
	}
	if (wheel[wheelSpot]=="Investor") {
		investor();
	}
	mode = "buy";
	// next mode
	res.send("done");
});

function produce() {
	l = [];
	for (var i=0; i<5; i++) {
		if (factories[country][i]) {
			l.push(countryLocs[country][i]);
		}
	}
	return l;
}

router.get("/getNonTurnMessage", function(req, res, next) {
    res.send("Bear 1 proposed blah.");
});
router.get("/getTurnTitle", function(req, res, next) {
    res.send("Your Turn!");
});
router.get("/getPlayerTurn", function(req, res, next) {
    res.send(true);
});
router.get("/getPreviousProposalMessage", function(req, res, next) {
    res.send("Bear 2 proposed meh.");
});
router.get("/getVoteOptions", function(req, res, next) {
    res.send(["Option 1", "Option Bear"]);
});
// do something here; value is req.body.choice (index of choice)
router.post("/postVote", function(req, res, next) {
	res.send("done");
});
router.get("/getCountryOptions/:context", function(req, res, next) {
	console.log("here");
	let context = JSON.parse(req.params.context);
	console.log(context);
    res.send(countries);
});
router.post("/postBuyCountry", function(req, res, next) {
	buyCountry = countries.indexOf(req.body.choice);
	res.send("done");
});
router.get("/getStockOptions", function(req, res, next) {
	res.send(stocks);
});
router.post("/postBuyStock", function(req, res, next) {
	buyStock = stocks.indexOf(req.body.choice);
	res.send("done");
});
router.get("/getWheelOptions", function(req, res, next) {
	res.send(wheel);
});
router.post("/postWheelSpot", function(req, res, next) {
	wheelSpot = wheel.indexOf(req.body.choice);
	res.send("done");
});
router.get("/getLocationOptions", function(req, res, next) {
	res.send(countryLocs[country]);
});
router.post("/postLocation", function(req, res, next) {
	loc = countryLocs[country].indexOf(req.body.choice);
	res.send("done");
});

var tempd = {Budapest: ["gao", "bear"], "North Atlantic": ["aok", "is"]};
// should work in middle of a maneuver
router.get("/getFleetPeaceOptions", function(req, res, next) {
	res.send(tempd);
});
// req.body.choice
router.post("/postFleetPeace", function(req, res, next) {
	tempd["North Atlantic"]=["meh"];
	res.send("done");
});
router.get("/getFleetOptions", function(req, res, next) {
	let choices = [[["Budapest"], ["Vienna", "Prague"]],[["Budapest"], ["Vienna", "Prague"]]];
	for (i=0; i<fleets[country].length; i++) {
		choices.push([fleets[country][i], adjacencies[fleets[country][i]]]);
	}
	res.send(choices);
});
router.post("/postFleet", function(req, res, next) {
	fleetDests = req.body.choice;
	res.send("done");
});
// the actions so far are submittable
router.get("/legalFleetMove", function(req, res, next) {
	res.send(true);
});
// the actions move all the fleets without peace proposals (so armies can be moved)
router.get("/allFleetsNoPeace", function(req, res, next) {
	res.send(true);
});
// duplicate for armies

//gets unsat country locations + army/fleet options for each
router.get("/getImportOptions", function(req, res, next) {
	res.send({
		labels: ["Import #1", "Import #2", "Import #3"],
		options: ["Army in Vienna", "Army in Lemberg", "Fleet in Trieste", "Army in Trieste"]
	});
});
// process imports req.body.values
router.post("/postImports", function(req, res, next) {
	res.send("done");
});
// get fleet info about produce
router.get("/getFleetProduceOptions", function(req, res, next) {
	res.send({
		items: ["Trieste", "Vienna", "Budapest"],
		limit: 2,
	});
});
// process fleet produce req.body.values
router.post("/postFleetProduce", function(req, res, next) {
	res.send("done");
});
// get army info about produce
router.get("/getArmyProduceOptions", function(req, res, next) {
	res.send({
		items: ["Bear1", "Bear2", "Bear3"],
		limit: 2,
	});
});
// process army produce req.body.values
router.post("/postArmyProduce", function(req, res, next) {
	res.send("done");
});

router.get("/getInvestorMessage", function(req, res, next) {
	res.send("You will investor.");
});
router.get("/getTaxMessage", function(req, res, next) {
	res.send("You will tax.");
});
router.get("/getBlankMessage", function(req, res, next) {
	res.send("");
});


router.post("/postColors", function(req, res, next) {
	colors = req.body.colors;
	res.send("done");
});
function toList(l) {
	var ans = [];
	for (var i=0; i<l.length; i++) {
		var t=[];
		for (var j=0; j<l[i].length; j++) {
			if (l[i][j]) {
				t.push(j+1);
			}
		}
		ans.push(t)
	}
	return ans;
}
router.get("/getCountryDisplayState", function(req, res, next) {
	d={
		points: points,
		money: countryMoney,
		availStock: toList(availStock),
	}
	res.send(d);
});
// fix investor, leaderships, oppositions
router.get("/getPlayerDisplayState", function(req, res, next) {
	d={
		playerMoney: money,
		playerStock: playerStock,
		investor: playerNames[0],
		players: playerNames,
		leaderships: [["Italy", "Gao"],[]],
		oppositions: [[], []],
	}
	res.send(d);
});
module.exports = router;

*/