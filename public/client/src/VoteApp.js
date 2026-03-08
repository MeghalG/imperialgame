import React from 'react';
import './App.css';
import { RadioSelect, ActionFlow } from './ComponentTemplates.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';

function VoteApp() {
	return (
		<ActionFlow
			className="VoteApp"
			submitMethod={submitAPI.submitVote}
			objects={['options']}
			components={{
				options: (props) => (
					<RadioSelect
						object="options"
						setThing="setVote"
						getAPI={miscAPI.getVoteOptions}
						message="Vote for one of these proposals."
						data={props.data}
					/>
				),
			}}
			submit={true}
			triggers={{}}
			type="vote"
		/>
	);
}

export default VoteApp;
