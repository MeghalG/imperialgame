import React from 'react';
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

class EnterApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			choices: [],
			newGame: false,
			newGameID: '',
			newGamePlayers: ['', '', '', '', '', ''],
			validNewGame: false,
		};
	}

	componentDidMount() {
		this.gamesRef = database.ref('games');
		this.gamesRef.on('child_added', (dataSnapshot) => {
			this.getChoices();
		});
		this.gamesRef.on('child_removed', (dataSnapshot) => {
			this.getChoices();
		});
	}

	componentWillUnmount() {
		if (this.gamesRef) {
			this.gamesRef.off();
		}
	}

	async getChoices() {
		let ids = await miscAPI.getGameIDs();
		this.setState({ choices: ids });
	}

	handleClick(value) {
		this.context.setGame(value);
		localStorage.setItem('game', value);
	}

	async updateID(e) {
		await this.setState({ newGameID: e.target.value });
		this.setState({ validNewGame: await this.validGame() });
	}

	async updatePlayers(e, i) {
		let t = this.state.newGamePlayers;
		t[i] = e.target.value;
		await this.setState({ newGamePlayers: t });
		this.setState({ validNewGame: await this.validGame() });
	}

	async validGame() {
		await this.getChoices();
		if (!this.state.newGameID || this.state.choices.includes(this.state.newGameID)) {
			return false;
		}
		let count = 0;
		for (let i in this.state.newGamePlayers) {
			if (this.state.newGamePlayers[i]) {
				count += 1;
			}
		}
		let s = new Set(this.state.newGamePlayers);
		s.delete('');
		if (s.size === count && count >= 1) {
			return true;
		}
		return false;
	}

	async makeNewGame() {
		await submitAPI.newGame(this.state);
		this.context.setGame(this.state.newGameID);
	}

	newGame() {
		if (this.state.newGame) {
			return (
				<Card style={{ lineHeight: 3, backgroundColor: '#202020', width: '420px', textAlign: 'center' }}>
					<Row>
						<Col span={11} style={{ textAlign: 'right' }}>
							Choose a Game ID:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
						</Col>
						<Col span={13}>
							<Input
								allowClear={true}
								onChange={(e) => this.updateID(e)}
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
								onChange={(e) => this.updatePlayers(e, 0)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
							<Input
								placeholder="Player 2"
								allowClear={true}
								onChange={(e) => this.updatePlayers(e, 1)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
							<Input
								placeholder="Player 3"
								allowClear={true}
								onChange={(e) => this.updatePlayers(e, 2)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
							<Input
								placeholder="Player 4"
								allowClear={true}
								onChange={(e) => this.updatePlayers(e, 3)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
							<Input
								placeholder="Player 5"
								allowClear={true}
								onChange={(e) => this.updatePlayers(e, 4)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
							<Input
								placeholder="Player 6"
								allowClear={true}
								onChange={(e) => this.updatePlayers(e, 5)}
								style={{ background: 'black', width: '200px' }}
							></Input>
							<br />
						</Col>
					</Row>
					<Button type="primary" disabled={!this.state.validNewGame} onClick={() => this.makeNewGame()}>
						{' '}
						Create{' '}
					</Button>
				</Card>
			);
		} else {
			return (
				<Button onClick={() => this.setState({ newGame: true })} shape="circle">
					{' '}
					+{' '}
				</Button>
			);
		}
	}

	buildOptions() {
		let table = [];
		let t = [];
		for (let i in this.state.choices) {
			t.push(<Button onClick={() => this.handleClick(this.state.choices[i])}> {this.state.choices[i]} </Button>);
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
					<Space size="middle"> {this.newGame()} </Space>{' '}
				</Col>{' '}
			</Row>
		);

		return table;
	}

	render() {
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
							<Card style={{ height: 'calc(100vh + -135px)', overflow: 'auto', lineHeight: '4' }}>
								{this.buildOptions()}
							</Card>
						</TabPane>
						<TabPane tab="Rules" key="2">
							<RulesApp />
						</TabPane>
					</Tabs>
				</Content>
			</Layout>
		);
	}
}
EnterApp.contextType = UserContext;

export default EnterApp;
