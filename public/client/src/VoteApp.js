import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import UserContext from './UserContext.js';
import TurnControlContext from './TurnControlContext.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import useGameState from './useGameState.js';

function VoteApp() {
	const context = useContext(UserContext);
	const turnControl = useContext(TurnControlContext);
	const [options, setOptions] = useState([]);
	const [selected, setSelected] = useState(null);
	const contextRef = useRef(context);
	contextRef.current = context;

	const { gameState } = useGameState();

	const loadOptions = useCallback(async () => {
		let opts = await miscAPI.getVoteOptions(contextRef.current);
		setOptions(opts || []);
	}, []);

	useEffect(() => {
		loadOptions();
	}, [gameState, loadOptions]);

	useEffect(() => {
		turnControl.registerSubmit({
			handler: submitAPI.submitVote,
			label: 'Submit Vote',
			enabled: selected !== null,
			preview: selected ? 'Vote: ' + selected : '',
		});
		return () => turnControl.clearSubmit();
	}, [selected, turnControl]);

	function handleSelect(option) {
		setSelected(option);
		context.setVote(option);
	}

	return (
		<div className="imp-vote-buttons">
			{options.map((opt) => (
				<button
					key={opt}
					className={
						'imp-vote-buttons__option' + (selected === opt ? ' imp-vote-buttons__option--selected' : '')
					}
					onClick={() => handleSelect(opt)}
				>
					{opt}
				</button>
			))}
		</div>
	);
}

export default VoteApp;
