import React from 'react';
import './App.css';

import EnterApp from './EnterApp.js';
import GameApp from './GameApp.js';

import UserContext from './UserContext.js';

class App extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			host: 'localhost:9001',
			game: '',
			setGame: (x) => {
				this.setState({ game: x });
			},
			name: '',
			setName: (x) => {
				this.setState({ name: x });
			},
			resetValues: () => {
				this.resetState();
			},
			bid: 0,
			setBid: (x) => {
				this.setState({ bid: x });
			},
			buyBid: '',
			setBuyBid: (x) => {
				this.setState({ buyBid: x });
			},
			buyCountry: '',
			setBuyCountry: (x) => {
				this.setState({ buyCountry: x });
			},
			returnStock: 0,
			setReturnStock: (x) => {
				this.setState({ returnStock: x });
			},
			buyStock: '',
			setBuyStock: (x) => {
				this.setState({ buyStock: x });
			},
			vote: '',
			setVote: (x) => {
				this.setState({ vote: x });
			},
			wheelSpot: '',
			setWheelSpot: (x) => {
				this.setState({ wheelSpot: x });
			},
			factoryLoc: '',
			setFactoryLoc: (x) => {
				this.setState({ factoryLoc: x });
			},
			fleetProduce: '',
			setFleetProduce: (x) => {
				this.setState({ fleetProduce: x });
			},
			armyProduce: '',
			setArmyProduce: (x) => {
				this.setState({ armyProduce: x });
			},
			fleetMan: '',
			setFleetMan: (x) => {
				this.setState({ fleetMan: x });
			},
			armyMan: '',
			setArmyMan: (x) => {
				this.setState({ armyMan: x });
			},
			import: {},
			setImport: (x) => {
				this.setState({ import: x });
			},
			maneuverDest: '',
			setManeuverDest: (x) => {
				this.setState({ maneuverDest: x });
			},
			maneuverAction: '',
			setManeuverAction: (x) => {
				this.setState({ maneuverAction: x });
			},
			peaceVoteChoice: '',
			setPeaceVoteChoice: (x) => {
				this.setState({ peaceVoteChoice: x });
			},
			title: '',
		};
	}
	resetState() {
		this.setState({
			bid: 0,
			buyBid: '',
			buyCountry: '',
			returnStock: '',
			buyStock: '',
			vote: '',
			wheelSpot: '',
			factoryLoc: '',
			fleetProduce: '',
			armyProduce: '',
			fleetMan: '',
			armyMan: '',
			import: '',
			maneuverDest: '',
			maneuverAction: '',
			peaceVoteChoice: '',
		});
	}

	componentDidMount() {
		this.setState({ name: localStorage.getItem('name'), game: localStorage.getItem('game') });
	}

	buildComponents() {
		if (this.state.game) {
			return <GameApp />;
		} else {
			return <EnterApp />;
		}
	}

	render() {
		return <UserContext.Provider value={this.state}>{this.buildComponents()}</UserContext.Provider>;
	}
}

export default App;
