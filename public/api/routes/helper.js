const database = require('./firebase');

async function getCountries() {
	let countries = await database.ref('setup/countries').once('value');
	countries = countries.val();
	let t = [null, null, null, null, null, null];
	for (key in countries) {
		t[countries[key].order-1]=key;
	}
	return t;
}

// done, needs checking
function getOwnedStock(leadership, playerInfo, country) {
	let amt = [];
	for (let i in leadership) {
		let t = 0;
		for (i in playerInfo[leadership[i]].stock) {
			if (playerInfo[leadership[i]].stock[i].country == country) {
				t += playerInfo[leadership[i]].stock[i].stock;
			}
		}
		amt.push([leadership[i], t]);
	}
	return amt;
}

// done, needs checking
// gets a list of every territory being sat on currently (has multiplicity)
function getSat(countryInfo) {
	let sat = [];
	for (let key in countryInfo) {
		for (let i in countryInfo[key].armies) {
			if (countryInfo[key].armies[i].hostile) {
				sat.push(countryInfo[key].armies[i].territory)
			}
		}
	}
	return sat;
}

// done, needs checking
function getUnsatFactories(countryInfo, country) {
	let sat = getSat(countryInfo);
	let factories = countryInfo[country].factories;
	let opts = [];
	for (let i in factories) {
		if (!sat.includes(key)) {
			opts.push(factories[i])
		}
	}
	return opts;
}

// done, needs checking
function getTaxSplit(money, countryInfo, playerInfo, country) {
	let leadership = countryInfo[country].leadership;
	let stockOwned = helper.getOwnedStock(leadership, playerInfo, country);
	let arr = [];
	for (let i in stockOwned) {
		for (let j=0; j<money; j++) {
			// decimal approximation might be an issue
			arr.push([stockOwned[i][0],stockOwned[i][0],j])
		}
	}
	arr.sort((a, b) => b[1]*a[2]-a[1]*b[2]);
	let taxSplit = [];
	let taxDict = {};

	for (let i=0; i<money; i++) {
		if (!Object.keys(taxDict).includes(arr[i][0])) {
			taxDict[arr[i][0]] = 0;
		}
		taxDict[arr[i][0]]+=1;
	}
	for (let i in leadership) {
		if (Object.keys(taxDict).includes(leadership[i])) {
			taxSplit.push([leadership[i], taxDict[leadership[i]]]);
		}
	}
	return taxSplit;
}

// done, needs checking
function getTaxInfo(countryInfo, playerInfo, country) {
	let ans = {}
	let countryMoney = countryInfo[country].money;
	let numUnits = countryInfo.fleets.length+countryInfo.armies;
	let taxChips = countryInfo[country].taxChips.length;
	let factories = getUnsatFactories(countryInfo, country).length*2
	let points = taxChips + factories;
	let money = points - numUnits;
	if (countryMoney+money < 0) {
		money = (0-countryMoney);
	}
	ans['points'] = points-5;
	let playerMoney = Math.min(Math.max(points - countryInfo[country].lastTax, 0), countryMoney+money);
	ans['money'] = money-playerMoney;
	ans['tax split'] = getTaxSplit(playerMoney, countryInfo, playerInfo, country);
	return ans;
}

// fix to remove used stock
async function getStockBelow(price, countryInfo) {
	let stockCosts = await database.ref('setup/stockCosts').once('value');
	stockCosts = stockCosts.val();
	let availStock = countryInfo['availStock'];
	console.log(availStock);
	console.log(stockCosts)
	let i=0;
	while (stockCosts[i]<=price && i<=stockCosts.length) {
		i+=1;
	}
	while (!availStock.includes(i-1)) {
		i-=1;
		if (i==1) {
			break;
		}
	}
	return i-1;
}

exports.getCountries = getCountries;
exports.getOwnedStock = getOwnedStock;
exports.getSat = getSat;
exports.getUnsatFactories = getUnsatFactories;
exports.getTaxSplit = getTaxSplit;
exports.getTaxInfo = getTaxInfo;
exports.getStockBelow = getStockBelow;