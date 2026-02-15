import React from 'react';
import './App.css';
import { Alert } from 'antd';
import { OptionComponent } from './ComponentTemplates.js';
import { ActionComponent } from './ComponentTemplates.js';
import { MessageComponent } from './ComponentTemplates.js';
import { MultiOptionComponent } from './ComponentTemplates.js';
import { ImportComponent } from './ComponentTemplates.js';
import { CheckboxComponent, SimpleMessageComponent } from './ComponentTemplates.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import * as proposalAPI from './backendFiles/proposalAPI.js';
import { unmountComponentAtNode } from 'react-dom';

class ProposalApp extends ActionComponent {
	constructor(props) {
		super(props);
		this.state = {
			className: 'ProposalApp',
			submitMethod: submitAPI.submitProposal,
			objects: ['prevprop', 'wheel', 'move'],
			prevprop: '',
			wheel: '',
			move: '',
			visibleLayers: [true, false, false, false],
			components: { prevprop: PreviousProposalMessage, wheel: WheelComponent, move: null },
			type: 'proposal',
			submit: true,
			triggers: {
				wheel: [
					'move',
					{
						Factory: FactoryApp,
						'R-Produce': ProduceApp,
						Investor: InvestorApp,
						'L-Produce': ProduceApp,
						'R-Maneuver': ManeuverApp,
						'L-Maneuver': ManeuverApp,
						Taxation: TaxApp,
						Import: ImportApp,
					},
				],
			},
			keys: [0, 0, 0, 0, 0],
		};
	}
}

class PreviousProposalMessage extends MessageComponent {
	constructor(props) {
		super(props);
		this.state = {
			object: 'prevprop',
			message: 'Default',
			getAPI: proposalAPI.getPreviousProposalMessage,
			divider: true,
		};
	}
}

class WheelComponent extends OptionComponent {
	constructor(props) {
		super(props);
		this.state = {
			object: 'wheel',
			choices: [],
			setThing: 'setWheelSpot',
			thing: 'wheelSpot',
			getAPI: proposalAPI.getWheelOptions,
			message: 'Spin to:',
			costs: ['', '', '', '($2)', '($4)', '($6)'],
		};
	}
}

class FactoryApp extends ActionComponent {
	constructor(props) {
		super(props);
		this.state = {
			className: 'FactoryApp',
			submitMethod: 'none',
			objects: ['location'],
			country: '',
			visibleLayers: [true, false],
			components: { location: LocationComponent },
			type: 'move',
			submit: false,
			triggers: {},
			keys: [0],
		};
	}
}

class LocationComponent extends OptionComponent {
	constructor(props) {
		super(props);
		this.state = {
			object: 'location',
			choices: [],
			setThing: 'setFactoryLoc',
			thing: 'factoryLoc',
			getAPI: proposalAPI.getLocationOptions,
			message: 'Location:',
		};
	}
}

class ProduceApp extends ActionComponent {
	constructor(props) {
		super(props);
		this.state = {
			className: 'ProduceApp',
			submitMethod: 'none',
			objects: ['producemessage', 'producefleets', 'producearmies'],
			producemessage: '',
			producefleets: '',
			producearmies: '',
			visibleLayers: [true, false, false, false],
			components: {
				producemessage: ProduceMessageApp,
				producefleets: ProduceFleetsApp,
				producearmies: ProduceArmiesApp,
			},
			type: 'move',
			submit: false,
			triggers: {},
			keys: [0, 0, 0],
		};
	}
}

class ProduceMessageApp extends SimpleMessageComponent {
	constructor(props) {
		super(props);
		this.state = { object: 'producemessage', message: 'Choose which units to produce.' };
	}
}

class ProduceFleetsApp extends CheckboxComponent {
	constructor(props) {
		super(props);
		this.state = {
			object: 'producefleets',
			choices: [],
			setThing: 'setFleetProduce',
			thing: 'fleetProduce',
			getAPI: proposalAPI.getFleetProduceOptions,
			type: '(Fleet)',
			checked: [],
			items: [],
			limit: 0,
		};
	}
}

class ProduceArmiesApp extends CheckboxComponent {
	constructor(props) {
		super(props);
		this.state = {
			object: 'producearmies',
			choices: [],
			setThing: 'setArmyProduce',
			thing: 'armyProduce',
			getAPI: proposalAPI.getArmyProduceOptions,
			type: '(Army)',
			checked: [],
			items: [],
			limit: 0,
		};
	}
}

