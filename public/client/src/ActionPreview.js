import React, { useContext, useState, useEffect, useRef } from 'react';
import UserContext from './UserContext.js';
import TurnControlContext from './TurnControlContext.js';
import * as proposalAPI from './backendFiles/proposalAPI.js';
import { readGameState } from './backendFiles/stateCache.js';
import * as helper from './backendFiles/helper.js';

function ActionPreview() {
	const context = useContext(UserContext);
	const turnControl = useContext(TurnControlContext);
	const [asyncPreview, setAsyncPreview] = useState([]);
	const contextRef = useRef(context);
	contextRef.current = context;

	// Fetch async previews for taxation and investor
	useEffect(() => {
		let cancelled = false;

		async function fetchPreview() {
			if (!context.wheelSpot) {
				setAsyncPreview([]);
				return;
			}
			try {
				if (context.wheelSpot === 'Taxation') {
					let msg = await proposalAPI.getTaxMessage(contextRef.current);
					if (!cancelled) setAsyncPreview([msg]);
				} else if (context.wheelSpot === 'Investor') {
					let lines = await buildInvestorPreview(contextRef.current);
					if (!cancelled) setAsyncPreview(lines);
				} else {
					if (!cancelled) setAsyncPreview([]);
				}
			} catch (e) {
				if (!cancelled) setAsyncPreview([]);
			}
		}

		fetchPreview();
		return () => {
			cancelled = true;
		};
	}, [context.wheelSpot]);

	if (!turnControl.submitHandler) return null;

	let lines = buildPreview(context, asyncPreview);
	if (lines.length === 0) return null;

	return (
		<div className="imp-action-preview">
			<div className="imp-action-preview__label">Preview</div>
			<div className="imp-action-preview__text">
				{lines.map((line, i) => (
					<div key={i}>{line}</div>
				))}
			</div>
		</div>
	);
}

async function buildInvestorPreview(context) {
	let lines = [];
	let msg = await proposalAPI.getInvestorMessage(context);
	lines.push(msg);

	// Show buy order: investor card holder buys first
	try {
		let gameState = await readGameState(context);
		let investorHolder = null;
		let otherPlayers = [];
		let playersOrdered = await helper.getPlayersInOrder(context);
		for (let p of playersOrdered) {
			if (gameState.playerInfo[p] && gameState.playerInfo[p].investor) {
				investorHolder = p;
			} else {
				otherPlayers.push(p);
			}
		}
		if (investorHolder) {
			let buyOrder = [investorHolder, ...otherPlayers];
			if (buyOrder.length === 1) {
				lines.push(buyOrder[0] + ' will get a buy.');
			} else {
				let last = buyOrder.pop();
				lines.push(buyOrder.join(', ') + ', and ' + last + ' will get buys.');
			}
		}
	} catch (e) {
		// If we can't get buy order, just show the payout
	}

	return lines;
}

function buildPreview(ctx, asyncLines) {
	let lines = [];

	if (ctx.wheelSpot) {
		if (ctx.wheelSpot === 'Taxation' || ctx.wheelSpot === 'Investor') {
			if (asyncLines.length > 0) {
				lines.push(...asyncLines);
			} else {
				lines.push('Loading...');
			}
		} else if (ctx.wheelSpot === 'Factory') {
			if (ctx.factoryLoc) {
				lines.push('Build factory in ' + ctx.factoryLoc);
			} else {
				lines.push('Choose a location for the factory');
			}
		} else if (ctx.wheelSpot === 'Import') {
			let imports = formatImports(ctx.import);
			if (imports.length > 0) {
				lines.push('Import: ' + imports.join(', '));
			} else {
				lines.push('Choose cities to import units');
			}
		} else if (ctx.wheelSpot.includes('Produce')) {
			let units = [];
			if (ctx.armyProduce) units.push(...formatUnits(ctx.armyProduce, 'army'));
			if (ctx.fleetProduce) units.push(...formatUnits(ctx.fleetProduce, 'fleet'));
			if (units.length > 0) {
				lines.push('Produce: ' + units.join(', '));
			} else {
				lines.push('Choose which factories to produce units');
			}
		} else if (ctx.wheelSpot.includes('Maneuver')) {
			lines.push('Begin maneuver planning');
		}
	}

	if (ctx.vote) {
		lines.push('Vote: ' + ctx.vote);
	}

	if (ctx.buyCountry && ctx.buyStock) {
		lines.push('Buy ' + ctx.buyCountry + ' stock #' + ctx.buyStock);
	} else if (ctx.buyCountry) {
		lines.push('Buying ' + ctx.buyCountry + ' stock (choose level)');
	}

	return lines;
}

function formatUnits(val, unitType) {
	if (!val) return [];
	if (Array.isArray(val)) return val.map((v) => unitType + ' in ' + v);
	if (typeof val === 'string' && val.length > 0) return [unitType + ' in ' + val];
	return [];
}

function formatImports(val) {
	if (!val) return [];
	if (Array.isArray(val)) {
		return val.filter(Boolean).map((v) => {
			if (typeof v === 'object' && v.territory) return v.type + ' in ' + v.territory;
			if (typeof v === 'string') return v;
			return JSON.stringify(v);
		});
	}
	if (typeof val === 'object' && !Array.isArray(val)) {
		return Object.entries(val)
			.filter(([, v]) => v)
			.map(([k, v]) => v + ' in ' + k);
	}
	return [String(val)];
}

export default ActionPreview;
