var express = require("express");
var router = express.Router();
const database = require('./firebase');
const helper = require('./helper');

function realStockOpts(availStock, money, returned, costs) {
	let opts = [];
	money += costs[returned];
	for (let i in availStock) {
		if (money>=costs[availStock[i]] && availStock[i]>returned) {
			opts.push(availStock[i]);
		}
	}
	return opts;
}

async function getCountries() {
	let countries = await database.ref('setup/countries').once('value');
	countries = countries.val();
	let t = [null, null, null, null, null, null];
	for (key in countries) {
		t[countries[key].order-1]=key;
	}
	return t;
}

// fix to eliminate illegal countries
router.get("/getCountryOptions/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let countries = await getCountries();
	countries = countries.val();
	let opts = [];
	let costs = await database.ref('setup/stockCosts').once('value');
	costs = costs.val();
	for (let i in countries) {
		let info = await database.ref('games/'+context.game+'/countryInfo/'+countries[i]).once('value');
		info = info.val();
		let offLimits = info.offLimits;
		let availStock = await database.ref('games/'+context.game+'/countryInfo/'+countries[i]+'/availStock').once('value');
		availStock = availStock.val();
		if (!availStock) {
			availStock=[];
		}
		let money = await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/money').once('value');
		money = money.val();
		if (offLimits===true) {
			continue;
		}
		if (realStockOpts(availStock, money, 0, costs).length!=0) {
			opts.push(countries[i]);
			continue;
		}
		let owned = await database.ref(context.game+'/playerInfo/'+context.name+'/stock').once('value');
		owned = owned.val();
		for (let j in owned) {
			if (owned[j].country==countries[i]) {
				if (realStockOpts(availStock, money, owned[j].stock, costs).length>0) {
					opts.push(countries[i]);
					break;
				}
			}
		}
	}
	opts.push("Punt Buy");
    res.send(opts);
});

// fix
router.get("/getReturnStockOptions/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let country = context.buyCountry;
	if (country=="Punt Buy") {
		res.send([]);
		return;
	}
	let owned = await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/stock').once('value');
	owned = owned.val();
	let availStock = await database.ref('games/'+context.game+'/countryInfo/'+country+'/availStock').once('value');
	availStock = availStock.val();
	let money = await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/money').once('value');
	money = money.val();
	let costs = await database.ref('setup/stockCosts').once('value');
	costs = costs.val();
	let opts = [];
	if (realStockOpts(availStock, money, 0, costs).length>0) {
		opts.push("None")
	}
	for (let i in owned) {
		if (owned[i].country==country && realStockOpts(availStock, money, owned[i].stock, costs).length>0) {
			opts.push(owned[i].stock)
		}
	}
	if (opts.length==1 && opts[0]=="None") {
		opts = [];
	}
    res.send(opts);
});

// done
router.get("/getStockOptions/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let country = context.buyCountry;
	if (country=="Punt Buy") {
		res.send([]);
		return;
	}
	let availStock = await database.ref('games/'+context.game+'/countryInfo/'+country+'/availStock').once('value');
	let costs = await database.ref('setup/stockCosts').once('value');
	costs = costs.val();
	availStock = availStock.val();
	if (!availStock) {
		availStock = [];
	}
	let money = await database.ref('games/'+context.game+'/playerInfo/'+context.name+'/money').once('value');
	money = money.val();
	returned = context.returnStock;
	if (returned == "None" || returned=="") {
		returned = 0;
	}
    res.send(realStockOpts(availStock, money, returned, costs));
});

module.exports = router;