import React from 'react';
import './App.css';
import { Button, Card, Result } from 'antd';
import UserContext from './UserContext.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import { database } from './backendFiles/firebase.js';

/**
 * UI for democracy peace vote (mode === 'peace-vote').
 *
 * Shown to stockholders of the target country when a unit requests
 * peaceful entry into their territory. Each stockholder votes Accept or Reject,
 * weighted by their stock denomination in the target country.
 */
class PeaceVoteApp extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			loaded: false,
			peaceVote: null,
		};
	}

	async componentDidMount() {
		await this.loadData();
	}

	async loadData() {
		try {
			let gameState = await database.ref('games/' + this.context.game).once('value');
			gameState = gameState.val();
			let pv = gameState.peaceVote;
			if (!pv) return;

			this.setState({
				loaded: true,
				peaceVote: pv,
			});
		} catch (e) {
			console.error('PeaceVoteApp failed to load:', e);
		}
	}

	async submitVote(choice) {
		await submitAPI.submitPeaceVote({
			...this.context,
			peaceVoteChoice: choice,
		});
	}

	render() {
		if (!this.state.loaded) {
			return <div style={{ textAlign: 'center', padding: 40 }}>Loading peace vote...</div>;
		}

		let pv = this.state.peaceVote;
		if (!pv) {
			return <div style={{ textAlign: 'center', padding: 40 }}>No peace vote pending.</div>;
		}

		let alreadyVoted = (pv.voters || []).includes(this.context.name);

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
						<div>
							<Button type="primary" style={{ marginRight: 10 }} onClick={() => this.submitVote('accept')}>
								Accept Peace
							</Button>
							<Button danger onClick={() => this.submitVote('reject')}>
								Reject (War)
							</Button>
						</div>
					)}
				</Card>
			</div>
		);
	}
}

PeaceVoteApp.contextType = UserContext;

export default PeaceVoteApp;
