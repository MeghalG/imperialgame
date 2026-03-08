import React, { useState, useContext } from 'react';
import './App.css';
import ProposalApp from './ProposalApp.js';
import UserContext from './UserContext.js';
import { Radio, Button } from 'antd';
import * as submitAPI from './backendFiles/submitAPI.js';

function ProposalAppOpp(props) {
	const context = useContext(UserContext);
	const [proposal, setProposal] = useState(false);

	function handleSetProposal(e) {
		setProposal(e.target.value);
	}

	return (
		<div>
			<div style={{ marginBottom: 30 }}> Do you want to counterpropose? </div>
			<div style={{ marginBottom: 30, marginLeft: 10 }}>
				<Radio.Group
					defaultValue={false}
					options={[
						{ label: 'Yes', value: true },
						{ label: 'No', value: false },
					]}
					onChange={(e) => handleSetProposal(e)}
				/>
			</div>
			{proposal ? (
				<ProposalApp key={props.key} />
			) : (
				<div style={{ textAlign: 'center' }}>
					<Button type="primary" onClick={() => submitAPI.submitNoCounter(context)}>
						Submit
					</Button>
				</div>
			)}
		</div>
	);
}

export default ProposalAppOpp;
