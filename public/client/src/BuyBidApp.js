import React from 'react';
import './App.css';
import UserContext from './UserContext.js'
import { Button } from 'antd';
import { Radio } from 'antd';
import * as miscAPI from './backendFiles/miscAPI.js';
import * as submitAPI from './backendFiles/submitAPI.js';


class BuyBidApp extends React.Component{
    constructor(props) {
        super(props);
        this.state = {
            chosen: false,
            bid: 0,
            stock: {country: "", value: 0}
        };
    }

    componentDidMount() {
        this.getBid();
        this.getStock();
    }

    async getBid() {
        let res = await miscAPI.getBid(this.context);
        this.setState({bid: res});
    }

    async getStock() {
        let res = await miscAPI.getStock(this.context);
        this.setState({stock: res});
    }

    submit() {
        submitAPI.bidBuy(this.context);
    }

    chooseBid(e) {
        this.setState({chosen: true});
        this.context.setBuyBid(e.target.value);
    }

    render () {
        return (
            <div>
                <div style={{marginBottom: 30}}> Would you like to spend ${this.state.bid} on the {this.state.stock.country} {this.state.stock.value}? </div>
                <div style={{marginBottom: 30, marginLeft: 10}}>
                    <Radio.Group options={[{label:"Yes", value:true},{label:"No", value:false}]} onChange={(e) => this.chooseBid(e)}  />
                </div>
                <div style={{textAlign: "center"}}> <Button onClick={() => this.submit()} type="primary" disabled={!this.state.chosen}> Submit </Button> </div>
            </div>
        );
    }
}
BuyBidApp.contextType = UserContext;

export default BuyBidApp;