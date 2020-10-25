var express = require("express");
var router = express.Router();

var numPlayers = 2;
var stockCosts = [2, 4, 6, 9, 12, 16, 20, 25]
var playerNames = ["aok", "megaol"];
var countries = ["Austria", "Italy", "France", "England", "Germany", "Russia"];
var locations = [
	["Vienna", "Budapest", "Prague", "Lemberg", "Trieste"],
	["Rome", "Naples", "Florence", "Venice", "Genoa"],
	["Paris", "Bordeaux", "Dijon", "Marseille", "Brest"],
	["London", "Liverpool", "Edinburgh", "Sheffield", "Dublin"],
	["Berlin", "Hamburg", "Cologne", "Munich", "Danzig"],
	["Moscow", "Odessa", "Warsaw", "Kiev", "St. Petersburg"]
]
var ports = {Trieste:"Ionian Sea", 
			Naples: "Western Med", Venice: "Ionian Sea", Genoa: "Western Med", 
			Bordeaux: "Bay of Biscay", Marseille: "Western Med", Brest: "English Channel", 
			Liverpool: "North Atlantic", Edinburgh: "North Sea", London: "English Channel", Dublin: "North Atlantic", 
			Hamburg: "North Sea", Danzig: "Baltic Sea", 
			Odessa: "Black Sea", "St. Petersburg": "Baltic Sea"};
var seas = ["Black Sea", "Eastern Med", "Ionian Sea", "Western Med", "Bay of Biscay", "English Channel", "North Atlantic", "North Sea", "Baltic Sea"];
var stockCount = 8;
var colors = new Array(6).fill(null);
var stocks = [1, 2, 3, 4, 5, 6, 7, 8];
var wheel = ["Factory", "R-Produce", "R-Maneuver", "Investor", "Import", "L-Produce", "L-Maneuver", "Taxation"];
var adjacencies = {
	Vienna: ["Munich", "Prague", "Budapest", "Trieste", "Venice", "Genoa"],
	Budapest: ["Vienna", "Lemberg", "Romania", "Western Balkans", "Trieste"],
	Prague: ["Danzig", "Warsaw", "Lemberg", "Budapest", "Vienna", "Munich", "Berlin"],
	Lemberg: ["Warsaw", "Kiev", "Romania", "Budapest", "Prague", ],
	Trieste: ["Vienna", "Budapest", "Western Balkans", "Ionian Sea", "Venice"],
	Rome: ["Florence", "Venice", "Naples"],
	Naples: ["Western Med", "Rome", "Ionian Sea"],
	Florence: ["Genoa", "Venice", "Rome"],
	Venice: ["Rome", "Florence", "Genoa", "Vienna", "Trieste"],
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
}
// modes are "buy" "proposal" "vote"
var mode = "proposal";
var round = 1;
var country = 0;
var availStock = new Array(6).fill(0).map(x => new Array(stockCount).fill(true));
var playerStock = new Array(numPlayers).fill(0).map(x => new Array(6).fill([]));
var money = new Array(numPlayers).fill(50);
var countryMoney = new Array(6).fill(30);
var playersUp = [true, false];
var name = 0;
var buyCountry = 0;
var buyStock = 0;
var investorCard = 0;
var wheelSpot = 0;
var loc = 0;
var fleets = new Array(6).fill(0).map(x => []); //currently all units are fleet
var factories = new Array(6).fill(0).map(x => [true, true, false, false, false]);
var sat = [];
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
		c = locations.indexOf(l[i])
		for (j=0; j<adjacencies[l[i]].length; j++) {
			if (locations[c].includes(adjacencies[l[i]][j])&& !sat.includes(adjacencies[l[i]][j])) {
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

router.get("/getMode", function(req, res, next) {
	res.send(mode);
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
	console.log("here");
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
			l.push(locations[country][i]);
		}
	}
	console.log(l);
	return l;
}

router.get("/getNameOptions", function(req, res, next) {
    res.send(playerNames);
});
router.post("/postName", function(req, res, next) {
	name = playerNames.indexOf(req.body.choice);
	res.send("done");
});
router.get("/getCountryOptions", function(req, res, next) {
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
	res.send(locations[country]);
});
router.post("/postLocation", function(req, res, next) {
	loc = locations[country].indexOf(req.body.choice);
	res.send("done");
});
router.get("/getFleetOptions", function(req, res, next) {
	let choices = [];
	for (i=0; i<fleets[country].length; i++) {
		choices.push([fleets[country][i], adjacencies[fleets[i]]]);
	}
	res.send(choices);
});
router.post("/postFleet", function(req, res, next) {
	fleetDests = req.body.choice;
	res.send("done");
});

router.get("/getProduceMessage", function(req, res, next) {
	s = "Units produce in " + produce().join(", ")+ ".";
	res.send(s);
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
router.get("/getDisplayState", function(req, res, next) {
	d={
		colors: colors,
		points: points,
		money: countryMoney,
		availStock: toList(availStock),
	}
	res.send(d);
});
module.exports = router;