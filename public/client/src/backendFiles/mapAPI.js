import { database } from './firebase.js';
import * as helper from './helper.js';

// done but needs checking
async function getUnits(context) {
	let un = [];
	let countries = await helper.getCountries(context);
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let territorySetup = await database.ref(setup + '/territories').once('value');
	territorySetup = territorySetup.val();

	let t = {};
	for (let i = 0; i < countries.length; i++) {
		let country = countries[i];
		let fleets = countryInfo[country].fleets;
		if (!fleets) {
			fleets = [];
		}
		for (let j = 0; j < fleets.length; j++) {
			if (!Object.keys(t).includes(fleets[j]['territory'])) {
				t[fleets[j]['territory']] = new Array(6).fill(0).map((x) => [0, 0, 0]);
			}
			t[fleets[j]['territory']][i][0] += 1;
		}
	}
	for (let i = 0; i < countries.length; i++) {
		let country = countries[i];
		let armies = countryInfo[country].armies;
		if (!armies) {
			armies = [];
		}
		for (let j = 0; j < armies.length; j++) {
			if (!Object.keys(t).includes(armies[j]['territory'])) {
				t[armies[j]['territory']] = new Array(6).fill(0).map((x) => [0, 0, 0]);
			}
			if (armies[j]['hostile'] === undefined || armies[j]['hostile'] === '' || armies[j]['hostile']) {
				t[armies[j]['territory']][i][1] += 1;
			} else {
				t[armies[j]['territory']][i][2] += 1;
			}
		}
	}
	for (let key in t) {
		let coord = territorySetup[key].unitCoords;
		un.push([coord, t[key]]);
	}
	return un;
}

// done
async function getSeaFactories(context) {
	let fc = [];
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let countries = await helper.getCountries(context);
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let territorySetup = await database.ref(setup + '/territories').once('value');
	territorySetup = territorySetup.val();

	for (let key of countries) {
		let t = [];
		let factories = countryInfo[key].factories;
		for (let j = 0; j < factories.length; j++) {
			let port = territorySetup[factories[j]].port;
			if (port) {
				let coord = territorySetup[factories[j]].factoryCoords;
				t.push(coord);
			}
		}
		fc.push(t);
	}
	return fc;
}

// done
async function getLandFactories(context) {
	let fc = [];
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let countries = await helper.getCountries(context);
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let territorySetup = await database.ref(setup + '/territories').once('value');
	territorySetup = territorySetup.val();

	for (let key of countries) {
		let t = [];
		let factories = countryInfo[key].factories;
		if (!factories) {
			factories = [];
		}
		for (let j = 0; j < factories.length; j++) {
			let port = territorySetup[factories[j]].port;
			if (!port) {
				let coord = territorySetup[factories[j]].factoryCoords;
				t.push(coord);
			}
		}
		fc.push(t);
	}
	return fc;
}

async function getTaxChips(context) {
	let tx = [];
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let countries = await helper.getCountries(context);
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let territorySetup = await database.ref(setup + '/territories').once('value');
	territorySetup = territorySetup.val();

	for (let key of countries) {
		let t = [];
		let tax = countryInfo[key].taxChips;
		if (!tax) {
			tax = [];
		}
		for (let j = 0; j < tax.length; j++) {
			let port = territorySetup[tax[j]].port;
			if (!port) {
				let coord = territorySetup[tax[j]].taxChipCoords;
				t.push(coord);
			}
		}
		tx.push(t);
	}
	return tx;
}

async function getPoints(context) {
	let p = {};
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();

	for (let key in countryInfo) {
		let point = countryInfo[key].points;
		if (!p[point]) {
			p[point] = [];
		}
		p[point].push(key);
	}
	return p;
}
async function getMoney(context) {
	let m = {};
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();

	for (let key in countryInfo) {
		m[key] = countryInfo[key].money;
	}
	return m;
}
async function getAvailStock(context) {
	let m = {};
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();

	for (let key in countryInfo) {
		m[key] = countryInfo[key].availStock || [];
	}
	return m;
}
async function getLastTax(context) {
	let m = {};
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();

	for (let key in countryInfo) {
		m[key] = countryInfo[key].lastTax;
	}
	return m;
}

async function getCurrentTax(context) {
	let tx = {};
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();

	for (let key in countryInfo) {
		let a = await helper.getTaxInfo(countryInfo, null, key);
		tx[key] = a.points + 5;
	}
	return tx;
}

async function getRondel(context) {
	let w = {};
	let countryInfo = await database.ref('games/' + context.game + '/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let setup = await database.ref('games/' + context.game + '/setup').once('value');
	setup = setup.val();
	let wheelCoords = await database.ref(setup + '/wheelCoords').once('value');
	wheelCoords = wheelCoords.val();

	for (let key in countryInfo) {
		let position = countryInfo[key].wheelSpot;
		if (position === 'center') {
			continue;
		}
		if (!w[position]) {
			w[position] = [wheelCoords[position], []];
		}
		w[position][1].push(key);
	}
	return w;
}

export {
	getUnits,
	getSeaFactories,
	getLandFactories,
	getTaxChips,
	getPoints,
	getMoney,
	getAvailStock,
	getLastTax,
	getCurrentTax,
	getRondel,
};
