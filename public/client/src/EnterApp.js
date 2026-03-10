import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './App.css';
import './MapOverlay.css';
import UserContext from './UserContext.js';
import LoginApp from './LoginApp.js';
import RulesApp from './RulesApp.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { database } from './backendFiles/firebase.js';

function EnterApp() {
	const context = useContext(UserContext);
	const [choices, setChoices] = useState([]);
	const [newGameVisible, setNewGameVisible] = useState(false);
	const [newGameID, setNewGameID] = useState('');
	const [newGamePlayers, setNewGamePlayers] = useState(['', '', '', '', '', '']);
	const [validNewGame, setValidNewGame] = useState(false);
	const [activeTab, setActiveTab] = useState('games');
	const gamesRef = useRef(null);
	const choicesRef = useRef(choices);
	choicesRef.current = choices;

	const getChoices = useCallback(async () => {
		let ids = await miscAPI.getGameIDs();
		setChoices(ids);
		return ids;
	}, []);

	useEffect(() => {
		gamesRef.current = database.ref('games');
		gamesRef.current.on('child_added', () => {
			getChoices();
		});
		gamesRef.current.on('child_removed', () => {
			getChoices();
		});
		return () => {
			if (gamesRef.current) {
				gamesRef.current.off();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function handleClick(value) {
		context.setGame(value);
		localStorage.setItem('game', value);
	}

	async function updateID(e) {
		let id = e.target.value;
		setNewGameID(id);
		let ids = await getChoices();
		setValidNewGame(checkValidGame(id, newGamePlayers, ids));
	}

	async function updatePlayers(e, i) {
		let t = [...newGamePlayers];
		t[i] = e.target.value;
		setNewGamePlayers(t);
		let ids = await getChoices();
		setValidNewGame(checkValidGame(newGameID, t, ids));
	}

	function checkValidGame(id, players, ids) {
		if (!id || ids.includes(id)) {
			return false;
		}
		let count = 0;
		for (let i in players) {
			if (players[i]) {
				count += 1;
			}
		}
		let s = new Set(players);
		s.delete('');
		if (s.size === count && count >= 1) {
			return true;
		}
		return false;
	}

	async function makeNewGame() {
		await submitAPI.newGame({ newGameID, newGamePlayers });
		context.setGame(newGameID);
	}

	return (
		<div className="imp-lobby">
			{/* Top bar with login */}
			<div className="imp-lobby__topbar">
				<LoginApp />
			</div>

			{/* Header */}
			<div className="imp-lobby__header">
				<div className="imp-lobby__title">Imperial</div>
				<div className="imp-lobby__divider" />
				<div className="imp-lobby__subtitle">A Game of European Diplomacy & Investment</div>
			</div>

			{/* Tab navigation */}
			<div className="imp-lobby__tabs">
				<button
					className={'imp-lobby__tab' + (activeTab === 'games' ? ' imp-lobby__tab--active' : '')}
					onClick={() => setActiveTab('games')}
				>
					Join a Game
				</button>
				<button
					className={'imp-lobby__tab' + (activeTab === 'rules' ? ' imp-lobby__tab--active' : '')}
					onClick={() => setActiveTab('rules')}
				>
					Rules
				</button>
			</div>

			{/* Content */}
			<div className="imp-lobby__content">
				{activeTab === 'games' && (
					<React.Fragment>
						{/* Existing games */}
						{choices.length > 0 && (
							<React.Fragment>
								<div className="imp-lobby__section-title">Active Games</div>
								<div className="imp-lobby__games">
									{choices.map((id) => (
										<div key={id} className="imp-lobby__game-card" onClick={() => handleClick(id)}>
											{id}
										</div>
									))}
								</div>
							</React.Fragment>
						)}

						{/* New game */}
						<div className="imp-lobby__section-title">New Game</div>
						{!newGameVisible ? (
							<button className="imp-lobby__new-game-toggle" onClick={() => setNewGameVisible(true)}>
								<i className="fas fa-plus-circle" /> Create a New Game
							</button>
						) : (
							<div className="imp-lobby__new-game">
								<div className="imp-lobby__form-row">
									<span className="imp-lobby__form-label">Game ID</span>
									<input
										className="imp-lobby__form-input"
										placeholder="Choose a unique name"
										onChange={(e) => updateID(e)}
									/>
								</div>
								{[0, 1, 2, 3, 4, 5].map((i) => (
									<div key={i} className="imp-lobby__form-row">
										<span className="imp-lobby__form-label">Player {i + 1}</span>
										<input
											className="imp-lobby__form-input"
											placeholder={i === 0 ? 'Required' : 'Optional'}
											onChange={(e) => updatePlayers(e, i)}
										/>
									</div>
								))}
								<button className="imp-lobby__create-btn" disabled={!validNewGame} onClick={() => makeNewGame()}>
									Create Game
								</button>
							</div>
						)}
					</React.Fragment>
				)}

				{activeTab === 'rules' && (
					<div style={{ background: '#141518', borderRadius: 8, padding: 20 }}>
						<RulesApp />
					</div>
				)}
			</div>
		</div>
	);
}

export default EnterApp;