class InvestorApp extends ActionComponent {
	constructor(props) {
		super(props);
		this.state = {
			className: 'InvestorApp',
			submitMethod: 'none',
			objects: ['investor'],
			investor: '',
			visibleLayers: [true, false],
			components: { investor: InvestorMessage },
			type: 'move',
			submit: false,
			triggers: {},
			keys: [0],
		};
	}
}

class InvestorMessage extends MessageComponent {
	constructor(props) {
		super(props);
		this.state = { object: 'investor', message: 'Default', getAPI: proposalAPI.getInvestorMessage };
	}
}

class TaxApp extends ActionComponent {
	constructor(props) {
		super(props);
		this.state = {
			className: 'TaxApp',
			submitMethod: 'none',
			objects: ['tax'],
			tax: '',
			visibleLayers: [true, false],
			components: { tax: TaxMessage },
			type: 'move',
			submit: false,
			triggers: {},
			keys: [0],
		};
	}
}

class TaxMessage extends MessageComponent {
	constructor(props) {
		super(props);
		this.state = { object: 'tax', message: 'Default', getAPI: proposalAPI.getTaxMessage };
	}
}

class ManeuverApp extends ActionComponent {
	constructor(props) {
		super(props);
		this.state = {
			className: 'ManeuverApp',
			submitMethod: 'none',
			objects: ['manmessage', 'fleet', 'army'],
			manmessage: '',
			fleet: '',
			army: '',
			visibleLayers: [true, false, false, false],
			components: { manmessage: ManeuverMessageApp, fleet: FleetApp, army: ArmyApp },
			type: 'move',
			submit: false,
			triggers: {},
			// triggers: {fleet: ["army", {"show next": ArmyApp, "done": BlankMessageApp,}]},
			keys: [0, 0, 0],
		};
	}
}

class ManeuverMessageApp extends SimpleMessageComponent {
	constructor(props) {
		super(props);
		this.state = {
			object: 'manmessage',
			message: (
				<Alert
					style={{ marginTop: -20 }}
					message="Reminder: Resolve peace offers offline. All inputted peace automatically pass."
					type="info"
				/>
			),
		};
	}
}

class FleetApp extends MultiOptionComponent {
	constructor(props) {
		super(props);
		this.state = {
			object: 'fleet',
			choices: [],
			setThing: 'setFleetMan',
			thing: 'fleetMan',
			getAPI: proposalAPI.getFleetOptions,
			peaceAPI: proposalAPI.getFleetPeaceOptions,
			allGoodAPI: proposalAPI.allFleetsMoved,
			message: 'Move fleets:',
			values: [],
			peaceOptions: {},
		};
	}
}

class ArmyApp extends MultiOptionComponent {
	constructor(props) {
		super(props);
		this.state = {
			object: 'army',
			choices: [],
			setThing: 'setArmyMan',
			thing: 'armyMan',
			getAPI: proposalAPI.getArmyOptions,
			peaceAPI: proposalAPI.getArmyPeaceOptions,
			allGoodAPI: proposalAPI.allArmiesMoved,
			message: (
				<div>
					Move Armies:{' '}
					<Alert
						style={{ marginTop: 10, marginBottom: -10 }}
						message="The app does not prevent various illegal army maneuvers. Do not submit them."
						type="info"
					/>{' '}
				</div>
			),
			values: [],
			peaceOptions: {},
		};
	}
}

class ImportApp extends ActionComponent {
	constructor(props) {
		super(props);
		this.state = {
			className: 'ImportApp',
			submitMethod: 'none',
			objects: ['importunits'],
			importunits: '',
			visibleLayers: [true, false],
			components: { importunits: ImportUnitsApp },
			type: 'move',
			submit: false,
			triggers: {}, // add trigger for peace
			keys: [0],
		};
	}
}

// modify to be more competent for import
class ImportUnitsApp extends ImportComponent {
	constructor(props) {
		super(props);
		this.state = {
			object: 'importunits',
			choices: [],
			setThing: 'setImport',
			thing: 'import',
			getAPI: proposalAPI.getImportOptions,
			message: 'Choose where to import units. Keep the field empty to not import.',
			clearable: true,
			labels: [],
			values: [],
			options: {},
			valueOptions: {},
			limits: {},
		};
	}
}

export default ProposalApp;
