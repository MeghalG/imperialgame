import React from 'react';
import './App.css';
import { Input, Divider, Button } from 'antd';
import UserContext from './UserContext.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import * as helper from './backendFiles/helper.js';
import { database } from './backendFiles/firebase.js';
import firebase from 'firebase';

class LoginApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = { validNames: [], timer: false, time: 0, myTurn: false };
	}

	componentDidMount() {
		this.doStuff();
		database.ref('games/' + this.context.game + '/turnID').on('value', async (dataSnapshot) => {
			this.doStuff();
		});
		database.ref('games/' + this.context.game + '/timer').on('child_changed', async (dataSnapshot) => {
			this.doStuff();
		});
		setInterval(
			function () {
				database.ref('/.info/serverTimeOffset').on(
					'value',
					function (offset) {
						let offsetVal = offset.val() || 0;
						let serverTime = Date.now() + offsetVal;
						this.setState({ time: serverTime });
					}.bind(this)
				);
			}.bind(this),
			500
		);
	}

	async doStuff() {
		let res = await helper.getPlayersInOrder(this.context);
		this.setState({ validNames: res });
		let timer = await helper.getTimer(this.context);
		this.setState({ timer: timer });
		let myTurn = await turnAPI.getMyTurn(this.context);
		this.setState({ myTurn: myTurn });
	}

	handleEnter(e) {
		this.context['setName'](e.target.value);
		localStorage.setItem('name', e.target.value);
		this.doStuff();
	}

	logout() {
		this.context['setName']('');
		localStorage.setItem('name', '');
	}
	exitGame() {
		this.context['setGame']('');
		localStorage.setItem('game', '');
	}
	async pause() {
		await database.ref('games/' + this.context.game + '/timer/pause').set(this.state.time);
	}
	async play() {
		await this.doStuff();
		await database
			.ref('games/' + this.context.game + '/timer/lastMove')
			.set(this.state.time - this.state.timer.pause + this.state.timer.lastMove);
		await database.ref('games/' + this.context.game + '/timer/pause').set(0);
	}
	msToTime(s) {
		s = Math.floor(s / 1000);
		let secs = s % 60;
		let mins = Math.floor(s / 60);

		return mins + ':' + secs.toString().padStart(2, '0');
	}

	buildTimer() {
		let t = [];
		if (this.state.timer.timed) {
			let ti = 0;
			if (this.state.timer.pause) {
				ti = this.state.timer.pause - this.state.timer.lastMove;
			} else {
				ti = this.state.time - this.state.timer.lastMove;
			}
			t.push(<span>{this.msToTime(ti)}</span>);

			if (this.state.timer.timed && this.state.validNames.includes(this.context.name) && this.state.myTurn) {
				let inc = 0;
				let banked = 0;
				if (this.state.timer.pause) {
					inc = Math.max(this.state.timer.increment * 1000 - this.state.timer.pause + this.state.timer.lastMove, 0);
					banked = Math.min(
						Math.max(
							this.state.timer.banked[this.context.name] * 1000 -
								this.state.timer.pause +
								this.state.timer.increment * 1000 +
								this.state.timer.lastMove,
							0
						),
						this.state.timer.banked[this.context.name] * 1000
					);
				} else {
					inc = Math.max(this.state.timer.increment * 1000 - this.state.time + this.state.timer.lastMove, 0);
					let ti =
						this.state.timer.banked[this.context.name] * 1000 -
						this.state.time +
						this.state.timer.increment * 1000 +
						this.state.timer.lastMove;
					banked = Math.min(Math.max(ti, 0), this.state.timer.banked[this.context.name] * 1000);
				}
				t.push(<Divider style={{ fontSize: '30px', marginRight: 20, marginLeft: 20 }} type="vertical" />);
				t.push(
					<span>
						{this.msToTime(inc)} + {this.msToTime(banked)}
					</span>
				);
			}
			if (this.state.timer.pause) {
				t.push(
					<Button type="link" onClick={() => this.play()}>
						{' '}
						<i class="fas fa-play"></i>{' '}
					</Button>
				);
			} else {
				t.push(
					<Button type="link" onClick={() => this.pause()}>
						{' '}
						<i class="fas fa-pause"></i>{' '}
					</Button>
				);
			}
			t.push(<Divider style={{ fontSize: '30px', marginRight: 20 }} type="vertical" />);
		}

		return t;
	}

	buildExitGame() {
		let t = [];
		if (this.context.game) {
			t.push(<Divider style={{ fontSize: '30px' }} type="vertical" />);
			t.push(
				<Button type="link" onClick={() => this.exitGame()}>
					{' '}
					Exit Game{' '}
				</Button>
			);
		}

		return t;
	}

	buildComponent() {
		let t = [];
		if (!this.context.name) {
			t.push(
				<div style={{ fontSize: '18px', textAlign: 'right' }}>
					{this.buildTimer()}
					<Input
						placeholder="Name"
						allowClear={true}
						style={{ background: 'black' }}
						onPressEnter={(e) => this.handleEnter(e)}
						style={{ width: 150 }}
					></Input>{' '}
					&nbsp;
					{this.buildExitGame()}
				</div>
			);
		} else {
			t.push(
				<div style={{ fontSize: '18px', textAlign: 'right' }}>
					{this.buildTimer()}
					{this.context.name} &nbsp;
					<Button type="link" onClick={() => this.logout()}>
						{' '}
						<i class="fas fa-sign-out-alt"></i>{' '}
					</Button>
					{this.buildExitGame()}
					&nbsp; &nbsp; &nbsp;
				</div>
			);
		}
		return t;
	}

	render() {
		return <div>{this.buildComponent()}</div>;
	}
}
LoginApp.contextType = UserContext;

export default LoginApp;
