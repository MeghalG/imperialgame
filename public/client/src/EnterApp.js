import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './App.css';
import UserContext from './UserContext.js';
import LoginApp from './LoginApp.js';
import RulesApp from './RulesApp.js';
import { Button, Space } from 'antd';
import { Card } from 'antd';
import { Layout } from 'antd';
import { Tabs, Col, Row } from 'antd';
import { Input } from 'antd';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { database } from './backendFiles/firebase.js';

const { Header, Content } = Layout;
const { TabPane } = Tabs;

function EnterApp() {
	const context = useContext(UserContext);
	const [choices, setChoices] = useState([]);
	const [newGameVisible, setNewGameVisible] = useState(false);
	const [newGameID, setNewGameID] = useState('');
	const [newGamePlayers, setNewGamePlayers] = useState(['', '', '', '', '', '']);
	const [validNewGame, setValidNewGame] = useState(false);
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
		gamesRef.current.on('child_added', (dataSnapshot) => {
			getChoices();
		});
		gamesRef.current.on('child_removed', (dataSnapshot) => {
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

	function newGame() {
		if (newGameVisible) {
			return (
				<Card style={{ lineHeight: 3, backgroundColor: '#202020', width: '420px', textAlign: 'center' }}>
					<Row>
						<Col span={11} style={{ textAlign: 'right' }}>
							Choose a Game ID:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
						</Col>
						<Col span={13}>
							<Input
								allowClear={true}
								onChange={(e) => updateID(e)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
						</Col>
					</Row>
					<Row>
						<Col span={11} style={{ textAlign: 'right' }}>
							Input upto 6 players:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
						</Col>
						<Col span={13}>
							<Input
								placeholder="Player 1"
								allowClear={true}
								onChange={(e) => updatePlayers(e, 0)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
							<Input
								placeholder="Player 2"
								allowClear={true}
								onChange={(e) => updatePlayers(e, 1)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
							<Input
								placeholder="Player 3"
								allowClear={true}
								onChange={(e) => updatePlayers(e, 2)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
							<Input
								placeholder="Player 4"
								allowClear={true}
								onChange={(e) => updatePlayers(e, 3)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
							<Input
								placeholder="Player 5"
								allowClear={true}
								onChange={(e) => updatePlayers(e, 4)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
							<Input
								placeholder="Player 6"
								allowClear={true}
								onChange={(e) => updatePlayers(e, 5)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
						</Col>
					</Row>
					<Button type="primary" disabled={!validNewGame} onClick={() => makeNewGame()}>
						{' '}
						Create{' '}
					</Button>
				</Card>
			);
		} else {
			return (
				<Button onClick={() => setNewGameVisible(true)} shape="circle">
					{' '}
					+{' '}
				</Button>
			);
		}
	}

	function buildOptions() {
		let table = [];
		let t = [];
		for (let i in choices) {
			t.push(<Button onClick={() => handleClick(choices[i])}> {choices[i]} </Button>);
		}
		table.push(
			<Row>
				{' '}
				<Col span={10} style={{ textAlign: 'right' }}>
					{' '}
					<label>Select a game by ID: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</label>{' '}
				</Col>{' '}
				<Col span={10}>
					<Space size="middle"> {t} </Space>
				</Col>
			</Row>
		);
		table.push(
			<Row>
				{' '}
				<Col span={10} style={{ textAlign: 'right' }}>
					{' '}
					Make a new game: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{' '}
				</Col>{' '}
				<Col span={13}>
					{' '}
					<Space size="middle"> {newGame()} </Space>{' '}
				</Col>{' '}
			</Row>
		);

		return table;
	}

	return (
		<Layout style={{ fontFamily: 'Arial' }}>
			<Header
				style={{ position: 'fixed', zIndex: 1, width: '100%', fontSize: 'calc(10px + 2vmin)', display: 'inline' }}
			>
				Welcome to Imperial!
				<span style={{ float: 'right', fontSize: 14 }}>
					<LoginApp />
				</span>
			</Header>
			<Content className="site-layout" style={{ padding: '0vh 3vw', marginTop: 64 }}>
				<Tabs defaultActiveKey="1" centered>
					<TabPane tab="Join a Game" key="1">
						<Card style={{ height: 'calc(100vh + -135px)', overflow: 'auto', lineHeight: '4' }}>{buildOptions()}</Card>
					</TabPane>
					<TabPane tab="Rules" key="2">
						<RulesApp />
					</TabPane>
				</Tabs>
			</Content>
		</Layout>
	);
}

export default EnterApp;
