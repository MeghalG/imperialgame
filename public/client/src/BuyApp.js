import React from 'react';
import './App.css';
import {OptionComponent} from './ComponentTemplates.js';
import {ActionComponent} from './ComponentTemplates.js';
import * as submitAPI from './backendFiles/submitAPI.js';
import * as buyAPI from './backendFiles/buyAPI.js';

class BuyApp extends ActionComponent {
    constructor(props) {
        super(props);
        this.state = {
                        className: "BuyApp", submitMethod: submitAPI.submitBuy, 
                        objects: ["country", "return", "stock"],
                        country: "",
                        return: "",
                        stock : "",
                        visibleLayers: [true, false, false, false],
                        components: {country: BuyCountryComponent, return: ReturnStockComponent, stock: BuyStockComponent},
                        type: "buy",
                        submit: true,
                        triggers: {},
                        keys: [0,0,0,0]
        }
    }
}

class BuyCountryComponent extends OptionComponent {
    constructor(props) {
        super(props);
        this.state = {object: "country", choices: [], setThing: "setBuyCountry", thing: "buyCountry", getAPI: buyAPI.getCountryOptions, message: "Country:"};
    }
}

class ReturnStockComponent extends OptionComponent {
    constructor(props) {
        super(props);
        this.state = {object: "return", choices: [], setThing: "setReturnStock", thing: "returnStock", getAPI: buyAPI.getReturnStockOptions, message: "Return:"};
    }
}

class BuyStockComponent extends OptionComponent {
    constructor(props) {
        super(props);
        this.state = {object: "stock", choices: [], setThing: "setBuyStock", thing: "buyStock", getAPI: buyAPI.getStockOptions, message: "Stock:"};
    }
}

export default BuyApp;
