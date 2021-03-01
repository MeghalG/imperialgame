import React from 'react';
import './App.css';
import { Radio, Button } from 'antd';
import 'antd/dist/antd.css';
import { Select, Checkbox, Divider } from 'antd';
import UserContext from './UserContext.js'
const { Option } = Select;




class ImportComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }

    makeOptions = () => {
        let table = [];
        let keyOpt = [];
        let disKeyOpt = [];
        for (let key in this.state.options) {
            let count = 0;
            for (let v of this.state.keyValues) {
                if (key == v) {
                    count +=1;
                }
            }
            disKeyOpt.push(<Option key={key} value={key} disabled={count==this.state.limits[key]}> {key} </Option>);
        }
        for (let key in this.state.options) {
            keyOpt.push(<Option key={key} value={key}> {key} </Option>);
        }
        for(let i = 0; i < this.state.labels.length; i++) {
            let lab = <label style={{whiteSpace:"nowrap", marginLeft:10}}>{this.state.labels[i]}: &nbsp; &nbsp; &nbsp; </label>;
            let sel = null;
            if (this.state.keyValues[i]) {
                sel = <Select allowClear={true} style={{marginLeft: 20, marginRight:10, width:'100%'}} defaultValue={this.state.keyValues[i]} onChange={(value) => this.sendKeyValue(i, value)}> {keyOpt} </Select>;
            }
            else {
                sel = <Select allowClear={true} style={{marginLeft: 20, marginRight:10, width:'100%'}} defaultValue={this.state.keyValues[i]} onChange={(value) => this.sendKeyValue(i, value)}> {disKeyOpt} </Select>;
            }
            let selVal = null;
            if (this.state.valueOptions[this.state.keyValues[i]]) {
                selVal = <Select allowClear={true} style={{marginLeft: 10, width:'100%'}} key={i+this.state.keyValues[i]} defaultValue={""} onChange={(value) => this.sendValue(i, value)}> {this.state.valueOptions[this.state.keyValues[i]]} </Select>;
            }
            else {
                selVal = <Select disabled={true} style={{marginLeft: 10, width:'100%'}}> </Select>;
            }
            table.push(<div style={{display:"flex", marginBottom:30}}> {lab} {sel} in {selVal} </div>)
        }
        return table;
    }

    dataIfDone() {
        this.context[this.state.setThing]({types: this.state.keyValues, territories: this.state.values});
        for (let i in this.state.keyValues) {
            if (this.state.keyValues[i] && !this.state.values[i]) {
                this.props.data("", this.state.object);
                return;
            }
        }
        this.props.data("done", this.state.object);
    }

    async sendKeyValue(key, value) {
        let temp = this.state.keyValues;
        if (value===undefined){
            value="";
        }
        temp[key]=value;
        let tempV = this.state.values;
        tempV[key]="";
        await this.setState({keyValues: temp, values: tempV});
        this.dataIfDone();
    }

    async sendValue(key, value) {
        let temp = this.state.values;
        if (value===undefined){
            value="";
        }
        temp[key]=value;
        await this.setState({values: temp});
        this.dataIfDone();
    }
    componentWillUnmount() {
        this.context[this.state.setThing]({});
    }
    componentDidMount() {
        this.getStuff();
        this.props.data("done", this.state.object);
    }
    async getStuff() {
        let res = await this.state.getAPI(this.context);
        await this.setState({ labels: res.labels, options: res.options, limits: res.limits, keyValues: new Array(res.labels.length).fill(""), values: new Array(res.labels.length).fill("")});
        let valueOpt = {};
        for (let key in this.state.options) {
            valueOpt[key]=[];
            for (let val of this.state.options[key]) {
                valueOpt[key].push(<Option key={val} value={val}> {val} </Option>)
            }
        }
        this.setState({valueOptions: valueOpt})
    }
    render() {
        if (this.state.options.length==0) {
            return <div />
        }
        return (
        <div style={{marginBottom: 20}}>
            <div style={{marginBottom:10}}>
                <label> {this.state.message} </label> <br/>
            </div>
            {this.makeOptions()}
        </div>
        );
    }
}
ImportComponent.contextType = UserContext;

class MultiOptionComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {choices: []};
    }

    makeOptions = () => {
        if (this.state.values.length==0) {
            return null;
        }
        let table = [];
        for(let i = 0; i < this.state.choices.length; i++) {
            let t=[];
            var opt = this.state.choices[i][1];
            for (var j=0; j<opt.length; j++) {
                t.push(<Option key={j} value={opt[j]}> {opt[j]} </Option>);
            }
            let lab =  <label style={{whiteSpace:"nowrap", marginLeft:10}}>{this.state.choices[i][0]} &nbsp;&nbsp; ⟶ </label>;
            let sel = <Select allowClear={true} style={{marginLeft: 30, width:'100%'}} value={this.state.values[i][1]} onChange={(value) => this.sendValue(i, value)}> {t} </Select>;
            let peace = null;
            if (this.state.peaceOptions.hasOwnProperty(this.state.values[i][1])) {
                let optp = [...this.state.peaceOptions[this.state.values[i][1]]];
                if (this.state.values[i][2] && this.state.values[i][2]!="peace") {
                    optp.push(this.state.values[i][2]);
                }
                if (optp.length==1) {
                    optp = [];
                }
                if (optp.length>0) {
                    let pt = [];
                    for (var j=0; j<optp.length; j++) {
                        pt.push(<Option key={j} value={optp[j]}> {optp[j]} </Option>);
                    }
                    peace = <Select allowClear={true} style={{marginLeft: 200, width:'100%'}} value={this.state.values[i][2]} onChange={(value) => this.sendPeaceValue(i, value)}> {pt} </Select>;
                }
            }
            table.push(<div> <div style={{display:"flex", marginBottom:10}}> {lab} {sel}</div> <div style={{display:"flex", marginBottom:10}}> {peace} </div></div>)
        }
        return table;
    }
    
    initialize() {
        this.setState({values: this.state.choices.map(x => [x[0], "", ""])});
    }
    async getNewOptions() {
        let peaceres = await this.state.peaceAPI(this.context);
        this.setState({peaceOptions: peaceres});
        let res = await this.state.getAPI(this.context);
        this.setState({ choices: res });
        if (res.length==0) {
            this.props.data("done", this.state.object);
        }
    }

    async sendPeaceValue(key, value) {
        let temp = this.state.values;
        if (value===undefined){
            value="";
        }
        temp[key][2]=value;
        await this.setState({values: temp});
        await this.context[this.state.setThing](this.state.values);
        await this.getNewOptions();

        for (let i in this.state.values) {
            if (this.state.values[i]) {
                if ((this.state.peaceOptions[this.state.values[i][1]] || []).length<=1) {
                    if (this.state.values[i][2]=="peace") {
                        this.state.values[i][2]="";
                    }
                }
            }
        }
        await this.context[this.state.setThing](this.state.values);
        await this.getNewOptions();

        let b = await this.state.allGoodAPI(this.context);
        if (b) {
            this.props.data("show next", this.state.object);
        }
        else {
            this.props.data("", this.state.object);
        }
    }
    
    async sendValue(key, value) {
        let temp = this.state.values;
        if (value===undefined){
            value="";
        }
        temp[key][1]=value;
        temp[key][2]="";
        await this.setState({values: temp});
        this.context[this.state.setThing](this.state.values);

        let b = await this.state.allGoodAPI(this.context);
        if (b) {
            this.props.data("show next", this.state.object);
        }
        else {
            this.props.data("", this.state.object);
        }
        await this.getNewOptions();
    }
    componentWillUnmount() {
        this.context[this.state.setThing]([]);
    }
    async componentDidMount() {
        await this.doStuff();
        await this.initialize();
    } 
    async doStuff() {
        let res = await this.state.getAPI(this.context);
        this.setState({ choices: res });
        if (res.length==0) {
            console.log("here")
            this.props.data("show next", this.state.object);
        }
    }
    render() {
        if (this.state.choices.length==0) {
            return <div />
        }
        return (
        <div style={{marginBottom: 20}}>
            <div style={{marginBottom:10}}>
                <label> {this.state.message} </label> <br/>
            </div>
            {this.makeOptions()}
        </div>
        );
    }
}
MultiOptionComponent.contextType = UserContext;

class OptionComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {choices: []};
    }
    makeOptions = () => {
        let table = []
        for(var i = 0; i < this.state.choices.length; i++) {
            var opt = this.state.choices[i];
            let optCost = "";
            // hacky way to deal with center
            if (this.state.costs && this.state.choices.length<8) {
                optCost = this.state.costs[i]
            }
            table.push(<Option key={i} value={opt}> {opt} {<span style={{color:"#13a8a8"}}> {optCost} </span>} </Option>);
        }
        return table;
    }
    sendValue(value) {
        this.props.data(value, this.state.object);
        this.context[this.state.setThing](value);
    }
    async setChoices() {
        let res = await this.state.getAPI(this.context);
        this.setState({ choices: res });
        if (this.state.choices.length==0) {
            this.props.data("done", this.state.object);
        }
    }
    componentDidMount() {
        this.setChoices();
    }
    render() {
        if (this.state.choices.length==0) {
            return <div />
        }
        return (
            <div style={{marginBottom: 30, display:"flex"}}>
                <label style={{paddingRight:'50px', whiteSpace:"nowrap"}}> {this.state.message} </label>
                <Select allowClear={true} style={{width:'100%'}} placeholder="" onChange={value => this.sendValue(value)}>
                    {this.makeOptions()}
                </Select>
            </div>
        );
    }
}
OptionComponent.contextType = UserContext;

class RadioComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {choices: []};
    }
    makeOptions = () => {
        let table = [];
        for(var i = 0; i < this.state.choices.length; i++) {
            var opt = this.state.choices[i];
            table.push(<Radio value={i} style={{marginLeft:48, marginTop:10, textIndent:-28, whiteSpace:"normal"}}> {opt} </Radio>);
        }
        return table;
    }
    sendValue(e) {
        this.props.data(e.target.value+1, this.state.object);
        this.context[this.state.setThing](e.target.value+1)
    }
    componentDidMount() {
        this.doStuff();
    }
    async doStuff() {
        let res = await this.state.getAPI(this.context);
        this.setState({ choices: res });
        if (res.length==0) {
            this.props.data("done", this.state.object);
        }
    }
    render() {
        if (this.state.choices.length==0) {
            return <div />
        }
        return (
            <div style={{marginBottom: 30}}>
                <label style={{paddingRight:'50px'}}> {this.state.message} </label>
                <br />
                <Radio.Group onChange={(value) => this.sendValue(value)}>
                    {this.makeOptions()}
                </Radio.Group>
            </div>
        );
    }
}
RadioComponent.contextType = UserContext;

class CheckboxComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    makeOptions = () => {
        let table = [];
        for(var i = 0; i < this.state.items.length; i++) {
            var opt = this.state.items[i];
            table.push(<Checkbox value={opt} disabled={this.isDisabled({opt})}> {opt} {this.state.type} </Checkbox>);
            table.push(<br />);
        }
        return table;
    }

    isDisabled = obj => {
        return (
          this.state.checked.length > this.state.limit-1 && this.state.checked.indexOf(obj.opt) == -1
        );
    };
    sendValue(checkedValues) {
        this.setState({checked: checkedValues});
        this.context[this.state.setThing](checkedValues)
    }
    componentDidMount() {
        this.getChoices();
        this.props.data("done", this.state.object);
    }
    async getChoices() {
        let res = await this.state.getAPI(this.context);
        let checked = Array.from(res.items).splice(0,res.limit);
        this.setState({ items: res.items, limit: res.limit, checked: checked});
        this.context[this.state.setThing](checked);
    }
    render() {
        if (this.state.items.length == 0) {
            return <div></div>;
        }
        return (
        <div style={{marginBottom: 30}}>
            <label style={{paddingRight:'50px', whiteSpace:"nowrap"}}> {this.state.message} </label>
            <Checkbox.Group onChange={this.sendValue.bind(this)} value={this.state.checked}>
                {this.makeOptions()}
            </Checkbox.Group>
        </div>
        );
    }
}
CheckboxComponent.contextType = UserContext;

class MessageComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {divider: false};
    }
    componentDidMount() {
        this.doStuff();
        this.props.data("posted", this.state.object);
    }
    async doStuff() {
        let res = await this.state.getAPI(this.context)
        this.setState({ message: res });
    }
    makeMessage = () => {
        if (this.state.message!="") {
            return (
                <div style={{marginBottom: 30}}>
                    {this.state.message}
                    {this.makeDivider()}
                </div>
            );
        }
        else {
            return null;
        }
    }
    makeDivider = () => {
        if (this.state.divider) {
            return <Divider style={{marginTop:15}}/>
        }
        else {
            return null
        }
    }
    render() {
        return (
            <div> {this.makeMessage()} </div>
        );
    }
}
MessageComponent.contextType = UserContext;

class SimpleMessageComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    componentDidMount() {
        this.props.data("posted", this.state.object);
    }
    render() {
        return (
        <div style={{marginBottom: 10}}>
            {this.state.message}
        </div>
        );
    }
}
SimpleMessageComponent.contextType = UserContext;

class Submit extends React.Component{
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        return (
        <div style={{textAlign: "center"}}>
            <Button type="primary" onClick={() => this.props.data()} disabled={this.props.disabled}>
                Submit
            </Button>
        </div>
        );
    }
}
Submit.contextType = UserContext;

function Display(props) {
    if (props.submit) {
        return <props.component data={props.fn} key={props.k} disabled={!props.show}/>;
    }
    if (props.show) {
        return <props.component data={props.fn} key={props.k} disabled={false}/>;
    }
    return "";
}

class ActionComponent extends React.Component {
    constructor(props) {
        super(props);
    }
  
    update = async (value, object) => {
        await this.setState({[object]: value});
        let visLayers = new Array(this.state.visibleLayers.length).fill(false);
        // note that object values don't get reset; add if needed
        for (let i = 0; i < this.state.objects.indexOf(object)+2; i++) {
            visLayers[i]=true;
        }
        if (!value) {
            visLayers[this.state.objects.indexOf(object)+1]=false;
        }
        let keys = this.state.keys;
        keys[this.state.objects.indexOf(object)+1]+=1;
        for (const [key, tup] of Object.entries(this.state.triggers)) {
            if (this.state[key]) {
                this.state.components[tup[0]] = tup[1][this.state[key]];
            }
        }
        await this.setState({visibleLayers: visLayers})
        if (this.props.data) {
            if (!this.state.submit && this.state.visibleLayers[this.state.visibleLayers.length-1] && value) {
                this.props.data("chosen", this.state.type);
            }
            else {
                this.props.data("", this.state.type);
            }
        }
    }

    async submit() {
        await this.state.submitMethod(this.context);
    }

    buildComponents = () => {
        let table = []
        for(var i = 0; i < this.state.objects.length; i++) {
            let vis = this.state.visibleLayers[i];
            table.push(<Display component={this.state.components[this.state.objects[i]]} show={vis} fn = {this.update.bind(this)} k={this.state.keys[i]}/>)
        }
        table.push(<Display component={Submit} show={this.state.visibleLayers[this.state.visibleLayers.length-1]&&this.state.submit} fn = {this.submit.bind(this)} k={this.state.keys[this.state.visibleLayers.length-1]} submit={this.state.submit}/>)
        return table;
    }
  
    render() {
        return (
            <div className={this.state.className}>
                {this.buildComponents()}
            </div>
        );
    }
}
ActionComponent.contextType = UserContext;


export {OptionComponent, Display, Submit, ActionComponent, MessageComponent, MultiOptionComponent, ImportComponent, CheckboxComponent, SimpleMessageComponent, RadioComponent};