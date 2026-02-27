import React from 'react';
import './App.css';
import { StateApp } from './StateApp.js';
import LoginApp from './LoginApp.js';
import MainApp from './MainApp.js';
import HistoryApp from './HistoryApp.js';
import RulesApp from './RulesApp.js';
import UserContext from './UserContext.js';
import { database } from './backendFiles/firebase.js';
import * as turnAPI from './backendFiles/turnAPI.js';

import { Tabs } from 'antd';
import { Layout } from 'antd';

const { Header, Content } = Layout;

const { TabPane } = Tabs;

class GameApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			maxMoney: -1,
		};
	}

	componentDidMount() {
		this.turnRef = database.ref('games/' + this.context.game + '/turnID');
		this.turnRef.on('value', (dataSnapshot) => {
			this.makeTitle();
		});
	}

	componentWillUnmount() {
		if (this.turnRef) {
			this.turnRef.off();
		}
	}

	async makeTitle() {
		let title = await turnAPI.getTitle(this.context);
		this.setState({ title: title });
	}

	render() {
		return (
			<Layout style={{ fontFamily: 'Arial' }}>
				<Header style={{ position: 'fixed', zIndex: 1, width: '100%', fontSize: '28px', display: 'inline' }}>
					{this.state.title}
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
							<StateApp ref={this.GameState} />
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
}
GameApp.contextType = UserContext;

export default GameApp;
