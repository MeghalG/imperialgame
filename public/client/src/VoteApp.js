import React from 'react';
import './App.css';
import {RadioComponent} from './ComponentTemplates.js';
import {ActionComponent} from './ComponentTemplates.js';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';

class VoteApp extends ActionComponent {
    constructor(props) {
        super(props);
        this.state = {
                        className: "VoteApp", submitMethod: submitAPI.submitVote, 
                        objects: ["options"],
                        options: "",
                        visibleLayers: [true, false],
                        components: {options: VoteRadioComponent},
                        type: "vote",
                        submit: true,
                        triggers: {},
                        keys: [0,0]
        }
    }
}

class VoteRadioComponent extends RadioComponent {
    constructor(props) {
        super(props);
        this.state = {object: "options", choices: [], setThing: "setVote", thing: "vote", getAPI: miscAPI.getVoteOptions, message: "Vote for one of these proposals."};
    }
}

export default VoteApp;
