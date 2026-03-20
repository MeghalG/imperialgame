import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import './App.css';
import { Radio, Button } from 'antd';
import { Select, Checkbox, Divider } from 'antd';
import UserContext from './UserContext.js';
import MapInteractionContext from './MapInteractionContext.js';
import SoundManager from './SoundManager.js';
import useMapTerritorySelect from './useMapTerritorySelect.js';
import ImportTypePicker from './ImportTypePicker.js';
const { Option } = Select;

function ImportSelect({ object, setThing, getAPI, message, data, mapMode, mapColor }) {
	const context = useContext(UserContext);
	const mapInteraction = useContext(MapInteractionContext);
	const [labels, setLabels] = useState([]);
	const [options, setOptions] = useState({});
	const [limits, setLimits] = useState({});
	const [keyValues, setKeyValues] = useState([]);
	const [values, setValues] = useState([]);
	const [valueOptions, setValueOptions] = useState({});
	const [pickerState, setPickerState] = useState(null);

	const keyValuesRef = useRef([]);
	const valuesRef = useRef([]);
	const limitsRef = useRef({});
	const optionsRef = useRef({});

	useEffect(() => {
		data('done', object);
		async function fetchOptions() {
			let res = await getAPI(context);
			setLabels(res.labels);
			setOptions(res.options);
			setLimits(res.limits);
			optionsRef.current = res.options;
			limitsRef.current = res.limits;
			let initKV = new Array(res.labels.length).fill('');
			let initV = new Array(res.labels.length).fill('');
			setKeyValues(initKV);
			setValues(initV);
			keyValuesRef.current = initKV;
			valuesRef.current = initV;
			let valueOpt = {};
			for (let key in res.options) {
				valueOpt[key] = [];
				for (let val of res.options[key]) {
					valueOpt[key].push(
						<Option key={val} value={val}>
							{' '}
							{val}{' '}
						</Option>
					);
				}
			}
			setValueOptions(valueOpt);
		}
		fetchOptions();
		return () => {
			context[setThing]({});
			if (mapMode) {
				mapInteraction.setUnitMarkers([]);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function dataIfDone(kv, v) {
		context[setThing]({ types: kv, territories: v });
		for (let i in kv) {
			if (kv[i] && !v[i]) {
				data('', object);
				return;
			}
		}
		data('done', object);
	}

	function sendKeyValue(key, value) {
		if (value === undefined) value = '';
		let newKV = [...keyValues];
		newKV[key] = value;
		let newV = [...values];
		newV[key] = '';
		setKeyValues(newKV);
		setValues(newV);
		keyValuesRef.current = newKV;
		valuesRef.current = newV;
		dataIfDone(newKV, newV);
	}

	function sendValue(key, value) {
		if (value === undefined) value = '';
		let newV = [...values];
		newV[key] = value;
		setValues(newV);
		valuesRef.current = newV;
		dataIfDone(keyValues, newV);
	}

	function fillSlotFromMap(territory, unitType) {
		let kv = [...keyValuesRef.current];
		let v = [...valuesRef.current];
		let slotIdx = -1;
		for (let i = 0; i < kv.length; i++) {
			if (!kv[i] && !v[i]) {
				slotIdx = i;
				break;
			}
		}
		if (slotIdx === -1) return;
		kv[slotIdx] = unitType;
		v[slotIdx] = territory;
		setKeyValues(kv);
		setValues(v);
		keyValuesRef.current = kv;
		valuesRef.current = v;
		dataIfDone(kv, v);
	}

	function getAvailableTypesForTerritory(territory) {
		let opts = optionsRef.current;
		let lim = limitsRef.current;
		let kv = keyValuesRef.current;
		let types = [];
		let armyCount = kv.filter((t) => t === 'army').length;
		let fleetCount = kv.filter((t) => t === 'fleet').length;
		if ((opts.army || []).includes(territory) && armyCount < (lim.army || 0)) {
			types.push('army');
		}
		if ((opts.fleet || []).includes(territory) && fleetCount < (lim.fleet || 0)) {
			types.push('fleet');
		}
		return types;
	}

	let allTerritories = useMemo(() => {
		if (!mapMode || Object.keys(options).length === 0) return [];
		let seen = new Set();
		let result = [];
		for (let key in options) {
			for (let t of options[key]) {
				if (!seen.has(t)) {
					seen.add(t);
					result.push(t);
				}
			}
		}
		return result;
	}, [mapMode, options]);

	useMapTerritorySelect(
		mapMode && allTerritories.length > 0 ? mapMode : null,
		allTerritories,
		mapColor || '#c9a84c',
		(name, event) => {
			let kv = keyValuesRef.current;
			let hasEmpty = kv.some((v) => !v);
			if (!hasEmpty) return;
			let types = getAvailableTypesForTerritory(name);
			if (types.length === 0) return;
			if (types.length === 1) {
				fillSlotFromMap(name, types[0]);
			} else {
				let x = event && event.clientX ? event.clientX : 200;
				let y = event && event.clientY ? event.clientY : 200;
				setPickerState({ territory: name, position: { x, y }, availableTypes: types });
			}
		}
	);

	useEffect(() => {
		if (!mapMode) return;
		let markers = [];
		for (let i = 0; i < keyValues.length; i++) {
			if (keyValues[i] && values[i]) {
				markers.push({
					territoryName: values[i],
					unitType: keyValues[i],
					phase: 'ghost',
					index: i,
					isActive: false,
					isPlanned: false,
					isGhosted: true,
					color: keyValues[i] === 'fleet' ? '#4DAADB' : '#D4A843',
				});
			}
		}
		mapInteraction.setUnitMarkers(markers);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [keyValues, values, mapMode]);

	function makeOptions() {
		let table = [];
		let keyOpt = [];
		let disKeyOpt = [];
		for (let key in options) {
			let count = 0;
			for (let v of keyValues) {
				if (key === v) {
					count += 1;
				}
			}
			disKeyOpt.push(
				<Option key={key} value={key} disabled={count === limits[key]}>
					{' '}
					{key}{' '}
				</Option>
			);
		}
		for (let key in options) {
			keyOpt.push(
				<Option key={key} value={key}>
					{' '}
					{key}{' '}
				</Option>
			);
		}
		for (let i = 0; i < labels.length; i++) {
			let lab = <label style={{ whiteSpace: 'nowrap', marginLeft: 10 }}>{labels[i]}: &nbsp; &nbsp; &nbsp; </label>;
			let sel = null;
			if (keyValues[i]) {
				sel = (
					<Select
						allowClear={true}
						style={{ marginLeft: 20, marginRight: 10, width: '100%' }}
						key={'type-' + i + '-' + keyValues[i]}
						defaultValue={keyValues[i]}
						onChange={(value) => sendKeyValue(i, value)}
					>
						{' '}
						{keyOpt}{' '}
					</Select>
				);
			} else {
				sel = (
					<Select
						allowClear={true}
						style={{ marginLeft: 20, marginRight: 10, width: '100%' }}
						key={'type-' + i + '-empty'}
						defaultValue={keyValues[i]}
						onChange={(value) => sendKeyValue(i, value)}
					>
						{' '}
						{disKeyOpt}{' '}
					</Select>
				);
			}
			let selVal = null;
			if (valueOptions[keyValues[i]]) {
				selVal = (
					<Select
						allowClear={true}
						style={{ marginLeft: 10, width: '100%' }}
						key={'val-' + i + '-' + keyValues[i]}
						defaultValue={values[i] || ''}
						onChange={(value) => sendValue(i, value)}
					>
						{' '}
						{valueOptions[keyValues[i]]}{' '}
					</Select>
				);
			} else {
				selVal = (
					<Select disabled={true} style={{ marginLeft: 10, width: '100%' }}>
						{' '}
					</Select>
				);
			}
			table.push(
				<div key={i} style={{ display: 'flex', marginBottom: 30 }}>
					{' '}
					{lab} {sel} in {selVal}{' '}
				</div>
			);
		}
		return table;
	}

	if (Object.keys(options).length === 0) {
		return <div />;
	}
	return (
		<div style={{ marginBottom: 20 }}>
			<div style={{ marginBottom: 10 }}>
				<label> {message} </label> <br />
			</div>
			{makeOptions()}
			{pickerState && (
				<ImportTypePicker
					position={pickerState.position}
					availableTypes={pickerState.availableTypes}
					onSelect={(type) => {
						fillSlotFromMap(pickerState.territory, type);
						setPickerState(null);
					}}
					onDismiss={() => setPickerState(null)}
				/>
			)}
		</div>
	);
}

function MultiOptionSelect({ object, setThing, getAPI, peaceAPI, allGoodAPI, message, data }) {
	const context = useContext(UserContext);
	const [choices, setChoices] = useState([]);
	const [values, setValuesState] = useState([]);
	const [peaceOptions, setPeaceOptions] = useState({});

	useEffect(() => {
		async function init() {
			let res = await getAPI(context);
			setChoices(res);
			if (res.length === 0) {
				data('show next', object);
			} else {
				setValuesState(res.map((x) => [x[0], '', '']));
			}
		}
		init();
		return () => {
			context[setThing]([]);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function getNewOptions(currentValues) {
		let peaceres = await peaceAPI(context);
		setPeaceOptions(peaceres);
		let res = await getAPI(context);
		setChoices(res);
		if (res.length === 0) {
			data('done', object);
		}
	}

	async function sendPeaceValue(key, value) {
		if (value === undefined) {
			value = '';
		}
		let temp = values.map((v) => [...v]);
		temp[key][2] = value;
		setValuesState(temp);
		await context[setThing](temp);
		let peaceres = await peaceAPI(context);
		setPeaceOptions(peaceres);
		let res = await getAPI(context);
		setChoices(res);

		for (let i in temp) {
			if (temp[i]) {
				if ((peaceres[temp[i][1]] || []).length <= 1) {
					if (temp[i][2] === 'peace') {
						temp[i][2] = '';
					}
				}
			}
		}
		let temp2 = temp.map((v) => [...v]);
		setValuesState(temp2);
		await context[setThing](temp2);
		let peaceres2 = await peaceAPI(context);
		setPeaceOptions(peaceres2);
		let res2 = await getAPI(context);
		setChoices(res2);

		let b = await allGoodAPI(context);
		if (b) {
			data('show next', object);
		} else {
			data('', object);
		}
	}

	async function sendValue(key, value) {
		if (value === undefined) {
			value = '';
		}
		let temp = values.map((v) => [...v]);
		temp[key][1] = value;
		temp[key][2] = '';
		setValuesState(temp);
		context[setThing](temp);

		let b = await allGoodAPI(context);
		if (b) {
			data('show next', object);
		} else {
			data('', object);
		}
		await getNewOptions(temp);
	}

	function makeOptions() {
		if (values.length === 0) {
			return null;
		}
		let table = [];
		for (let i = 0; i < choices.length; i++) {
			let t = [];
			let opt = choices[i][1];
			for (let j = 0; j < opt.length; j++) {
				t.push(
					<Option key={j} value={opt[j]}>
						{' '}
						{opt[j]}{' '}
					</Option>
				);
			}
			let lab = <label style={{ whiteSpace: 'nowrap', marginLeft: 10 }}>{choices[i][0]} &nbsp;&nbsp; &#10230; </label>;
			let sel = (
				<Select
					allowClear={true}
					style={{ marginLeft: 30, width: '100%' }}
					value={values[i][1]}
					onChange={(value) => sendValue(i, value)}
				>
					{' '}
					{t}{' '}
				</Select>
			);
			let peace = null;
			if (peaceOptions.hasOwnProperty(values[i][1])) {
				let optp = [...peaceOptions[values[i][1]]];
				if (values[i][2] && values[i][2] !== 'peace') {
					optp.push(values[i][2]);
				}
				if (optp.length === 1) {
					optp = [];
				}
				if (optp.length > 0) {
					let pt = [];
					for (let j = 0; j < optp.length; j++) {
						pt.push(
							<Option key={j} value={optp[j]}>
								{' '}
								{optp[j]}{' '}
							</Option>
						);
					}
					peace = (
						<Select
							allowClear={true}
							style={{ marginLeft: 200, width: '100%' }}
							value={values[i][2]}
							onChange={(value) => sendPeaceValue(i, value)}
						>
							{' '}
							{pt}{' '}
						</Select>
					);
				}
			}
			table.push(
				<div>
					{' '}
					<div style={{ display: 'flex', marginBottom: 10 }}>
						{' '}
						{lab} {sel}
					</div>{' '}
					<div style={{ display: 'flex', marginBottom: 10 }}> {peace} </div>
				</div>
			);
		}
		return table;
	}

	if (choices.length === 0) {
		return <div />;
	}
	return (
		<div style={{ marginBottom: 20 }}>
			<div style={{ marginBottom: 10 }}>
				<label> {message} </label> <br />
			</div>
			{makeOptions()}
		</div>
	);
}

function OptionSelect({ object, setThing, getAPI, message, costs, data, mapMode, mapColor }) {
	const context = useContext(UserContext);
	const [choices, setChoices] = useState([]);
	const [controlledValue, setControlledValue] = useState(undefined);
	const sendValueRef = useRef(null);

	function sendValue(value) {
		setControlledValue(value || undefined);
		data(value, object);
		context[setThing](value);
	}
	sendValueRef.current = sendValue;

	useEffect(() => {
		async function fetchChoices() {
			let res = await getAPI(context);
			setChoices(res);
			if (res.length === 0) {
				data('done', object);
			}
		}
		fetchChoices();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Build cost map for the hook (same logic as before)
	let costMap = null;
	if (costs && choices.length > 0 && choices.length < 8) {
		costMap = {};
		choices.forEach((choice, i) => {
			if (costs[i]) costMap[choice] = costs[i];
		});
	}

	useMapTerritorySelect(
		mapMode && choices.length > 0 ? mapMode : null,
		choices,
		mapColor || '#c9a84c',
		(name) => {
			if (sendValueRef.current) sendValueRef.current(name);
		},
		costMap
	);

	if (choices.length === 0) {
		return <div />;
	}
	return (
		<div style={{ marginBottom: 30, display: 'flex' }}>
			<label style={{ paddingRight: '50px', whiteSpace: 'nowrap' }}> {message} </label>
			<Select
				allowClear={true}
				style={{ width: '100%' }}
				placeholder=""
				value={controlledValue}
				onChange={(value) => sendValue(value)}
			>
				{choices.map((opt, i) => (
					<Option key={i} value={opt}>
						{' '}
						{opt} {costs && choices.length < 8 && <span style={{ color: '#13a8a8' }}> {costs[i]} </span>}{' '}
					</Option>
				))}
			</Select>
		</div>
	);
}

function RadioSelect({ object, setThing, getAPI, message, data }) {
	const context = useContext(UserContext);
	const [choices, setChoices] = useState([]);

	useEffect(() => {
		async function fetchChoices() {
			let res = await getAPI(context);
			setChoices(res);
			if (res.length === 0) {
				data('done', object);
			}
		}
		fetchChoices();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function sendValue(e) {
		data(e.target.value + 1, object);
		context[setThing](e.target.value + 1);
	}

	if (choices.length === 0) {
		return <div />;
	}
	return (
		<div style={{ marginBottom: 30 }}>
			<label style={{ paddingRight: '50px' }}> {message} </label>
			<br />
			<Radio.Group onChange={(value) => sendValue(value)}>
				{choices.map((opt, i) => (
					<Radio key={i} value={i} style={{ marginLeft: 48, marginTop: 10, textIndent: -28, whiteSpace: 'normal' }}>
						{' '}
						{opt}{' '}
					</Radio>
				))}
			</Radio.Group>
		</div>
	);
}

function CheckboxSelect({ object, setThing, getAPI, message, type, data, mapMode, mapColor, mapUnitType }) {
	const context = useContext(UserContext);
	const mapInteraction = useContext(MapInteractionContext);
	const [items, setItems] = useState([]);
	const [limit, setLimit] = useState(0);
	const [checked, setChecked] = useState([]);
	const checkedRef = useRef([]);
	const limitRef = useRef(0);

	useEffect(() => {
		data('done', object);
		async function fetchChoices() {
			let res = await getAPI(context);
			let initialChecked = Array.from(res.items).splice(0, res.limit);
			setItems(res.items);
			setLimit(res.limit);
			setChecked(initialChecked);
			checkedRef.current = initialChecked;
			limitRef.current = res.limit;
			context[setThing](initialChecked);
		}
		fetchChoices();
		return () => {
			context[setThing]([]);
			if (mapMode) {
				mapInteraction.setUnitMarkers([]);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useMapTerritorySelect(mapMode && items.length > 0 ? mapMode : null, items, mapColor || '#c9a84c', (name) => {
		let current = checkedRef.current;
		let newChecked;
		if (current.includes(name)) {
			newChecked = current.filter((v) => v !== name);
		} else if (current.length < limitRef.current) {
			newChecked = [...current, name];
		} else {
			return;
		}
		setChecked(newChecked);
		checkedRef.current = newChecked;
		context[setThing](newChecked);
	});

	useEffect(() => {
		if (!mapMode || !mapUnitType) return;
		let markers = checked.map((territory, i) => ({
			territoryName: territory,
			unitType: mapUnitType,
			phase: 'ghost',
			index: i,
			isActive: false,
			isPlanned: false,
			isGhosted: true,
			color: mapColor || '#c9a84c',
		}));
		mapInteraction.setUnitMarkers(markers);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [checked, mapMode, mapUnitType]);

	function isDisabled(opt) {
		return checked.length > limit - 1 && checked.indexOf(opt) === -1;
	}

	function sendValue(checkedValues) {
		setChecked(checkedValues);
		checkedRef.current = checkedValues;
		context[setThing](checkedValues);
	}

	if (items.length === 0) {
		return <div></div>;
	}
	return (
		<div style={{ marginBottom: 30 }}>
			<label style={{ paddingRight: '50px', whiteSpace: 'nowrap' }}> {message} </label>
			<Checkbox.Group onChange={sendValue} value={checked}>
				{items.map((opt, i) => (
					<React.Fragment key={i}>
						<Checkbox value={opt} disabled={isDisabled(opt)}>
							{' '}
							{opt} {type}{' '}
						</Checkbox>
						<br />
					</React.Fragment>
				))}
			</Checkbox.Group>
		</div>
	);
}

function MessageDisplay({ object, getAPI, divider, data }) {
	const context = useContext(UserContext);
	const [message, setMessage] = useState('');

	useEffect(() => {
		data('posted', object);
		async function fetchMessage() {
			let res = await getAPI(context);
			setMessage(res);
		}
		fetchMessage();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function makeMessage() {
		if (message !== '') {
			return (
				<div style={{ marginBottom: 30 }}>
					{message}
					{divider ? <Divider style={{ marginTop: 15 }} /> : null}
				</div>
			);
		} else {
			return null;
		}
	}

	return <div> {makeMessage()} </div>;
}

function SimpleMessage({ object, message, data }) {
	useEffect(() => {
		data('posted', object);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return <div style={{ marginBottom: 10 }}>{message}</div>;
}

function SubmitButton({ data, disabled }) {
	const [loading, setLoading] = useState(false);
	const _mounted = useRef(true);

	useEffect(() => {
		return () => {
			_mounted.current = false;
		};
	}, []);

	async function handleClick() {
		SoundManager.playSubmit();
		setLoading(true);
		try {
			await data();
		} finally {
			if (_mounted.current) {
				setLoading(false);
			}
		}
	}

	return (
		<div style={{ textAlign: 'center' }}>
			<Button
				type="primary"
				className="imp-submit-btn"
				onClick={() => handleClick()}
				disabled={disabled}
				loading={loading}
			>
				Submit
			</Button>
		</div>
	);
}

function Display(props) {
	if (props.submit) {
		return <props.component data={props.fn} key={props.k} disabled={!props.show} />;
	}
	if (props.show) {
		return <props.component data={props.fn} key={props.k} disabled={false} />;
	}
	return '';
}

function ActionFlow({ className, submitMethod, objects, components, submit, triggers, type, data }) {
	const context = useContext(UserContext);
	const [flowState, setFlowState] = useState({
		objectValues: {},
		visibleLayers: objects.map((_, i) => i === 0).concat([false]),
		keys: new Array(objects.length + 1).fill(0),
		currentComponents: { ...components },
	});

	function update(value, object) {
		const idx = objects.indexOf(object);

		// Compute new visible layers
		let newVis = new Array(objects.length + 1).fill(false);
		for (let i = 0; i < idx + 2; i++) {
			newVis[i] = true;
		}
		if (!value) {
			newVis[idx + 1] = false;
		}

		setFlowState((prev) => {
			let newKeys = [...prev.keys];
			newKeys[idx + 1] += 1;

			let newObjectValues = { ...prev.objectValues, [object]: value };
			let newComponents = { ...prev.currentComponents };
			for (const [key, tup] of Object.entries(triggers)) {
				if (newObjectValues[key]) {
					newComponents[tup[0]] = tup[1][newObjectValues[key]];
				}
			}

			return {
				objectValues: newObjectValues,
				visibleLayers: newVis,
				keys: newKeys,
				currentComponents: newComponents,
			};
		});

		// Parent data callback
		if (data) {
			if (!submit && newVis[newVis.length - 1] && value) {
				data('chosen', type);
			} else {
				data('', type);
			}
		}
	}

	async function handleSubmit() {
		await submitMethod(context);
	}

	function buildComponents() {
		let table = [];
		for (let i = 0; i < objects.length; i++) {
			let vis = flowState.visibleLayers[i];
			let Comp = flowState.currentComponents[objects[i]];
			if (Comp) {
				if (vis) {
					table.push(
						<div className="imp-action-layer" key={'layer-' + i + '-' + flowState.keys[i]}>
							<Comp data={update} key={flowState.keys[i]} />
						</div>
					);
				} else {
					table.push('');
				}
			} else {
				table.push('');
			}
		}
		// Submit button
		let showSubmit = flowState.visibleLayers[flowState.visibleLayers.length - 1] && submit;
		table.push(
			<Display
				component={SubmitButton}
				show={showSubmit}
				fn={handleSubmit}
				k={flowState.keys[flowState.visibleLayers.length - 1]}
				submit={submit}
			/>
		);
		return table;
	}

	return <div className={className}>{buildComponents()}</div>;
}

export {
	OptionSelect,
	RadioSelect,
	CheckboxSelect,
	MessageDisplay,
	SimpleMessage,
	ImportSelect,
	MultiOptionSelect,
	SubmitButton,
	Display,
	ActionFlow,
	// Legacy names for backward compatibility
	OptionSelect as OptionComponent,
	RadioSelect as RadioComponent,
	CheckboxSelect as CheckboxComponent,
	MessageDisplay as MessageComponent,
	SimpleMessage as SimpleMessageComponent,
	ImportSelect as ImportComponent,
	MultiOptionSelect as MultiOptionComponent,
	SubmitButton as Submit,
	ActionFlow as ActionComponent,
};
