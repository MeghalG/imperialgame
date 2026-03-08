import React from 'react';
import './App.css';
import { OptionSelect, ActionFlow } from './ComponentTemplates.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import * as buyAPI from './backendFiles/buyAPI.js';

function BuyApp() {
	return (
		<ActionFlow
			className="BuyApp"
			submitMethod={submitAPI.submitBuy}
			objects={['country', 'return', 'stock']}
			components={{
				country: (props) => (
					<OptionSelect
						object="country"
						setThing="setBuyCountry"
						getAPI={buyAPI.getCountryOptions}
						message="Country:"
						data={props.data}
					/>
				),
				return: (props) => (
					<OptionSelect
						object="return"
						setThing="setReturnStock"
						getAPI={buyAPI.getReturnStockOptions}
						message="Return:"
						data={props.data}
					/>
				),
				stock: (props) => (
					<OptionSelect
						object="stock"
						setThing="setBuyStock"
						getAPI={buyAPI.getStockOptions}
						message="Stock:"
						data={props.data}
					/>
				),
			}}
			submit={true}
			triggers={{}}
			type="buy"
		/>
	);
}

export default BuyApp;
