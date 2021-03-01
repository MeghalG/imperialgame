/*import React from 'react';
import './App.css';
import {SimpleMessageComponent, MultiOptionComponent} from './ComponentTemplates.js';
import {ActionComponent} from './ComponentTemplates.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import * as proposalAPI from './backendFiles/proposalAPI.js';


class ContinueManeuverApp extends ActionComponent {
    constructor(props) {
        super(props);
        this.state = {
                        className: "ManeuverApp", submitMethod: submitAPI.submitManeuver, 
                        objects: ["fleet", "army"],
                        fleet: "",
                        army: "",
                        visibleLayers: [true, false, false],
                        components: {fleet: FleetApp, army: BlankMessageApp},
                        type: "move",
                        submit: true,
                        triggers: {wheel: ["move", {"show next": ArmyApp, "done": BlankMessageApp,}]},
                        keys: [0,0],
        }
    }
}

class BlankMessageApp extends SimpleMessageComponent {
    constructor(props) {
        super(props);
        this.state = {object: "army", message: ""};
    }
}

class FleetApp extends MultiOptionComponent {
    constructor(props) {
        super(props);
        this.state = {object: "fleet", choices: [], setThing: "setFleetMan", thing: "fleetMan", getAPI: proposalAPI.getFleetOptions, peaceAPI: proposalAPI.getFleetPeaceOptions, setPeaceThing: "setFleetPeace", peaceThing: "fleetPeace", allGoodAPI: proposalAPI.legalFleetMove, doneWithNoPeaceAPI: proposalAPI.allFleetsNoPeace, message: "Move fleets: Leave field blank to move the fleet after peace proposals.",
        values: [], peaceOptions:{}}
    }
}

class ArmyApp extends MultiOptionComponent {
    constructor(props) {
        super(props);
        this.state = {object: "army", choices: [], setThing: "setArmyMan", thing: "armyMan", getAPI: proposalAPI.getArmyOptions, peaceAPI: proposalAPI.getArmyPeaceOptions, setPeaceThing: "setArmyPeace", peaceThing: "armyPeace", allGoodAPI: proposalAPI.legalArmyMove, doneWithNoPeaceAPI: proposalAPI.allArmiesNoPeace, message: "Move armies: Leave field blank to move the army after peace proposals.",
        values: [], peaceOptions:{}}
    }
}

export default ContinueManeuverApp;
*/