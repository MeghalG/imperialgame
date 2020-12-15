var express = require("express");
var router = express.Router();
const database = require('./firebase');
const helper = require('./helper');

async function getCountries() {
	let countries = await database.ref('setup/countries').once('value');
	countries = countries.val();
	let t = [null, null, null, null, null, null];
	for (key in countries) {
		t[countries[key].order-1]=key;
	}
	return t;
}

// done
router.get("/getCountryNames", async function(req, res, next) {
	let countries = await getCountries();
	res.send(countries);
});


router.get("/getGameIDs", async function(req, res, next) {
	let ids = await database.ref('games').once('value');
	ids = ids.val();
	if (!ids) {
		res.send([]);
		return;
	}
	ids = Object.keys(ids);
	res.send(ids);
});

// done, needs checking
router.get("/getMoney/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let money = await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/money').once('value');
	money = money.val();
    res.send(money);
});

// fix
router.get("/getBid/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let bid = await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/bid').once('value');
	bid = bid.val();
    res.send(bid.toString());
});

// fix
router.get("/getStock/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let t = {};
	let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	t['country'] = country;
	let bid = await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/bid').once('value');
	bid = bid.val();
	let value = await helper.getStockBelow(bid, countryInfo[country]);
	t['value'] = value;
    res.send(t);
});

// fix
router.get("/getVoteOptions/:context", function(req, res, next) {
    res.send(["Option 1", "Option Bear"]);
});

module.exports = router;