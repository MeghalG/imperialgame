import React from 'react';
import './App.css';
import UserContext from './UserContext.js';
import { Card, List } from 'antd';
import { database } from './backendFiles/firebase.js';

class HistoryApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			history: [],
		};
	}

	componentDidMount() {
		database.ref('games/' + this.context.game + '/history').on('value', (dataSnapshot) => {
			let history = dataSnapshot.val();
			this.setState({ history: history.reverse() });
		});
	}

	render() {
		return (
			<Card style={{ maxHeight: 'calc(100vh + -135px)', overflow: 'auto' }}>
				<List
					bordered
					dataSource={this.state.history}
					renderItem={(item, index) => (
						<List.Item>
							<span style={{ color: '#13a8a8' }}>[{this.state.history.length - index}]</span>&nbsp; &nbsp; {item}
						</List.Item>
					)}
				/>
			</Card>
		);
	}
}
HistoryApp.contextType = UserContext;

export default HistoryApp;
