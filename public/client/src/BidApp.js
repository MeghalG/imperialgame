import React, { useState, useContext, useEffect } from 'react';
import './App.css';
import UserContext from './UserContext.js';
import { InputNumber, Button } from 'antd';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import SoundManager from './SoundManager.js';

function BidApp() {
	const context = useContext(UserContext);
	const [loaded, setLoaded] = useState(false);
	const [maxMoney, setMaxMoney] = useState(-1);
	const [country, setCountry] = useState('');

	useEffect(() => {
		async function loadData() {
			let [money, c] = await Promise.all([miscAPI.getMoney(context), miscAPI.getCountry(context)]);
			money = parseFloat(money).toFixed(2);
			setMaxMoney(money);
			setCountry(c);
			setLoaded(true);
		}
		loadData();
		context.setBid(0);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function submit() {
		SoundManager.playCoin();
		await submitAPI.bid(context);
	}

	function record(value) {
		context.setBid(value);
	}

	function makeInput() {
		if (maxMoney !== -1) {
			return (
				<InputNumber
					min={0}
					max={maxMoney}
					defaultValue={0.0}
					step={0.01}
					formatter={(value) => `$   ${value}`}
					parser={(value) => value.replace(/\$\s?|( *)/g, '')}
					onChange={(value) => record(value)}
					style={{ width: 120 }}
				/>
			);
		}
	}

	if (!loaded) {
		return null;
	}
	return (
		<div>
			<div style={{ marginBottom: 30 }}>
				{' '}
				You may bid up to ${maxMoney} on {country} in increments of cents. (It will round if you try to use more
				precision.){' '}
			</div>
			<div style={{ marginBottom: 30 }}>
				<label style={{ paddingRight: '50px', whiteSpace: 'nowrap', marginLeft: 10 }}> Bid: </label>
				{makeInput()}
				<br />
			</div>
			<div style={{ textAlign: 'center' }}>
				{' '}
				<Button onClick={() => submit()} type="primary">
					{' '}
					Submit{' '}
				</Button>{' '}
			</div>
		</div>
	);
}

export default BidApp;
