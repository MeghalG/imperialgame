import {
	normalizeAction,
	denormalizeAction,
	formatActionLabel,
	formatCompletedAction,
	actionColor,
	isPeaceAction,
	hasPeaceInAction,
} from './maneuverActionUtils';

// ---------------------------------------------------------------------------
// normalizeAction
// ---------------------------------------------------------------------------

describe('normalizeAction', () => {
	test('null returns empty array', () => {
		expect(normalizeAction(null)).toEqual([]);
	});

	test('undefined returns empty array', () => {
		expect(normalizeAction(undefined)).toEqual([]);
	});

	test('empty string returns empty array', () => {
		expect(normalizeAction('')).toEqual([]);
	});

	test('peace action', () => {
		expect(normalizeAction('peace')).toEqual([{ country: null, action: 'peace' }]);
	});

	test('hostile action', () => {
		expect(normalizeAction('hostile')).toEqual([{ country: null, action: 'hostile' }]);
	});

	test('war action extracts country', () => {
		expect(normalizeAction('war France fleet')).toEqual([
			{ country: 'France', action: 'war France fleet' },
		]);
	});

	test('war action with army unit type', () => {
		expect(normalizeAction('war Austria army')).toEqual([
			{ country: 'Austria', action: 'war Austria army' },
		]);
	});

	test('blow up action extracts country', () => {
		expect(normalizeAction('blow up Italy')).toEqual([
			{ country: 'Italy', action: 'blow up Italy' },
		]);
	});

	test('blow up action with multi-word country', () => {
		expect(normalizeAction('blow up Great Britain')).toEqual([
			{ country: 'Great Britain', action: 'blow up Great Britain' },
		]);
	});

	test('already-JSON compound array string is parsed and returned', () => {
		const compound = [{ country: 'France', action: 'peace' }];
		const jsonStr = JSON.stringify(compound);
		expect(normalizeAction(jsonStr)).toEqual(compound);
	});

	test('already-JSON compound array with multiple entries', () => {
		const compound = [
			{ country: 'France', action: 'peace' },
			{ country: 'Germany', action: 'war Germany fleet' },
		];
		const jsonStr = JSON.stringify(compound);
		expect(normalizeAction(jsonStr)).toEqual(compound);
	});

	test('unknown action string wraps generically', () => {
		expect(normalizeAction('something weird')).toEqual([
			{ country: null, action: 'something weird' },
		]);
	});
});

// ---------------------------------------------------------------------------
// denormalizeAction
// ---------------------------------------------------------------------------

describe('denormalizeAction', () => {
	test('empty array returns empty string', () => {
		expect(denormalizeAction([])).toBe('');
	});

	test('null returns empty string', () => {
		expect(denormalizeAction(null)).toBe('');
	});

	test('undefined returns empty string', () => {
		expect(denormalizeAction(undefined)).toBe('');
	});

	test('single peace entry returns action string', () => {
		expect(denormalizeAction([{ country: null, action: 'peace' }])).toBe('peace');
	});

	test('single hostile entry returns action string', () => {
		expect(denormalizeAction([{ country: null, action: 'hostile' }])).toBe('hostile');
	});

	test('single war entry returns action string', () => {
		expect(denormalizeAction([{ country: 'France', action: 'war France fleet' }])).toBe(
			'war France fleet'
		);
	});

	test('single blow up entry returns action string', () => {
		expect(denormalizeAction([{ country: 'Italy', action: 'blow up Italy' }])).toBe(
			'blow up Italy'
		);
	});

	test('multiple entries return JSON string', () => {
		const compound = [
			{ country: 'France', action: 'peace' },
			{ country: 'Germany', action: 'hostile' },
		];
		expect(denormalizeAction(compound)).toBe(JSON.stringify(compound));
	});

	test('round-trip: normalizeAction then denormalizeAction restores original', () => {
		const cases = ['peace', 'hostile', 'war France fleet', 'blow up Italy'];
		cases.forEach((original) => {
			expect(denormalizeAction(normalizeAction(original))).toBe(original);
		});
	});

	test('round-trip: empty string', () => {
		expect(denormalizeAction(normalizeAction(''))).toBe('');
	});
});

// ---------------------------------------------------------------------------
// formatActionLabel
// ---------------------------------------------------------------------------

describe('formatActionLabel', () => {
	test('empty string returns empty string', () => {
		expect(formatActionLabel('')).toBe('');
	});

	test('null returns empty string', () => {
		expect(formatActionLabel(null)).toBe('');
	});

	test('undefined returns empty string', () => {
		expect(formatActionLabel(undefined)).toBe('');
	});

	test('peace action label', () => {
		expect(formatActionLabel('peace')).toBe('Enter peacefully');
	});

	test('hostile action label', () => {
		expect(formatActionLabel('hostile')).toBe('Enter as hostile occupier');
	});

	test('war action label with fleet', () => {
		expect(formatActionLabel('war France fleet')).toBe('Declare war on France fleet');
	});

	test('war action label with army', () => {
		expect(formatActionLabel('war Austria army')).toBe('Declare war on Austria army');
	});

	test('blow up action label', () => {
		expect(formatActionLabel('blow up Italy')).toBe('Destroy Italy factory');
	});

	test('blow up action label with multi-word country', () => {
		expect(formatActionLabel('blow up Great Britain')).toBe('Destroy Great Britain factory');
	});
});

