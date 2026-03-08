import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './App.css';
import { Input, Divider, Button, Tooltip } from 'antd';
import UserContext from './UserContext.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import * as helper from './backendFiles/helper.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';

function LoginApp() {
	const context = useContext(UserContext);
	const [validNames, setValidNames] = useState([]);
	const [timer, setTimer] = useState(false);
	const [time, setTime] = useState(0);
	const [myTurn, setMyTurn] = useState(false);
	const turnRef = useRef(null);
	const timerRef = useRef(null);
	const intervalRef = useRef(null);
	const contextRef = useRef(context);
	contextRef.current = context;

	const doStuff = useCallback(async () => {
		let [res, timerData, myTurnData] = await Promise.all([
			helper.getPlayersInOrder(contextRef.current),
			helper.getTimer(contextRef.current),
			turnAPI.getMyTurn(contextRef.current),
		]);
		setValidNames(res);
		setTimer(timerData);
		setMyTurn(myTurnData);
	}, []);

	useEffect(() => {
		doStuff();
		turnRef.current = database.ref('games/' + contextRef.current.game + '/turnID');
		turnRef.current.on('value', async (dataSnapshot) => {
			invalidateIfStale(contextRef.current.game, dataSnapshot.val());
			doStuff();
		});
		timerRef.current = database.ref('games/' + contextRef.current.game + '/timer');
		timerRef.current.on('child_changed', async (dataSnapshot) => {
			doStuff();
		});
		intervalRef.current = setInterval(function () {
			database.ref('/.info/serverTimeOffset').once('value', function (offset) {
				let offsetVal = offset.val() || 0;
				let serverTime = Date.now() + offsetVal;
				setTime(serverTime);
			});
		}, 500);
		return () => {
			if (turnRef.current) turnRef.current.off();
			if (timerRef.current) timerRef.current.off();
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function handleEnter(e) {
		context['setName'](e.target.value);
		localStorage.setItem('name', e.target.value);
		doStuff();
	}

	function logout() {
		context['setName']('');
		localStorage.setItem('name', '');
	}

	function exitGame() {
		context['setGame']('');
		localStorage.setItem('game', '');
	}

	async function pause() {
		await database.ref('games/' + context.game + '/timer/pause').set(time);
	}

	async function play() {
		await doStuff();
		await database.ref('games/' + context.game + '/timer/lastMove').set(time - timer.pause + timer.lastMove);
		await database.ref('games/' + context.game + '/timer/pause').set(0);
	}

	function msToTime(s) {
		s = Math.floor(s / 1000);
		let secs = s % 60;
		let mins = Math.floor(s / 60);

		return mins + ':' + secs.toString().padStart(2, '0');
	}

	function buildTimer() {
		let t = [];
		if (timer.timed && time > 0) {
			let ti = 0;
			if (timer.pause) {
				ti = timer.pause - timer.lastMove;
			} else {
				ti = time - timer.lastMove;
			}
			t.push(<span>{msToTime(ti)}</span>);

			if (timer.timed && validNames.includes(context.name) && myTurn) {
				let inc = 0;
				let banked = 0;
				if (timer.pause) {
					inc = Math.max(timer.increment * 1000 - timer.pause + timer.lastMove, 0);
					banked = Math.min(
						Math.max(timer.banked[context.name] * 1000 - timer.pause + timer.increment * 1000 + timer.lastMove, 0),
						timer.banked[context.name] * 1000
					);
				} else {
					inc = Math.max(timer.increment * 1000 - time + timer.lastMove, 0);
					let ti = timer.banked[context.name] * 1000 - time + timer.increment * 1000 + timer.lastMove;
					banked = Math.min(Math.max(ti, 0), timer.banked[context.name] * 1000);
				}
				t.push(<Divider style={{ fontSize: '30px', marginRight: 20, marginLeft: 20 }} type="vertical" />);
				t.push(
					<span>
						{msToTime(inc)} + {msToTime(banked)}
					</span>
				);
			}
			if (timer.pause) {
				t.push(
					<Button type="link" onClick={() => play()}>
						{' '}
						<i class="fas fa-play"></i>{' '}
					</Button>
				);
			} else {
				t.push(
					<Button type="link" onClick={() => pause()}>
						{' '}
						<i class="fas fa-pause"></i>{' '}
					</Button>
				);
			}
			t.push(<Divider style={{ fontSize: '30px', marginRight: 20 }} type="vertical" />);
		}

		return t;
	}

	function buildColorblindToggle() {
		return (
			<Tooltip title="Colorblind Mode" mouseLeaveDelay={0}>
				<Button
					type="link"
					onClick={() => context.setColorblindMode(!context.colorblindMode)}
					style={context.colorblindMode ? { color: '#13a8a8' } : {}}
				>
					<i className={context.colorblindMode ? 'fas fa-eye' : 'fas fa-low-vision'}></i>
				</Button>
			</Tooltip>
		);
	}

	function buildExitGame() {
		let t = [];
		if (context.game) {
			t.push(<Divider style={{ fontSize: '30px' }} type="vertical" />);
			t.push(
				<Button type="link" onClick={() => exitGame()}>
					{' '}
					Exit Game{' '}
				</Button>
			);
		}

		return t;
	}

	function buildComponent() {
		let t = [];
		if (!context.name) {
			t.push(
				<div style={{ fontSize: '18px', textAlign: 'right' }}>
					{buildTimer()}
					<Input
						placeholder="Name"
						allowClear={true}
						style={{ background: 'black', width: 150 }}
						onPressEnter={(e) => handleEnter(e)}
					></Input>{' '}
					&nbsp;
					{buildColorblindToggle()}
					{buildExitGame()}
				</div>
			);
		} else {
			t.push(
				<div style={{ fontSize: '18px', textAlign: 'right' }}>
					{buildTimer()}
					{context.name} &nbsp;
					<Button type="link" onClick={() => logout()}>
						{' '}
						<i class="fas fa-sign-out-alt"></i>{' '}
					</Button>
					{buildColorblindToggle()}
					{buildExitGame()}
					&nbsp; &nbsp; &nbsp;
				</div>
			);
		}
		return t;
	}

	return <div>{buildComponent()}</div>;
}

export default LoginApp;
