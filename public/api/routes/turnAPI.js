var express = require("express");
var router = express.Router();
const database = require('./firebase');

// done
router.get("/getTurnTitle/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let name = context.name;
	let players = await database.ref('games/'+context.game+'/playerInfo').once('value');
	players = Object.keys(players.val());
	if (!players.includes(name)) {
		res.send("Log in as a player to take your turn.");
		return;
	}
	let myTurn = await database.ref('games/'+context.game+'/playerInfo/'+name+'/myTurn').once('value');
	myTurn = myTurn.val();
	console.log("myTurn", name, myTurn);
	if (myTurn) {
		res.send("Take Your Turn.")
	}
	else {
		res.send("Not Your Turn.");
	}
});

// done
router.get("/getMode/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let mode = await database.ref('games/'+context.game+'/mode').once('value');
	mode = mode.val();
	let turn = await database.ref('games/'+context.game+'/playerInfo/'+context.name+"/myTurn").once('value');
	turn = turn.val();
	if (context.name && turn) {
		res.send(mode);
	}
	else {
		res.send("non-turn");
	}
});

// done
router.get("/getTurnID/:context", async function(req, res, next) {
	let context = JSON.parse(req.params.context);
	let round = await database.ref('games/'+context.game+'/round').once('value');
	round = round.val();
	let mode = await database.ref('games/'+context.game+'/mode').once('value');
	mode = mode.val();
	let country = await database.ref('games/'+context.game+'/countryUp').once('value');
	country = country.val();
	let actionNumber = await database.ref('games/'+context.game+'/actionNumber').once('value');
	actionNumber = actionNumber.val();
	res.send(round+mode+country+actionNumber);
});

// fix
router.get("/getNonTurnMessage/:context", function(req, res, next) {
    res.send("Bear 1 proposed blah.");
});

module.exports = router;