import { database } from './firebase.js';
import * as helper from './helper.js';

//
async function getTitle(context) {
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let mode = gameState.mode;
	let country = gameState.countryUp;
	let players = [];
	for (let key in gameState.playerInfo) {
		if (gameState.playerInfo[key].myTurn) {
			players.push(key);
		}
	}

	let s = players.join(', ');
	s += ' up with ';

	switch (mode) {
		case 'bid':
			s += 'bidding on ' + country + '.';
			break;
		case 'buy-bid':
			let stock = await helper.getStockBelow(
				gameState.playerInfo[players[0]].bid,
				gameState.countryInfo[country],
				context
			);
			s += 'deciding on buying the ' + country + ' ' + stock + '.';
			break;
		case 'buy':
			s += 'a buy on ' + gameState.countryUp + ' investor.';
			break;
		case 'proposal':
			if (gameState.countryInfo[country].gov === 'dictatorship') {
				s += country + ' as autocratic leader.';
			} else {
				s += country + ' as democratic leader.';
			}
			break;
		case 'proposal-opp':
			s += country + ' as democratic opposition.';
			break;
		case 'vote':
			s += 'votes.';
			break;
		case 'continue-man':
			s += 'continuing the ' + country + ' maneuver.';
			break;
		case 'game-over':
			s = helper.getWinner(gameState) + ' has won.';
			break;
	}
	return s;
}

// done
async function getTurnTitle(context) {
	let name = context.name;
	let players = await database.ref('games/' + context.game + '/playerInfo').once('value');
	players = Object.keys(players.val());
	if (!players.includes(name)) {
		return 'Log in as a player to take your turn.';
	}
	let myTurn = await database.ref('games/' + context.game + '/playerInfo/' + name + '/myTurn').once('value');
	myTurn = myTurn.val();
	if (myTurn) {
		return 'Take Your Turn.';
	} else {
		return 'Not Your Turn.';
	}
}

// done
async function getMode(context) {
	let mode = await database.ref('games/' + context.game + '/mode').once('value');
	mode = mode.val();
	let turn = await database.ref('games/' + context.game + '/playerInfo/' + context.name + '/myTurn').once('value');
	turn = turn.val();
	if (context.name && turn) {
		return mode;
	} else {
		return 'non-turn';
	}
}

// done
// probably update turnID at the end of submit methods and listen for them instead.
async function getTurnID(context) {
	let turnID = await database.ref('games/' + context.game + '/turnID').once('value');
	turnID = turnID.val();
	return turnID;
}

async function undoable(context) {
	let undoPlayer = await database.ref('games/' + context.game + '/undo').once('value');
	undoPlayer = undoPlayer.val();
	return undoPlayer === context.name && context.name;
}

async function getMyTurn(context) {
	if (!context.name || !context.game) {
		return false;
	}
	let gameState = await database.ref('games/' + context.game).once('value');
	gameState = gameState.val();
	let myTurn = (gameState.playerInfo[context.name] || {}).myTurn;
	return myTurn;
}

export { getTitle, getTurnTitle, getMode, getTurnID, undoable, getMyTurn };
