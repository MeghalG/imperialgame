import React, { useState, useContext, useEffect, useRef } from 'react';
import './App.css';
import UserContext from './UserContext.js';
import { Card, List } from 'antd';
import { database } from './backendFiles/firebase.js';

function HistoryApp() {
	const context = useContext(UserContext);
	const [history, setHistory] = useState([]);
	const historyRef = useRef(null);

	useEffect(() => {
		historyRef.current = database.ref('games/' + context.game + '/history');
		historyRef.current.on('value', (dataSnapshot) => {
			let h = dataSnapshot.val();
			setHistory(h.reverse());
		});
		return () => {
			if (historyRef.current) {
				historyRef.current.off();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<Card style={{ maxHeight: 'calc(100vh + -135px)', overflow: 'auto' }}>
			<List
				bordered
				dataSource={history}
				renderItem={(item, index) => (
					<List.Item>
						<span style={{ color: '#13a8a8' }}>[{history.length - index}]</span>&nbsp; &nbsp; {item}
					</List.Item>
				)}
			/>
		</Card>
	);
}

export default HistoryApp;
