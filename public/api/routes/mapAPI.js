var express = require("express");
var router = express.Router();
const database = require('./firebase');
const helper = require('./helper');

// done but needs checking
router.get("/getUnits/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
    let un = [];
	let countries = await helper.getCountries();
	console.log(countries);

	let t = {};
	for (let i=0; i<countries.length; i++) {
        let country = countries[i];
        let fleets = await database.ref('games/'+context.game+'/countryInfo/'+country+'/fleets').once('value');
		fleets = fleets.val();
		if (!fleets) {
			fleets = [];
		}
		for (let j=0; j<fleets.length; j++) {
			if (!Object.keys(t).includes(fleets[j]['territory'])) {
				t[fleets[j]['territory']]=new Array(6).fill(0).map(x => [0,0,0]);
			}
			t[fleets[j]['territory']][i][0]+=1;
		}
	}
	for (let i=0; i<countries.length; i++) {
        let country = countries[i];
        let armies = await database.ref('games/'+context.game+'/countryInfo/'+country+'/armies').once('value');
		armies = armies.val();
		if (!armies) {
			armies = [];
		}
		for (let j=0; j<armies.length; j++) {
			if (!Object.keys(t).includes(armies[j]['territory'])) {
				t[armies[j]['territory']]=new Array(6).fill(0).map(x => [0,0,0]);
			}
			if (armies[j]['hostile']===undefined || armies[j]['hostile']==="" || armies[j]['hostile']) {
				t[armies[j]['territory']][i][1]+=1;
			}
			else {
				t[armies[j]['territory']][i][2]+=1;
			}
		}
	}
	for (var key in t) {
        let coord = await database.ref('setup/territories/'+key+'/unitCoords').once('value');
        coord = coord.val();
		un.push([coord,t[key]]);
	}
	res.send(un);
});

// done
router.get("/getSeaFactories/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let fc = [];
    let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
    countryInfo = countryInfo.val();

	for (let key in countryInfo) {
		let t=[];
        let factories = countryInfo[key].factories;
		for (let j=0; j<factories.length; j++) {
            let port = await database.ref('setup/territories/'+factories[j]+'/port').once('value');
            port = port.val();
			if (port) {
				let coord = await database.ref('setup/territories/'+factories[j]+'/factoryCoords').once('value');
				coord = coord.val();
				t.push(coord);
			}
		}
		fc.push(t);
	}
	res.send(fc);
});

// done
router.get("/getLandFactories/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let fc = [];
    let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
	countryInfo = countryInfo.val();

	for (let key in countryInfo) {
		let t=[];
		let factories = countryInfo[key].factories;
		if (!factories) {
			factories = [];
		}
		for (let j=0; j<factories.length; j++) {
            let port = await database.ref('setup/territories/'+factories[j]+'/port').once('value');
            port = port.val();
			if (!port) {
				console.log(factories[j])
				let coord = await database.ref('setup/territories/'+factories[j]+'/factoryCoords').once('value');
				coord = coord.val();
				t.push(coord);
			}
		}
		fc.push(t);
	}
	console.log(fc);
	res.send(fc);
});

router.get("/getTaxChips/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
    let tx = [];
    let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
    countryInfo = countryInfo.val();

	for (let key in countryInfo) {
		let t=[];
		let tax = countryInfo[key].taxChips;
		if (!tax) {
			tax=[];
		}
		for (let j=0; j<tax.length; j++) {
            let port = await database.ref('setup/territories/'+tax[j]+'/port').once('value');
            port = port.val();
			if (!port) {
				let coord = await database.ref('setup/territories/'+tax[j]+'/taxChipCoords').once('value');
				coord = coord.val();
				t.push(coord);
			}
		}
		tx.push(t);
	}
	res.send(tx);
});

module.exports = router;