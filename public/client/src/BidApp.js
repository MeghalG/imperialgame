import React from 'react';
import './App.css';
import UserContext from './UserContext.js';
import { InputNumber, Button } from 'antd';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';

class BidApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			maxMoney: -1,
		};
	}

	componentDidMount() {
		this.getInfo();
		this.record(0);
	}

	async getInfo() {
		let money = await miscAPI.getMoney(this.context);
		money = parseFloat(money).toFixed(2);
		let country = await miscAPI.getCountry(this.context);

		this.setState({ maxMoney: money, country: country });
	}

	async submit() {
		await submitAPI.bid(this.context);
	}

	record(value) {
		this.context.setBid(value);
	}

	makeInput() {
		if (this.state.maxMoney !== -1) {
			return (
				<InputNumber
					min={0}
					max={this.state.maxMoney}
					defaultValue={0.0}
					step={0.01}
					formatter={(value) => `$   ${value}`}
					parser={(value) => value.replace(/\$\s?|( *)/g, '')}
					onChange={(value) => this.record(value)}
					style={{ width: 120 }}
				/>
			);
		}
	}

	render() {
		return (
			<div>
				<div style={{ marginBottom: 30 }}>
					{' '}
					You may bid up to ${this.state.maxMoney} on {this.state.country} in increments of cents. (It will round if you
					try to use more precision.){' '}
				</div>
				<div style={{ marginBottom: 30 }}>
					<label style={{ paddingRight: '50px', whiteSpace: 'nowrap', marginLeft: 10 }}> Bid: </label>
					{this.makeInput()}
					<br />
				</div>
				<div style={{ textAlign: 'center' }}>
					{' '}
					<Button onClick={() => this.submit()} type="primary">
						{' '}
						Submit{' '}
					</Button>{' '}
				</div>
			</div>
		);
	}
}
BidApp.contextType = UserContext;

export default BidApp;
