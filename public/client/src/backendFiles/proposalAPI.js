import { useImperativeHandle } from 'react';
import {database} from './firebase.js';
import * as helper from './helper.js';

// done, needs checking
async function getPreviousProposalMessage(context) {
	let gameState = await database.ref('games/'+context.game).once('value');
	gameState = gameState.val();
	let country = gameState.countryUp;
	let opp = gameState.countryInfo[country].leadership[1];
	let history = gameState.history;

	if (opp == context.name && gameState.mode =='proposal') {
		return history[history.length-1];
	}
	else if (gameState.mode=='continue-man') {
		return gameState.currentManeuver;
	}
	else {
		return "";
	}
}

// done, needs checking
async function getWheelOptions(context) {
	let gameState = await database.ref('games/'+context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/'+context.game+'/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let currentPos = gameState.countryInfo[country].wheelSpot;
	let money = gameState.playerInfo[context.name].money;
	let wheel = await database.ref(setup+'/wheel').once('value');
	wheel = wheel.val();
	if (currentPos == 'center') {
		return wheel;
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
		return t;
	}
}

// done, needs checking
async function getLocationOptions(context) {
	let setup = await database.ref('games/'+context.game+'/setup').once('value');
	setup = setup.val();
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
	countryInfo = countryInfo.val();
	let territories = await database.ref(setup+'/territories').once('value');
	territories = territories.val();
	let factories = countryInfo[country].factories;
	let opts = [];
	let sat = helper.getSat(countryInfo, country);
	for (let key in territories) {
		if (territories[key].country==country) {
			if (!sat.includes(key) && !factories.includes(key)) {
				opts.push(key)
			}
		}
	}
	return opts;
}

// done, needs checking
async function getFleetProduceOptions (context) {
	let gameState = await database.ref('games/'+context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/'+context.game+'/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territories = await database.ref(setup+'/territories').once('value');
	territories = territories.val();
	let countrysetup = await database.ref(setup+'/countries').once('value');
	countrysetup = countrysetup.val();
	let fleets = gameState.countryInfo[country].fleets;
	if (!fleets) {
		fleets = [];
	}

	let unsatFactories = helper.getUnsatFactories(gameState.countryInfo, country);
	let t = [];
	for (let i in unsatFactories) {
		if (territories[unsatFactories[i]].port) {
			t.push(unsatFactories[i])
		}
	}
	return {
		items: t,
		limit: countrysetup[country].fleetLimit-fleets.length,
	};
}

// done, needs checking
async function getArmyProduceOptions(context) {
	let gameState = await database.ref('games/'+context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/'+context.game+'/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territories = await database.ref(setup+'/territories').once('value');
	territories = territories.val();
	let countrysetup = await database.ref(setup+'/countries').once('value');
	countrysetup = countrysetup.val();
	let armies = gameState.countryInfo[country].armies;
	if (!armies) {
		armies = [];
	}

	let unsatFactories = helper.getUnsatFactories(gameState.countryInfo, country);
	let t = [];
	for (let i in unsatFactories) {
		if (!territories[unsatFactories[i]].port) {
			t.push(unsatFactories[i]);
		}
	}
	return{
		items: t,
		limit: countrysetup[country].armyLimit-armies.length,
	};
}

// done, needs checking
async function getInvestorMessage(context) {
	let gameState = await database.ref('games/'+context.game).once('value');
	gameState = gameState.val();
	let country = gameState.countryUp;
	let s = "The investor will pay out ";

	let amt = helper.getInvestorPayout(gameState, country, context.name);
	let msgs = amt.map(x => "$" +x[1]+ " to " +x[0]);
	s+=msgs.join(", ")
	s+="."
	return s;
}

// done, needs checking
async function getTaxMessage(context) {
	let gameState = await database.ref('games/'+context.game).once('value');
	gameState = gameState.val();
	let country = gameState.countryUp;

	let taxInfo = await helper.getTaxInfo(gameState.countryInfo, gameState.playerInfo, country);
	let s = country+ " will tax for " +taxInfo.points+ " points, and $" +taxInfo.money+ " into its treasury. Greatness is distributed ";
	let splits = taxInfo['tax split'].map(x => "$" +x[1]+ " to " +x[0]).join(", ");
	if (splits=="") {
		splits = "to no one";
	}
	s+= splits + "."
	
	return s;
}

function getAdjacentSeas(fleet, territorySetup) {
	if (territorySetup[fleet].port) {
		return [fleet, territorySetup[fleet].port];
	}
	let adjacencies = territorySetup[fleet].adjacencies;
	let ans = [fleet];
	for (let a of adjacencies) {
		if (territorySetup[a].sea) {
			ans.push(a);
		}
	}
	return ans;
}

// fix
async function getFleetOptions(context) {
	let gameState = await database.ref('games/'+context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/'+context.game+'/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territorySetup = await database.ref(setup+'/territories').once('value');
	territorySetup = territorySetup.val();
	
	let choices = [];
	for (let fleet of (gameState.countryInfo[country].fleets || [])) {
		let opts = getAdjacentSeas(fleet.territory, territorySetup);
		choices.push([fleet.territory, opts]);
	}

	return choices;
}

// fix
async function getFleetPeaceOptions(context) {
	let gameState = await database.ref('games/'+context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/'+context.game+'/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territorySetup = await database.ref(setup+'/territories').once('value');
	territorySetup = territorySetup.val();
	let damage = {};

	for (let territory in territorySetup) {
		damage[territory] = [];
	}
	for (let c in gameState.countryInfo) {
		if (c!=country) {
			for (let a of (gameState.countryInfo[c].armies || [])) {
				if (a.hostile) {
					damage[a.territory].push(c+ " army");
				}
			}
			for (let f of (gameState.countryInfo[c].fleets || [])) {
				if (f.hostile) {
					damage[f.territory].push(c+ " fleet");
				}
			}
		}
		
	}
	let d = {};
	for (let key in damage) {
		if (damage[key].length!=0) {
			d[key]=damage[key].map(x => "war " +x);
			d[key].push("peace");
		}
	}
	// remove chosen options
	for (let i in context.fleetMan) {
		if (context.fleetMan[i][1] && context.fleetMan[i][2] && context.fleetMan[i][2]!="peace") {
			d[context.fleetMan[i][1]].splice(d[context.fleetMan[i][1]].indexOf(context.fleetMan[i][2]),1);
		}
	}

	return d;
}

// not in use
// the actions so far are submittable with at least 1 peace (so shouldn't move onto armies instead)
async function legalFleetMove(context) {
	let peaceOptions = getFleetPeaceOptions(context);
	let legal = true;
	for (let i in context.fleetMan) {
		if (context.fleetPeace[i]=="" && context.fleetMan[i]) {
			if ((peaceOptions[context.fleetMan[i]] || []).length>1) {
				legal = false;
			}
		}
	}
	return legal && context.fleetPeace.includes("peace");
}

// not in use
// the actions move all the fleets without peace proposals (so armies can be moved)
async function allFleetsNoPeace(context) {
	let peaceOptions = await getFleetPeaceOptions(context);
	let legal = true;
	for (let i in context.fleetMan) {
		if (!context.fleetMan[i]) {
			legal = false;
		}
		if (context.fleetPeace[i]=="" && context.fleetMan[i]) {
			if ((peaceOptions[context.fleetMan[i]] || []).length>1) {
				legal = false;
			}
		}
	}
	return legal && !context.fleetPeace.includes("peace");
}

// the actions move all the fleets (so armies can be moved)
async function allFleetsMoved(context) {
	let peaceOptions = await getFleetPeaceOptions(context);
	let legal = true;
	for (let i in context.fleetMan) {
		if (!context.fleetMan[i][1]) {
			legal = false;
		}
		if (context.fleetMan[i][2]=="" && context.fleetMan[i][1]) {
			if ((peaceOptions[context.fleetMan[i][1]] || []).length>1) {
				legal = false;
			}
		}
	}
	return legal;
}

// add adjacent seas
function getD0(army, territorySetup, country, context) {
	let d0 = [army];
	let q = [army];

	while (q.length>0) {
		let a = q.pop();
		let adjacencies = territorySetup[a].adjacencies;
		for (let adj of adjacencies) {
			let sea = false;
			if (territorySetup[adj].sea) {
				for (let x of context.fleetMan) {
					if (x[1]==adj && (x[2]=="peace" || x[2]=="")) {
						sea = true;
					}
				}
			}
			if ((territorySetup[adj].country == country && territorySetup[a].country == country) || sea) {
				if (!d0.includes(adj)) {
					d0.push(adj);
					q.push(adj);
				}
			}
		}
	}

	return d0;
}

function getAdjacentLands(army, territorySetup, country, context) {
	let d0 = getD0(army, territorySetup, country, context);
	let ans = [];

	for (let t of d0) {
		let adj = [...territorySetup[t].adjacencies];
		adj.push(t);

		for (let a of adj) {
			let d0a = getD0(a, territorySetup, country, context);
			for (let elt of d0a) {
				if (!territorySetup[elt].sea) {
					ans.push(elt);
				}
			}
		}
	}
	ans = Array.from(new Set(ans));
	return ans;
}

// done, needs checking
async function getArmyOptions(context) {
	let gameState = await database.ref('games/'+context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/'+context.game+'/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territorySetup = await database.ref(setup+'/territories').once('value');
	territorySetup = territorySetup.val();
	
	let choices = [];
	for (let army of (gameState.countryInfo[country].armies || [])) {
		let opts = getAdjacentLands(army.territory, territorySetup, country, context);
		choices.push([army.territory, opts]);
	}

	return choices;
}

// fix
async function getArmyPeaceOptions(context) {
	let gameState = await database.ref('games/'+context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/'+context.game+'/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let territorySetup = await database.ref(setup+'/territories').once('value');
	territorySetup = territorySetup.val();
	let damage = {};

	for (let territory in territorySetup) {
		damage[territory] = [];
	}
	for (let c in gameState.countryInfo) {
		if (c!=country) {
			for (let a of (gameState.countryInfo[c].armies || [])) {
				damage[a.territory].push(c+ " army");
			}
			for (let f of (gameState.countryInfo[c].fleets || [])) {
				damage[f.territory].push(c+ " fleet");
			}
		}
		
	}
	let d = {};
	for (let key in damage) {
		d[key]=damage[key].map(x => "war " +x);
		d[key].push("peace");

		if (territorySetup[key].country && territorySetup[key].country!=country) {
			d[key].push("hostile");
		}
		if (territorySetup[key].country && territorySetup[key].country!=country && gameState.countryInfo[territorySetup[key].country].factories.includes(key)) {
			d[key].push("blow up " +territorySetup[key].country);
		}
	}
	// remove chosen options
	for (let i in context.fleetMan) {
		if (context.fleetMan[i][1] && context.fleetMan[i][2] && context.fleetMan[i][2]!="peace" && context.fleetMan[i][2]!="hostile" && context.fleetMan[i][2].substring(0,7)!="blow up") {
			d[context.fleetMan[i][1]].splice(d[context.fleetMan[i][1]].indexOf(context.fleetMan[i][2]),1);
		}
	}
	for (let i in context.armyMan) {
		if (context.armyMan[i][1] && context.armyMan[i][2] && context.armyMan[i][2]!="peace" && context.armyMan[i][2]!="hostile" && context.armyMan[i][2].substring(0,7)!="blow up") {
			d[context.armyMan[i][1]].splice(d[context.armyMan[i][1]].indexOf(context.armyMan[i][2]),1);
		}
	}

	return d;
}

// the actions move all the fleets without peace proposals (so armies can be moved)
async function allArmiesMoved(context) {
	let peaceOptions = await getArmyPeaceOptions(context);
	let legal = true;
	for (let i in context.armyMan) {
		if (!context.armyMan[i][1]) {
			legal = false;
		}
		if (context.armyMan[i][2]=="" && context.armyMan[i][1]) {
			if ((peaceOptions[context.armyMan[i][1]] || []).length>1) {
				legal = false;
			}
		}
	}
	return legal;
}

// the actions so far are submittable
function legalArmyMove(context) {
	return true;
}

// the actions move all the fleets without peace proposals (so armies can be moved)
function allArmiesNoPeace(context) {
	return true;
}

// fix
async function getImportOptions(context) {
	let gameState = await database.ref('games/'+context.game).once('value');
	gameState = gameState.val();
	let setup = await database.ref('games/'+context.game+'/setup').once('value');
	setup = setup.val();
	let country = gameState.countryUp;
	let countrysetup = await database.ref(setup+'/countries').once('value');
	countrysetup = countrysetup.val();

	let armyLocs = await helper.getUnsatTerritories(gameState.countryInfo, country, false, context);
	let fleetLocs = await helper.getUnsatTerritories(gameState.countryInfo, country, true, context);

	let armies = gameState.countryInfo[country].armies;
	if (!armies) {
		armies = [];
	}

	let fleets = gameState.countryInfo[country].fleets;
	if (!fleets) {
		fleets = [];
	}

	return {
		labels: ["Import #1", "Import #2", "Import #3"],
		options: {
			army: armyLocs,
			fleet: fleetLocs,
		},
		limits: {
			army: countrysetup[country].armyLimit-armies.length,
			fleet: countrysetup[country].fleetLimit-fleets.length
		},
	};
}

export {getPreviousProposalMessage, getWheelOptions, getLocationOptions, getFleetProduceOptions, getArmyProduceOptions, getInvestorMessage, getTaxMessage, getFleetOptions, getFleetPeaceOptions, allFleetsMoved, getArmyOptions, getArmyPeaceOptions, allArmiesMoved, getImportOptions};