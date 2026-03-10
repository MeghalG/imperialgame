import React, { useState, useContext, useEffect } from 'react';
import './App.css';
import UserContext from './UserContext.js';
import { Button } from 'antd';
import { Radio } from 'antd';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import SoundManager from './SoundManager.js';

function BuyBidApp() {
	const context = useContext(UserContext);
	const [chosen, setChosen] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [bid, setBid] = useState(0);
	const [stock, setStock] = useState({ country: '', value: 0 });

	useEffect(() => {
		async function loadData() {
			let [b, s] = await Promise.all([miscAPI.getBid(context), miscAPI.getStock(context)]);
			setBid(b);
			setStock(s);
			setLoaded(true);
		}
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function submit() {
		SoundManager.playCoin();
		submitAPI.bidBuy(context);
	}

	function chooseBid(e) {
		setChosen(true);
		context.setBuyBid(e.target.value);
	}

	if (!loaded) {
		return null;
	}
	return (
		<div>
			<div style={{ marginBottom: 30 }}>
				{' '}
				Would you like to spend ${bid} on the {stock.country} {stock.value}?{' '}
			</div>
			<div style={{ marginBottom: 30, marginLeft: 10 }}>
				<Radio.Group
					options={[
						{ label: 'Yes', value: true },
						{ label: 'No', value: false },
					]}
					onChange={(e) => chooseBid(e)}
				/>
			</div>
			<div style={{ textAlign: 'center' }}>
				{' '}
				<Button onClick={() => submit()} type="primary" disabled={!chosen}>
					{' '}
					Submit{' '}
				</Button>{' '}
			</div>
		</div>
	);
}

export default BuyBidApp;
