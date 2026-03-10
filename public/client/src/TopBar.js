import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './MapOverlay.css';
import { Input, Button, Tooltip } from 'antd';
import { HistoryOutlined, InfoCircleOutlined, ReadOutlined } from '@ant-design/icons';
import UserContext from './UserContext.js';
import * as turnAPI from './backendFiles/turnAPI.js';
import * as helper from './backendFiles/helper.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';

function TopBar({ onToggleHistory, onToggleInfo, onToggleRules }) {
	const context = useContext(UserContext);
	const [title, setTitle] = useState('');
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
		let [t, res, timerData, myTurnData] = await Promise.all([
			turnAPI.getTitle(contextRef.current),
			helper.getPlayersInOrder(contextRef.current),
			helper.getTimer(contextRef.current),
			turnAPI.getMyTurn(contextRef.current),
		]);
		setTitle(t);
		setValidNames(res);
		setTimer(timerData);
		setMyTurn(myTurnData);
	}, []);

	useEffect(() => {
		doStuff();
		turnRef.current = database.ref('games/' + contextRef.current.game + '/turnID');
		turnRef.current.on('value', (dataSnapshot) => {
			invalidateIfStale(contextRef.current.game, dataSnapshot.val());
			doStuff();
		});
		timerRef.current = database.ref('games/' + contextRef.current.game + '/timer');
		timerRef.current.on('child_changed', () => {
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

	function msToTime(s) {
		s = Math.floor(s / 1000);
		let secs = s % 60;
		let mins = Math.floor(s / 60);
		return mins + ':' + secs.toString().padStart(2, '0');
	}

	async function pause() {
		await database.ref('games/' + context.game + '/timer/pause').set(time);
	}

	async function play() {
		await doStuff();
		await database.ref('games/' + context.game + '/timer/lastMove').set(time - timer.pause + timer.lastMove);
		await database.ref('games/' + context.game + '/timer/pause').set(0);
	}

	function buildTimer() {
		if (!timer || !timer.timed || time <= 0) return null;
		let ti = 0;
		if (timer.pause) {
			ti = timer.pause - timer.lastMove;
		} else {
			ti = time - timer.lastMove;
		}

		let timerParts = [<span key="elapsed">{msToTime(ti)}</span>];

		if (validNames.includes(context.name) && myTurn) {
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
				let tiVal = timer.banked[context.name] * 1000 - time + timer.increment * 1000 + timer.lastMove;
				banked = Math.min(Math.max(tiVal, 0), timer.banked[context.name] * 1000);
			}
			timerParts.push(
				<span key="banked" style={{ marginLeft: 8, color: 'var(--imp-text-dim)' }}>
					{msToTime(inc)} + {msToTime(banked)}
				</span>
			);
		}

		if (timer.pause) {
			timerParts.push(
				<Button key="play" type="link" size="small" onClick={() => play()} style={{ color: 'var(--imp-accent-gold)' }}>
					<i className="fas fa-play"></i>
				</Button>
			);
		} else {
			timerParts.push(
				<Button key="pause" type="link" size="small" onClick={() => pause()} style={{ color: 'var(--imp-text-dim)' }}>
					<i className="fas fa-pause"></i>
				</Button>
			);
		}

		return timerParts;
	}

	function buildRight() {
		if (!context.name) {
			return (
				<React.Fragment>
					<Input
						placeholder="Name"
						allowClear={true}
						size="small"
						style={{ background: '#0a0b0d', width: 120, fontSize: 12 }}
						onPressEnter={(e) => handleEnter(e)}
					/>
					<Tooltip title="Colorblind Mode" mouseLeaveDelay={0}>
						<button
							className="imp-topbar__btn"
							onClick={() => context.setColorblindMode(!context.colorblindMode)}
							style={context.colorblindMode ? { color: '#13a8a8' } : {}}
						>
							<i className={context.colorblindMode ? 'fas fa-eye' : 'fas fa-low-vision'}></i>
						</button>
					</Tooltip>
				</React.Fragment>
			);
		}

		return (
			<React.Fragment>
				<span style={{ marginRight: 4 }}>{context.name}</span>
				<Tooltip title="Logout" mouseLeaveDelay={0}>
					<button className="imp-topbar__btn" onClick={() => logout()}>
						<i className="fas fa-sign-out-alt"></i>
					</button>
				</Tooltip>
				<Tooltip title="Colorblind Mode" mouseLeaveDelay={0}>
					<button
						className={'imp-topbar__btn' + (context.colorblindMode ? ' imp-topbar__btn--active' : '')}
						onClick={() => context.setColorblindMode(!context.colorblindMode)}
					>
						<i className={context.colorblindMode ? 'fas fa-eye' : 'fas fa-low-vision'}></i>
					</button>
				</Tooltip>
				{context.game && (
					<button className="imp-topbar__btn" onClick={() => exitGame()}>
						Exit
					</button>
				)}
			</React.Fragment>
		);
	}

	return (
		<div className="imp-topbar">
			<div className="imp-topbar__title">{title}</div>
			<div className="imp-topbar__center">{buildTimer()}</div>
			<div className="imp-topbar__right">
				<Tooltip title="History" mouseLeaveDelay={0}>
					<button className="imp-topbar__btn" onClick={onToggleHistory}>
						<HistoryOutlined />
					</button>
				</Tooltip>
				<Tooltip title="Detailed Info" mouseLeaveDelay={0}>
					<button className="imp-topbar__btn" onClick={onToggleInfo}>
						<InfoCircleOutlined />
					</button>
				</Tooltip>
				<Tooltip title="Rules" mouseLeaveDelay={0}>
					<button className="imp-topbar__btn" onClick={onToggleRules}>
						<ReadOutlined />
					</button>
				</Tooltip>
				<span style={{ width: 1, height: 20, background: 'var(--imp-panel-border)', margin: '0 4px' }} />
				{buildRight()}
			</div>
		</div>
	);
}

export default TopBar;
