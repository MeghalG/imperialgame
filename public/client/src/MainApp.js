import React from 'react';
import './App.css';
import TurnApp from './TurnApp.js';
import PlayerApp from './PlayerApp.js';
import MapApp from './MapApp.js';

import { Row, Col } from 'antd';

class MainApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = { playerTurn: false };
	}

	render() {
		return (
			<Row style={{ align: 'top', display: 'flex', height: '100%' }}>
				<Col span={14} style={{ marginTop: 2, paddingRight: 10 }}>
					<MapApp style={{ width: '100%' }} />
				</Col>
				<Col span={3} style={{ marginTop: 2, paddingRight: 10 }}>
					<PlayerApp style={{ width: '100%' }} />
				</Col>
				<Col span={7} style={{ height: '100%' }}>
					<TurnApp />
				</Col>
			</Row>
		);
	}
}

export default MainApp;
