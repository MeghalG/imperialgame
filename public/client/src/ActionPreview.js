import React, { useContext } from 'react';
import UserContext from './UserContext.js';
import TurnControlContext from './TurnControlContext.js';

function ActionPreview() {
	const context = useContext(UserContext);
	const turnControl = useContext(TurnControlContext);

	// Only show when there's an active submit handler (it's the user's turn)
	if (!turnControl.submitHandler) return null;

	let lines = buildPreview(context);
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

function buildPreview(ctx) {
	let lines = [];

	if (ctx.wheelSpot) {
		let action = friendlyWheelName(ctx.wheelSpot);

		if (ctx.wheelSpot === 'Taxation') {
			lines.push('Propose Taxation');
		} else if (ctx.wheelSpot === 'Factory' && ctx.factoryLoc) {
			lines.push('Build factory in ' + ctx.factoryLoc);
		} else if (ctx.wheelSpot === 'Factory') {
			lines.push('Propose Factory (choose location)');
		} else if (ctx.wheelSpot === 'Investor') {
			lines.push('Propose Investor round');
		} else if (ctx.wheelSpot === 'Import') {
			if (ctx.import) {
				let imports = parseImports(ctx.import);
				if (imports.length > 0) {
					lines.push('Import: ' + imports.join(', '));
				} else {
					lines.push('Propose Import (choose cities)');
				}
			} else {
				lines.push('Propose Import (choose cities)');
			}
		} else if (ctx.wheelSpot.includes('Produce')) {
			let units = [];
			if (ctx.armyProduce) units.push(...parseList(ctx.armyProduce, 'Army'));
			if (ctx.fleetProduce) units.push(...parseList(ctx.fleetProduce, 'Fleet'));
			if (units.length > 0) {
				lines.push('Produce: ' + units.join(', '));
			} else {
				lines.push('Propose ' + action + ' (choose factories)');
			}
		} else if (ctx.wheelSpot.includes('Maneuver')) {
			lines.push('Propose ' + action);
		} else {
			lines.push('Propose ' + action);
		}
	}

	if (ctx.vote) {
		lines.push('Vote: ' + ctx.vote);
	}

	if (ctx.buyCountry && ctx.buyStock) {
		lines.push('Buy ' + ctx.buyCountry + ' stock #' + ctx.buyStock);
	} else if (ctx.buyCountry) {
		lines.push('Buy ' + ctx.buyCountry + ' stock');
	}

	return lines;
}

function friendlyWheelName(spot) {
	return (
		{
			'R-Produce': 'Produce',
			'L-Produce': 'Produce',
			'R-Maneuver': 'Maneuver',
			'L-Maneuver': 'Maneuver',
		}[spot] || spot
	);
}

function parseList(val, unitType) {
	if (!val) return [];
	if (Array.isArray(val)) return val.map((v) => unitType + ' in ' + v);
	if (typeof val === 'string' && val.length > 0) return [unitType + ' in ' + val];
	return [];
}

function parseImports(val) {
	if (!val) return [];
	if (Array.isArray(val)) return val.filter(Boolean).map((v) => (typeof v === 'string' ? v : JSON.stringify(v)));
	if (typeof val === 'object') {
		return Object.entries(val)
			.filter(([, v]) => v)
			.map(([k, v]) => v + ' in ' + k);
	}
	return [String(val)];
}

export default ActionPreview;
