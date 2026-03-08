import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import './App.css';
import { StateApp } from './StateApp.js';
import LoginApp from './LoginApp.js';
import MainApp from './MainApp.js';
import HistoryApp from './HistoryApp.js';
import RulesApp from './RulesApp.js';
import UserContext from './UserContext.js';
import { database } from './backendFiles/firebase.js';
import { invalidateIfStale } from './backendFiles/stateCache.js';
import * as turnAPI from './backendFiles/turnAPI.js';

import { Tabs } from 'antd';
import { Layout } from 'antd';

const { Header, Content } = Layout;

const { TabPane } = Tabs;

function GameApp() {
	const context = useContext(UserContext);
	const [title, setTitle] = useState('');
	const turnRef = useRef(null);
	const contextRef = useRef(context);
	contextRef.current = context;

	const makeTitle = useCallback(async () => {
		let t = await turnAPI.getTitle(contextRef.current);
		setTitle(t);
	}, []);

	useEffect(() => {
		turnRef.current = database.ref('games/' + contextRef.current.game + '/turnID');
		turnRef.current.on('value', (dataSnapshot) => {
			invalidateIfStale(contextRef.current.game, dataSnapshot.val());
			makeTitle();
		});
		return () => {
			if (turnRef.current) {
				turnRef.current.off();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<Layout style={{ fontFamily: 'Arial' }}>
			<Header style={{ position: 'fixed', zIndex: 1, width: '100%', fontSize: '28px', display: 'inline' }}>
				{title}
				<span style={{ float: 'right', fontSize: 14 }}>
					<LoginApp />
				</span>
			</Header>
			<Content className="site-layout" style={{ padding: '0vh 3vw', marginTop: 64 }}>
				<Tabs defaultActiveKey="1" centered>
					<TabPane tab="Map" key="1">
						<MainApp />
					</TabPane>
					<TabPane tab="Detailed Info" key="2">
						<StateApp />
					</TabPane>
					<TabPane tab="History" key="3">
						<HistoryApp />
					</TabPane>
					<TabPane tab="Rules" key="4">
						<RulesApp />
					</TabPane>
				</Tabs>
			</Content>
		</Layout>
	);
}

export default GameApp;
