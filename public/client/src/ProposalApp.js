import React from 'react';
import './App.css';
import { Alert } from 'antd';
import {
	OptionSelect,
	ActionFlow,
	MessageDisplay,
	SimpleMessage,
	ProduceSelect,
	ImportSelect,
	MultiOptionSelect,
} from './ComponentTemplates.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import * as proposalAPI from './backendFiles/proposalAPI.js';

// --- Inner flow components (replace the old inner ActionComponent subclasses) ---

function FactoryFlow(props) {
	return (
		<ActionFlow
			className="FactoryApp"
			submitMethod={() => {}}
			objects={['location']}
			components={{
				location: (innerProps) => (
					<OptionSelect
						object="location"
						setThing="setFactoryLoc"
						getAPI={proposalAPI.getLocationOptions}
						message="Location:"
						data={innerProps.data}
						mapMode="select-territory"
						mapColor="#49aa19"
					/>
				),
			}}
			submit={false}
			triggers={{}}
			type="move"
			data={props.data}
		/>
	);
}

function ProduceFlow(props) {
	return (
		<ActionFlow
			className="ProduceApp"
			submitMethod={() => {}}
			objects={['producemessage', 'produce']}
			components={{
				producemessage: (innerProps) => (
					<SimpleMessage object="producemessage" message="Choose which units to produce." data={innerProps.data} />
				),
				produce: (innerProps) => (
					<ProduceSelect
						object="produce"
						data={innerProps.data}
						getFleetAPI={proposalAPI.getFleetProduceOptions}
						getArmyAPI={proposalAPI.getArmyProduceOptions}
						mapMode="select-territory"
						mapColor="rgba(255,255,255,0.35)"
					/>
				),
			}}
			submit={false}
			triggers={{}}
			type="move"
			data={props.data}
		/>
	);
}

function InvestorFlow(props) {
	return (
		<ActionFlow
			className="InvestorApp"
			submitMethod={() => {}}
			objects={['investor']}
			components={{
				investor: (innerProps) => (
					<MessageDisplay object="investor" getAPI={proposalAPI.getInvestorMessage} data={innerProps.data} />
				),
			}}
			submit={false}
			triggers={{}}
			type="move"
			data={props.data}
		/>
	);
}

function TaxFlow(props) {
	return (
		<ActionFlow
			className="TaxApp"
			submitMethod={() => {}}
			objects={['tax']}
			components={{
				tax: (innerProps) => <MessageDisplay object="tax" getAPI={proposalAPI.getTaxMessage} data={innerProps.data} />,
			}}
			submit={false}
			triggers={{}}
			type="move"
			data={props.data}
		/>
	);
}

function ManeuverStartMessage(props) {
	return <SimpleMessage object="move" message="Begin maneuver planning." data={props.data} />;
}

function ImportFlow(props) {
	return (
		<ActionFlow
			className="ImportApp"
			submitMethod={() => {}}
			objects={['importunits']}
			components={{
				importunits: (innerProps) => (
					<ImportSelect
						object="importunits"
						setThing="setImport"
						getAPI={proposalAPI.getImportOptions}
						message="Choose where to import units. Keep the field empty to not import."
						data={innerProps.data}
						mapMode="select-territory"
						mapColor="#c9a84c"
					/>
				),
			}}
			submit={false}
			triggers={{}}
			type="move"
			data={props.data}
		/>
	);
}

// eslint-disable-next-line no-unused-vars
function ManeuverFlow(props) {
	return (
		<ActionFlow
			className="ManeuverApp"
			submitMethod={() => {}}
			objects={['manmessage', 'fleet', 'army']}
			components={{
				manmessage: (innerProps) => (
					<SimpleMessage
						object="manmessage"
						message={
							<Alert
								style={{ marginTop: -20 }}
								message="Reminder: Resolve peace offers offline. All inputted peace automatically pass."
								type="info"
							/>
						}
						data={innerProps.data}
					/>
				),
				fleet: (innerProps) => (
					<MultiOptionSelect
						object="fleet"
						setThing="setFleetMan"
						getAPI={proposalAPI.getFleetOptions}
						peaceAPI={proposalAPI.getFleetPeaceOptions}
						allGoodAPI={proposalAPI.allFleetsMoved}
						message="Move fleets:"
						data={innerProps.data}
					/>
				),
				army: (innerProps) => (
					<MultiOptionSelect
						object="army"
						setThing="setArmyMan"
						getAPI={proposalAPI.getArmyOptions}
						peaceAPI={proposalAPI.getArmyPeaceOptions}
						allGoodAPI={proposalAPI.allArmiesMoved}
						message="Move Armies:"
						data={innerProps.data}
					/>
				),
			}}
			submit={false}
			triggers={{}}
			type="move"
			data={props.data}
		/>
	);
}

// --- Main ProposalApp ---

function ProposalApp() {
	return (
		<ActionFlow
			className="ProposalApp"
			submitMethod={submitAPI.submitProposal}
			objects={['prevprop', 'wheel', 'move']}
			components={{
				prevprop: (props) => (
					<MessageDisplay
						object="prevprop"
						getAPI={proposalAPI.getPreviousProposalMessage}
						divider={true}
						data={props.data}
					/>
				),
				wheel: (props) => (
					<OptionSelect
						object="wheel"
						setThing="setWheelSpot"
						getAPI={proposalAPI.getWheelOptions}
						message="Spin to:"
						costs={['', '', '', '($2)', '($4)', '($6)']}
						data={props.data}
						mapMode="select-rondel"
					/>
				),
				move: null,
			}}
			submit={true}
			triggers={{
				wheel: [
					'move',
					{
						Factory: FactoryFlow,
						'R-Produce': ProduceFlow,
						Investor: InvestorFlow,
						'L-Produce': ProduceFlow,
						'R-Maneuver': ManeuverStartMessage,
						'L-Maneuver': ManeuverStartMessage,
						Taxation: TaxFlow,
						Import: ImportFlow,
					},
				],
			}}
			type="proposal"
		/>
	);
}

export default ProposalApp;
