import React from 'react';
import './App.css';
import ProposalApp from './ProposalApp.js';
import UserContext from './UserContext.js'
import { Radio, Button } from 'antd';
import * as submitAPI from './backendFiles/submitAPI.js';

class ProposalAppOpp extends React.Component {
    constructor(props) {
        super(props);
        this.state = {proposal: false}
    }

    setProposal(e) {
        console.log(e.target.value);
        this.setState({proposal:e.target.value})
    }

    render() {
        return (
            <div>
                <div style={{marginBottom: 30}}> Do you want to counterpropose? </div>
                <div style={{marginBottom: 30, marginLeft: 10}}>
                    <Radio.Group defaultValue={false} options={[{label:"Yes", value:true},{label:"No", value:false}]} onChange={(e) => this.setProposal(e)} />
                </div>
                {this.state.proposal
                    ?   <ProposalApp key={this.props.key}/>
                    :   <div style={{textAlign: "center"}}>
                        <Button type="primary" onClick={() => submitAPI.submitNoCounter(this.context)}>
                            Submit
                        </Button>
                        </div>
                }
            </div>
            
        )
    }
}
ProposalAppOpp.contextType = UserContext;

export default ProposalAppOpp;