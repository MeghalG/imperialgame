import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';

import EnterApp from './EnterApp.js';
import GameApp from './GameApp.js';

import UserContext from './UserContext.js';
import { clearCache } from './backendFiles/stateCache.js';

function App() {
	// Support URL params for E2E testing: ?game=xxx&name=Alice
	const urlParams = new URLSearchParams(window.location.search);
	const [game, setGameRaw] = useState(urlParams.get('game') || '');
	const [name, setNameRaw] = useState(urlParams.get('name') || '');
	const [bid, setBid] = useState(0);
	const [buyBid, setBuyBid] = useState('');
	const [buyCountry, setBuyCountry] = useState('');
	const [returnStock, setReturnStock] = useState(0);
	const [buyStock, setBuyStock] = useState('');
	const [vote, setVote] = useState('');
	const [wheelSpot, setWheelSpot] = useState('');
	const [factoryLoc, setFactoryLoc] = useState('');
	const [fleetProduce, setFleetProduce] = useState('');
	const [armyProduce, setArmyProduce] = useState('');
	const [fleetMan, setFleetMan] = useState('');
	const [armyMan, setArmyMan] = useState('');
	const [importVal, setImport] = useState({});
	const [maneuverDest, setManeuverDest] = useState('');
	const [maneuverAction, setManeuverAction] = useState('');
	const [peaceVoteChoice, setPeaceVoteChoice] = useState('');
	const [colorblindMode, setColorblindModeRaw] = useState(localStorage.getItem('colorblindMode') === 'true');

	const setGame = useCallback(
		(x) => {
			if (game !== x) {
				clearCache();
			}
			setGameRaw(x);
		},
		[game]
	);

	const setName = useCallback((x) => {
		setNameRaw(x);
	}, []);

	const setColorblindMode = useCallback((x) => {
		setColorblindModeRaw(x);
		localStorage.setItem('colorblindMode', x.toString());
	}, []);

	const resetValues = useCallback(() => {
		setBid(0);
		setBuyBid('');
		setBuyCountry('');
		setReturnStock('');
		setBuyStock('');
		setVote('');
		setWheelSpot('');
		setFactoryLoc('');
		setFleetProduce('');
		setArmyProduce('');
		setFleetMan('');
		setArmyMan('');
		setImport('');
		setManeuverDest('');
		setManeuverAction('');
		setPeaceVoteChoice('');
	}, []);

	useEffect(() => {
		setNameRaw(localStorage.getItem('name'));
		setGameRaw(localStorage.getItem('game'));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const contextValue = useMemo(
		() => ({
			host: 'localhost:9001',
			game,
			setGame,
			name,
			setName,
			resetValues,
			bid,
			setBid,
			buyBid,
			setBuyBid,
			buyCountry,
			setBuyCountry,
			returnStock,
			setReturnStock,
			buyStock,
			setBuyStock,
			vote,
			setVote,
			wheelSpot,
			setWheelSpot,
			factoryLoc,
			setFactoryLoc,
			fleetProduce,
			setFleetProduce,
			armyProduce,
			setArmyProduce,
			fleetMan,
			setFleetMan,
			armyMan,
			setArmyMan,
			import: importVal,
			setImport,
			maneuverDest,
			setManeuverDest,
			maneuverAction,
			setManeuverAction,
			peaceVoteChoice,
			setPeaceVoteChoice,
			colorblindMode,
			setColorblindMode,
			title: '',
		}),
		[
			game,
			setGame,
			name,
			setName,
			resetValues,
			bid,
			buyBid,
			buyCountry,
			returnStock,
			buyStock,
			vote,
			wheelSpot,
			factoryLoc,
			fleetProduce,
			armyProduce,
			fleetMan,
			armyMan,
			importVal,
			maneuverDest,
			maneuverAction,
			peaceVoteChoice,
			colorblindMode,
			setColorblindMode,
		]
	);

	return <UserContext.Provider value={contextValue}>{game ? <GameApp /> : <EnterApp />}</UserContext.Provider>;
}

export default App;
