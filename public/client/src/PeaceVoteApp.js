import React, { useState, useContext, useEffect } from 'react';
import './App.css';
import { Button, Card, Result } from 'antd';
import UserContext from './UserContext.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { database } from './backendFiles/firebase.js';
import SoundManager from './SoundManager.js';

/**
 * UI for democracy peace vote (mode === 'peace-vote').
 *
 * Shown to stockholders of the target country when a unit requests
 * peaceful entry into their territory. Each stockholder votes Accept or Reject,
 * weighted by their stock denomination in the target country.
 */
function PeaceVoteApp() {
	const context = useContext(UserContext);
	const [loaded, setLoaded] = useState(false);
	const [peaceVote, setPeaceVote] = useState(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		async function loadData() {
			try {
				let gameState = await database.ref('games/' + context.game).once('value');
				gameState = gameState.val();
				let pv = gameState.peaceVote;
				if (!pv) return;

				setLoaded(true);
				setPeaceVote(pv);
			} catch (e) {
				console.error('PeaceVoteApp failed to load:', e);
			}
		}
		loadData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function submitVote(choice) {
		SoundManager.playSubmit();
		setSubmitting(true);
		try {
			await submitAPI.submitPeaceVote({
				...context,
				peaceVoteChoice: choice,
			});
		} finally {
			setSubmitting(false);
		}
	}

	if (!loaded) {
		return <div style={{ textAlign: 'center', padding: 40 }}>Loading peace vote...</div>;
	}

	let pv = peaceVote;
	if (!pv) {
		return <div style={{ textAlign: 'center', padding: 40 }}>No peace vote pending.</div>;
	}

	let alreadyVoted = (pv.voters || []).includes(context.name);

	return (
		<div>
			<Result
				status="info"
				title="Peace Offer"
				subTitle={
					pv.movingCountry +
					"'s " +
					pv.unitType +
					' wants to enter ' +
					pv.destination +
					' (from ' +
					pv.origin +
					') peacefully.'
				}
			/>
			<Card title={pv.targetCountry + ' Stockholder Vote'}>
				<p>
					<strong>Accept:</strong> The {pv.unitType} enters peacefully (non-hostile).
				</p>
				<p>
					<strong>Reject:</strong> The entry becomes an act of war (both units destroyed).
				</p>
				<p>
					Votes so far — Accept: {pv.acceptVotes.toFixed(1)}, Reject: {pv.rejectVotes.toFixed(1)}
					{' (threshold: ' + ((pv.totalStock + 0.01) / 2.0).toFixed(1) + ')'}
				</p>

				{alreadyVoted ? (
					<p>
						<em>You have already voted. Waiting for other stockholders.</em>
					</p>
				) : (
					<div className="imp-vote-buttons">
						<Button
							type="primary"
							className="imp-vote-buttons__option imp-vote-buttons__option--accept"
							loading={submitting}
							onClick={() => submitVote('accept')}
						>
							Accept Peace
						</Button>
						<Button
							danger
							className="imp-vote-buttons__option imp-vote-buttons__option--reject"
							loading={submitting}
							onClick={() => submitVote('reject')}
						>
							Reject (War)
						</Button>
					</div>
				)}
			</Card>
		</div>
	);
}

export default PeaceVoteApp;
