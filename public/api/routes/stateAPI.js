var express = require("express");
var router = express.Router();
const database = require('./firebase');
const helper = require('./helper');

router.get("/getCountryInfo/:context", async function(req, res, next) {
    let context = JSON.parse(req.params.context);
	let countryInfo = await database.ref('games/'+context.game+'/countryInfo').once('value');
	countryInfo = countryInfo.val();
	res.send(countryInfo);
});

// fix
function getCashValue(info) {
    return 5;
}

router.get("/getPlayerInfo/:context", async function(req, res, next) {
    let context = JSON.parse(req.params.context);
	let playerInfo = await database.ref('games/'+context.game+'/playerInfo').once('value');
    playerInfo = playerInfo.val();
    for (let key in playerInfo) {
        playerInfo[key]['cashValue']=getCashValue(playerInfo[key]);
    }
	res.send(playerInfo);
});

router.get("/getPlayersInOrder/:context", async function(req, res, next) {
    let context = JSON.parse(req.params.context);
	let playerInfo = await database.ref('games/'+context.game+'/playerInfo').once('value');
    playerInfo = playerInfo.val();
    t = [null, null, null, null, null, null];
    for (let key in playerInfo) {
        t[playerInfo[key]['order']-1]=key;
    }
    console.log("t", t);
	res.send(t);
});


module.exports = router;