// ---------------------------------------------------------------------------
// formatCompletedAction
// ---------------------------------------------------------------------------

describe('formatCompletedAction', () => {
	test('empty string returns empty string', () => {
		expect(formatCompletedAction('')).toBe('');
	});

	test('null returns empty string', () => {
		expect(formatCompletedAction(null)).toBe('');
	});

	test('undefined returns empty string', () => {
		expect(formatCompletedAction(undefined)).toBe('');
	});

	test('peace completed label', () => {
		expect(formatCompletedAction('peace')).toBe('peace');
	});

	test('hostile completed label', () => {
		expect(formatCompletedAction('hostile')).toBe('hostile');
	});

	test('war completed label with fleet', () => {
		expect(formatCompletedAction('war France fleet')).toBe('war on France fleet');
	});

	test('war completed label with army', () => {
		expect(formatCompletedAction('war Austria army')).toBe('war on Austria army');
	});

	test('blow up completed label', () => {
		expect(formatCompletedAction('blow up Italy')).toBe('destroy Italy factory');
	});

	test('blow up completed label with multi-word country', () => {
		expect(formatCompletedAction('blow up Great Britain')).toBe('destroy Great Britain factory');
	});
});

// ---------------------------------------------------------------------------
// actionColor
// ---------------------------------------------------------------------------

describe('actionColor', () => {
	test('null returns undefined', () => {
		expect(actionColor(null)).toBeUndefined();
	});

	test('undefined returns undefined', () => {
		expect(actionColor(undefined)).toBeUndefined();
	});

	test('empty string returns undefined', () => {
		expect(actionColor('')).toBeUndefined();
	});

	test('peace returns green', () => {
		expect(actionColor('peace')).toBe('#52c41a');
	});

	test('hostile returns orange', () => {
		expect(actionColor('hostile')).toBe('#fa8c16');
	});

	test('war returns red', () => {
		expect(actionColor('war France fleet')).toBe('#f5222d');
	});

	test('war with different country and unit type', () => {
		expect(actionColor('war Austria army')).toBe('#f5222d');
	});

	test('blow up returns dark red', () => {
		expect(actionColor('blow up Italy')).toBe('#a8071a');
	});

	test('blow up with different country', () => {
		expect(actionColor('blow up France')).toBe('#a8071a');
	});

	test('unknown action returns undefined', () => {
		expect(actionColor('something else')).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// isPeaceAction
// ---------------------------------------------------------------------------

describe('isPeaceAction', () => {
	test('peace returns true', () => {
		expect(isPeaceAction('peace')).toBe(true);
	});

	test('hostile returns false', () => {
		expect(isPeaceAction('hostile')).toBe(false);
	});

	test('war action returns false', () => {
		expect(isPeaceAction('war France fleet')).toBe(false);
	});

	test('blow up returns false', () => {
		expect(isPeaceAction('blow up Italy')).toBe(false);
	});

	test('empty string returns false', () => {
		expect(isPeaceAction('')).toBe(false);
	});

	test('null returns false', () => {
		expect(isPeaceAction(null)).toBe(false);
	});

	test('undefined returns false', () => {
		expect(isPeaceAction(undefined)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// hasPeaceInAction
// ---------------------------------------------------------------------------

describe('hasPeaceInAction', () => {
	test('empty array returns false', () => {
		expect(hasPeaceInAction([])).toBe(false);
	});

	test('null returns false', () => {
		expect(hasPeaceInAction(null)).toBe(false);
	});

	test('undefined returns false', () => {
		expect(hasPeaceInAction(undefined)).toBe(false);
	});

	test('single peace entry returns true', () => {
		expect(hasPeaceInAction([{ country: null, action: 'peace' }])).toBe(true);
	});

	test('single hostile entry returns false', () => {
		expect(hasPeaceInAction([{ country: null, action: 'hostile' }])).toBe(false);
	});

	test('single war entry returns false', () => {
		expect(hasPeaceInAction([{ country: 'France', action: 'war France fleet' }])).toBe(false);
	});

	test('multiple entries with one peace returns true', () => {
		const compound = [
			{ country: 'France', action: 'peace' },
			{ country: 'Germany', action: 'hostile' },
		];
		expect(hasPeaceInAction(compound)).toBe(true);
	});

	test('multiple entries with no peace returns false', () => {
		const compound = [
			{ country: 'France', action: 'hostile' },
			{ country: 'Germany', action: 'war Germany fleet' },
		];
		expect(hasPeaceInAction(compound)).toBe(false);
	});

	test('multiple entries all peace returns true', () => {
		const compound = [
			{ country: null, action: 'peace' },
			{ country: null, action: 'peace' },
		];
		expect(hasPeaceInAction(compound)).toBe(true);
	});
});
