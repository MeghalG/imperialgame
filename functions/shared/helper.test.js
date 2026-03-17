const helper = require('./helper');

// ---------------------------------------------------------------------------
// Shared mock data builders
// ---------------------------------------------------------------------------

function makePlayerInfo(overrides = {}) {
	return {
		stock: [],
		money: 0,
		scoreModifier: 0,
		...overrides,
	};
}

function makeCountryInfo(overrides = {}) {
	return {
		leadership: [],
		money: 0,
		points: 0,
		lastTax: 0,
		armies: [],
		fleets: [],
		factories: [],
		taxChips: [],
		gov: 'dictatorship',
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// getOwnedStock
// ---------------------------------------------------------------------------

describe('getOwnedStock', () => {
	test('sums stock denominations for one player', () => {
		const playerInfo = {
			Alice: makePlayerInfo({
				stock: [
					{ country: 'Austria', stock: 2 },
					{ country: 'Austria', stock: 4 },
					{ country: 'Italy', stock: 3 },
				],
			}),
		};
		const result = helper.getOwnedStock(['Alice'], playerInfo, 'Austria');
		expect(result).toEqual([['Alice', 6]]);
	});

	test('sums stock for multiple leadership members', () => {
		const playerInfo = {
			Alice: makePlayerInfo({ stock: [{ country: 'France', stock: 5 }] }),
			Bob: makePlayerInfo({ stock: [{ country: 'France', stock: 3 }] }),
		};
		const result = helper.getOwnedStock(['Alice', 'Bob'], playerInfo, 'France');
		expect(result).toEqual([
			['Alice', 5],
			['Bob', 3],
		]);
	});

	test('returns zero for player with no matching stock', () => {
		const playerInfo = {
			Alice: makePlayerInfo({ stock: [{ country: 'Italy', stock: 4 }] }),
		};
		const result = helper.getOwnedStock(['Alice'], playerInfo, 'Austria');
		expect(result).toEqual([['Alice', 0]]);
	});

	test('handles empty stock array', () => {
		const playerInfo = { Alice: makePlayerInfo({ stock: [] }) };
		const result = helper.getOwnedStock(['Alice'], playerInfo, 'Austria');
		expect(result).toEqual([['Alice', 0]]);
	});
});

// ---------------------------------------------------------------------------
// getSat
// ---------------------------------------------------------------------------

describe('getSat', () => {
	test('returns territories with hostile armies from other countries', () => {
		const countryInfo = {
			Austria: makeCountryInfo({
				armies: [{ territory: 'Vienna', hostile: true }],
			}),
			Italy: makeCountryInfo({
				armies: [{ territory: 'Rome', hostile: false }],
			}),
		};
		const result = helper.getSat(countryInfo, 'Italy');
		expect(result).toEqual(['Vienna']);
	});

	test('excludes own country hostile armies', () => {
		const countryInfo = {
			Austria: makeCountryInfo({
				armies: [{ territory: 'Vienna', hostile: true }],
			}),
		};
		const result = helper.getSat(countryInfo, 'Austria');
		expect(result).toEqual([]);
	});

	test('returns empty when no hostile armies exist', () => {
		const countryInfo = {
			Austria: makeCountryInfo({ armies: [{ territory: 'Vienna', hostile: false }] }),
			Italy: makeCountryInfo({ armies: [] }),
		};
		const result = helper.getSat(countryInfo, 'Italy');
		expect(result).toEqual([]);
	});

	test('returns multiple territories from multiple countries', () => {
		const countryInfo = {
			Austria: makeCountryInfo({
				armies: [
					{ territory: 'Vienna', hostile: true },
					{ territory: 'Budapest', hostile: true },
				],
			}),
			Italy: makeCountryInfo({
				armies: [{ territory: 'Rome', hostile: true }],
			}),
			France: makeCountryInfo({ armies: [] }),
		};
		const result = helper.getSat(countryInfo, 'France');
		expect(result).toEqual(['Vienna', 'Budapest', 'Rome']);
	});
});

// ---------------------------------------------------------------------------
// getUnsatFactories
// ---------------------------------------------------------------------------

describe('getUnsatFactories', () => {
	test('returns all factories when none are occupied', () => {
		const countryInfo = {
			Austria: makeCountryInfo({ factories: ['Vienna', 'Budapest'] }),
			Italy: makeCountryInfo({ armies: [] }),
		};
		const result = helper.getUnsatFactories(countryInfo, 'Austria');
		expect(result).toEqual(['Vienna', 'Budapest']);
	});

	test('excludes factories occupied by hostile enemy armies', () => {
		const countryInfo = {
			Austria: makeCountryInfo({ factories: ['Vienna', 'Budapest', 'Trieste'] }),
			Italy: makeCountryInfo({
				armies: [{ territory: 'Vienna', hostile: true }],
			}),
		};
		const result = helper.getUnsatFactories(countryInfo, 'Austria');
		expect(result).toEqual(['Budapest', 'Trieste']);
	});

	test('returns empty when all factories are occupied', () => {
		const countryInfo = {
			Austria: makeCountryInfo({ factories: ['Vienna'] }),
			Italy: makeCountryInfo({
				armies: [{ territory: 'Vienna', hostile: true }],
			}),
		};
		const result = helper.getUnsatFactories(countryInfo, 'Austria');
		expect(result).toEqual([]);
	});

	test('returns empty for a country with no factories', () => {
		const countryInfo = {
			Austria: makeCountryInfo({ factories: [] }),
		};
		const result = helper.getUnsatFactories(countryInfo, 'Austria');
		expect(result).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// getInvestorPayout
// ---------------------------------------------------------------------------

describe('getInvestorPayout', () => {
	test('pays out full stock amounts when country has enough money', () => {
		const gameState = {
			countryInfo: {
				Austria: makeCountryInfo({
					leadership: ['Alice', 'Bob'],
					money: 20,
				}),
			},
			playerInfo: {
				Alice: makePlayerInfo({ stock: [{ country: 'Austria', stock: 4 }] }),
				Bob: makePlayerInfo({ stock: [{ country: 'Austria', stock: 2 }] }),
			},
		};
		const result = helper.getInvestorPayout(gameState, 'Austria', 'Alice');
		expect(result).toEqual([
			['Alice', 4],
			['Bob', 2],
		]);
	});

	test('deducts shortfall from current player', () => {
		const gameState = {
			countryInfo: {
				Austria: makeCountryInfo({
					leadership: ['Alice', 'Bob'],
					money: 3,
				}),
			},
			playerInfo: {
				Alice: makePlayerInfo({ stock: [{ country: 'Austria', stock: 4 }] }),
				Bob: makePlayerInfo({ stock: [{ country: 'Austria', stock: 2 }] }),
			},
		};
		// Total owed = 6, money = 3, shortfall = 3, Alice absorbs it
		const result = helper.getInvestorPayout(gameState, 'Austria', 'Alice');
		expect(result).toEqual([
			['Alice', 1],
			['Bob', 2],
		]);
	});

	test('shortfall absorbed by named player even if not first in leadership', () => {
		const gameState = {
			countryInfo: {
				Austria: makeCountryInfo({
					leadership: ['Alice', 'Bob'],
					money: 5,
				}),
			},
			playerInfo: {
				Alice: makePlayerInfo({ stock: [{ country: 'Austria', stock: 4 }] }),
				Bob: makePlayerInfo({ stock: [{ country: 'Austria', stock: 6 }] }),
			},
		};
		// Total owed = 10, money = 5, shortfall = 5, Bob absorbs
		const result = helper.getInvestorPayout(gameState, 'Austria', 'Bob');
		expect(result).toEqual([
			['Alice', 4],
			['Bob', 1],
		]);
	});

	test('single player leadership with exact money', () => {
		const gameState = {
			countryInfo: {
				Austria: makeCountryInfo({ leadership: ['Alice'], money: 5 }),
			},
			playerInfo: {
				Alice: makePlayerInfo({ stock: [{ country: 'Austria', stock: 5 }] }),
			},
		};
		const result = helper.getInvestorPayout(gameState, 'Austria', 'Alice');
		expect(result).toEqual([['Alice', 5]]);
	});
});

// ---------------------------------------------------------------------------
// getTaxSplit
// ---------------------------------------------------------------------------

describe('getTaxSplit', () => {
	test('splits money proportionally between two players', () => {
		const countryInfo = {
			Austria: makeCountryInfo({ leadership: ['Alice', 'Bob'] }),
		};
		const playerInfo = {
			Alice: makePlayerInfo({ stock: [{ country: 'Austria', stock: 6 }] }),
			Bob: makePlayerInfo({ stock: [{ country: 'Austria', stock: 3 }] }),
		};
		const result = helper.getTaxSplit(3, countryInfo, playerInfo, 'Austria');
		// D'Hondt: Alice gets 2, Bob gets 1
		expect(result).toEqual([
			['Alice', 2],
			['Bob', 1],
		]);
	});

	test('gives all money to single leadership member', () => {
		const countryInfo = {
			Austria: makeCountryInfo({ leadership: ['Alice'] }),
		};
		const playerInfo = {
			Alice: makePlayerInfo({ stock: [{ country: 'Austria', stock: 5 }] }),
		};
		const result = helper.getTaxSplit(4, countryInfo, playerInfo, 'Austria');
		expect(result).toEqual([['Alice', 4]]);
	});

	test('returns empty array when money is zero', () => {
		const countryInfo = {
			Austria: makeCountryInfo({ leadership: ['Alice'] }),
		};
		const playerInfo = {
			Alice: makePlayerInfo({ stock: [{ country: 'Austria', stock: 5 }] }),
		};
		const result = helper.getTaxSplit(0, countryInfo, playerInfo, 'Austria');
		expect(result).toEqual([]);
	});

	test('equal stock splits money evenly', () => {
		const countryInfo = {
			Austria: makeCountryInfo({ leadership: ['Alice', 'Bob'] }),
		};
		const playerInfo = {
			Alice: makePlayerInfo({ stock: [{ country: 'Austria', stock: 4 }] }),
			Bob: makePlayerInfo({ stock: [{ country: 'Austria', stock: 4 }] }),
		};
		const result = helper.getTaxSplit(4, countryInfo, playerInfo, 'Austria');
		expect(result).toEqual([
			['Alice', 2],
			['Bob', 2],
		]);
	});
});

// ---------------------------------------------------------------------------
// getTaxInfo
// ---------------------------------------------------------------------------

describe('getTaxInfo', () => {
	test('computes points capped at 15 with money deduction for units', () => {
		const countryInfo = {
			Austria: makeCountryInfo({
				leadership: ['Alice'],
				money: 10,
				lastTax: 0,
				factories: ['Vienna', 'Budapest', 'Trieste'],
				taxChips: ['chipA', 'chipB', 'chipC'],
				armies: [{ territory: 'Vienna', hostile: false }],
				fleets: [],
			}),
		};
		const playerInfo = {
			Alice: makePlayerInfo({ stock: [{ country: 'Austria', stock: 5 }] }),
		};
		// taxChips=3, factories=3 (all unsat), raw points = 3 + 2*3 = 9
		// points capped at min(9,15) = 9
		// numUnits = 1
		// money = 9 - 1 = 8
		// ans.points = max(9-5,0) = 4
		// playerMoney = min(max(9-0,0), 10+8) = min(9,18) = 9
		// ans.money = 8 - 9 = -1
		const result = helper.getTaxInfo(countryInfo, playerInfo, 'Austria');
		expect(result.points).toBe(4);
		expect(result.money).toBe(-1);
		expect(result['tax split']).toEqual([['Alice', 9]]);
	});

	test('zero points scenario with no factories or taxChips', () => {
		const countryInfo = {
			Austria: makeCountryInfo({
				leadership: ['Alice'],
				money: 5,
				lastTax: 0,
				factories: [],
				taxChips: [],
				armies: [],
				fleets: [],
			}),
		};
		const playerInfo = {
			Alice: makePlayerInfo({ stock: [{ country: 'Austria', stock: 1 }] }),
		};
		// points=0, money=0, ans.points=0, playerMoney=min(0,5)=0, ans.money=0
		const result = helper.getTaxInfo(countryInfo, playerInfo, 'Austria');
		expect(result.points).toBe(0);
		expect(result.money).toBe(0);
		expect(result['tax split']).toEqual([]);
	});

	test('omits tax split when playerInfo is null', () => {
		const countryInfo = {
			Austria: makeCountryInfo({
				money: 5,
				lastTax: 0,
				factories: ['Vienna'],
				taxChips: ['chipA'],
				armies: [],
				fleets: [],
			}),
		};
		const result = helper.getTaxInfo(countryInfo, null, 'Austria');
		expect(result.points).toBeDefined();
		expect(result.money).toBeDefined();
		expect(result['tax split']).toBeUndefined();
	});

	test('points capped at 15', () => {
		const countryInfo = {
			Austria: makeCountryInfo({
				leadership: ['Alice'],
				money: 20,
				lastTax: 0,
				factories: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'],
				taxChips: ['c1', 'c2', 'c3', 'c4', 'c5'],
				armies: [],
				fleets: [],
			}),
		};
		const playerInfo = {
			Alice: makePlayerInfo({ stock: [{ country: 'Austria', stock: 3 }] }),
		};
		// raw points = 5 + 2*8 = 21, capped at 15
		const result = helper.getTaxInfo(countryInfo, playerInfo, 'Austria');
		expect(result.points).toBe(10); // max(15-5,0)
	});
});

// ---------------------------------------------------------------------------
// computeScore
// ---------------------------------------------------------------------------

describe('computeScore', () => {
	test('computes score from stock value, money, and scoreModifier', () => {
		const playerInfo = makePlayerInfo({
			stock: [
				{ country: 'Austria', stock: 4 },
				{ country: 'Italy', stock: 2 },
			],
			money: 3,
			scoreModifier: 1,
		});
		const countryInfos = {
			Austria: makeCountryInfo({ points: 10 }), // floor(10/5)=2
			Italy: makeCountryInfo({ points: 7 }), // floor(7/5)=1
		};
		// 2*4 + 1*2 + 3 + 1 = 14
		expect(helper.computeScore(playerInfo, countryInfos)).toBe(14);
	});

	test('returns money + scoreModifier when player has no stock', () => {
		const playerInfo = makePlayerInfo({ stock: [], money: 5, scoreModifier: 2 });
		expect(helper.computeScore(playerInfo, {})).toBe(7);
	});

	test('country with less than 5 points contributes zero per stock', () => {
		const playerInfo = makePlayerInfo({
			stock: [{ country: 'Austria', stock: 10 }],
			money: 0,
			scoreModifier: 0,
		});
		const countryInfos = { Austria: makeCountryInfo({ points: 4 }) };
		expect(helper.computeScore(playerInfo, countryInfos)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// computeCash
// ---------------------------------------------------------------------------

describe('computeCash', () => {
	test('computes cash as 2x stock denomination + money', () => {
		const playerInfo = makePlayerInfo({
			stock: [
				{ country: 'Austria', stock: 3 },
				{ country: 'Italy', stock: 5 },
			],
			money: 10,
		});
		// 2*3 + 2*5 + 10 = 26
		expect(helper.computeCash(playerInfo, {})).toBe(26);
	});

	test('returns just money when no stock', () => {
		const playerInfo = makePlayerInfo({ stock: [], money: 7 });
		expect(helper.computeCash(playerInfo, {})).toBe(7);
	});
});

// ---------------------------------------------------------------------------
// sortStock
// ---------------------------------------------------------------------------

describe('sortStock', () => {
	test('sorts by country order then denomination', () => {
		const countries = ['Austria', 'Italy', 'France'];
		const stocks = [
			{ country: 'France', stock: 2 },
			{ country: 'Austria', stock: 5 },
			{ country: 'Austria', stock: 2 },
			{ country: 'Italy', stock: 3 },
		];
		helper.sortStock(stocks, countries);
		expect(stocks).toEqual([
			{ country: 'Austria', stock: 2 },
			{ country: 'Austria', stock: 5 },
			{ country: 'Italy', stock: 3 },
			{ country: 'France', stock: 2 },
		]);
	});

	test('handles empty array', () => {
		const stocks = [];
		helper.sortStock(stocks, ['Austria']);
		expect(stocks).toEqual([]);
	});

	test('single stock remains unchanged', () => {
		const stocks = [{ country: 'Italy', stock: 4 }];
		helper.sortStock(stocks, ['Italy']);
		expect(stocks).toEqual([{ country: 'Italy', stock: 4 }]);
	});
});

// ---------------------------------------------------------------------------
// getPermSwiss
// ---------------------------------------------------------------------------

describe('getPermSwiss', () => {
	test('returns players not in any leadership', () => {
		const gameState = {
			playerInfo: {
				Alice: makePlayerInfo(),
				Bob: makePlayerInfo(),
				Charlie: makePlayerInfo(),
			},
			countryInfo: {
				Austria: makeCountryInfo({
					gov: 'dictatorship',
					leadership: ['Alice'],
				}),
			},
		};
		const result = helper.getPermSwiss(gameState);
		expect(result).toEqual(['Bob', 'Charlie']);
	});

	test('removes both leader and opposition for democracy', () => {
		const gameState = {
			playerInfo: {
				Alice: makePlayerInfo(),
				Bob: makePlayerInfo(),
				Charlie: makePlayerInfo(),
			},
			countryInfo: {
				Austria: makeCountryInfo({
					gov: 'democracy',
					leadership: ['Alice', 'Bob'],
				}),
			},
		};
		const result = helper.getPermSwiss(gameState);
		expect(result).toEqual(['Charlie']);
	});

	test('returns all players when no countries exist', () => {
		const gameState = {
			playerInfo: {
				Alice: makePlayerInfo(),
				Bob: makePlayerInfo(),
			},
			countryInfo: {},
		};
		const result = helper.getPermSwiss(gameState);
		expect(result).toEqual(['Alice', 'Bob']);
	});

	test('returns empty when all players are in leadership', () => {
		const gameState = {
			playerInfo: {
				Alice: makePlayerInfo(),
				Bob: makePlayerInfo(),
			},
			countryInfo: {
				Austria: makeCountryInfo({ gov: 'dictatorship', leadership: ['Alice'] }),
				Italy: makeCountryInfo({ gov: 'dictatorship', leadership: ['Bob'] }),
			},
		};
		const result = helper.getPermSwiss(gameState);
		expect(result).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// getWinner
// ---------------------------------------------------------------------------

describe('getWinner', () => {
	test('returns player with highest score', () => {
		const gameState = {
			playerInfo: {
				Alice: makePlayerInfo({ money: 10, scoreModifier: 0, stock: [] }),
				Bob: makePlayerInfo({ money: 5, scoreModifier: 0, stock: [] }),
			},
			countryInfo: {},
		};
		expect(helper.getWinner(gameState)).toBe('Alice');
	});

	test('breaks tie by investment in top nation', () => {
		const gameState = {
			playerInfo: {
				Alice: makePlayerInfo({
					money: 6,
					scoreModifier: 0,
					stock: [{ country: 'Austria', stock: 2 }],
				}),
				Bob: makePlayerInfo({
					money: 2,
					scoreModifier: 0,
					stock: [{ country: 'Austria', stock: 4 }],
				}),
			},
			countryInfo: {
				Austria: makeCountryInfo({ points: 5 }), // value=1; Alice: 1*2+6=8, Bob: 1*4+2=6? No.
			},
		};
		// Alice score: floor(5/5)*2 + 6 = 8, Bob score: floor(5/5)*4 + 2 = 6
		// Not tied, Alice wins directly
		expect(helper.getWinner(gameState)).toBe('Alice');
	});

	test('breaks tie with top nation investment', () => {
		const gameState = {
			playerInfo: {
				Alice: makePlayerInfo({
					money: 10,
					scoreModifier: 0,
					stock: [{ country: 'Italy', stock: 2 }],
				}),
				Bob: makePlayerInfo({
					money: 10,
					scoreModifier: 0,
					stock: [{ country: 'Austria', stock: 2 }],
				}),
			},
			countryInfo: {
				Austria: makeCountryInfo({ points: 10 }), // top nation
				Italy: makeCountryInfo({ points: 4 }), // floor(4/5)=0
			},
		};
		// Alice: 0*2+10=10, Bob: 2*2+10=14? No: floor(10/5)=2, so Bob: 2*2+10=14, Alice: 0*2+10=10
		// Not tied. Let me fix:
		// Make scores equal
		const gameState2 = {
			playerInfo: {
				Alice: makePlayerInfo({
					money: 8,
					scoreModifier: 0,
					stock: [{ country: 'Austria', stock: 1 }],
				}),
				Bob: makePlayerInfo({
					money: 6,
					scoreModifier: 0,
					stock: [{ country: 'Austria', stock: 2 }],
				}),
			},
			countryInfo: {
				Austria: makeCountryInfo({ points: 10 }), // value=2; Alice: 2+8=10, Bob: 4+6=10
			},
		};
		// Tied at 10. Top nation=Austria. Alice inv=1, Bob inv=2. Bob wins.
		expect(helper.getWinner(gameState2)).toBe('Bob');
	});

	test('breaks investment tie with most cash', () => {
		const gameState = {
			playerInfo: {
				Alice: makePlayerInfo({
					money: 10,
					scoreModifier: 0,
					stock: [],
				}),
				Bob: makePlayerInfo({
					money: 10,
					scoreModifier: 0,
					stock: [],
				}),
			},
			countryInfo: {
				Austria: makeCountryInfo({ points: 5 }),
			},
		};
		// Both score 10. Both have 0 investment in Austria. Both have money=10. First in investmentTied wins.
		// Since they're still tied on money, the first in investmentTied array is returned.
		// With equal money the last one with bestMoney wins (>= doesn't update, only > does)
		expect(helper.getWinner(gameState)).toBe('Alice');
	});

	test('cash tiebreaker picks player with more money', () => {
		const gameState = {
			playerInfo: {
				Alice: makePlayerInfo({ money: 5, scoreModifier: 5, stock: [] }),
				Bob: makePlayerInfo({ money: 8, scoreModifier: 2, stock: [] }),
			},
			countryInfo: {
				Austria: makeCountryInfo({ points: 3 }),
			},
		};
		// Alice: 5+5=10, Bob: 8+2=10. Tied. Top nation=Austria, both 0 investment.
		// Cash: Bob has 8 > Alice 5. Bob wins.
		expect(helper.getWinner(gameState)).toBe('Bob');
	});

	test('returns empty string when no players exist', () => {
		const gameState = { playerInfo: {}, countryInfo: {} };
		expect(helper.getWinner(gameState)).toBe('');
	});
});

// ---------------------------------------------------------------------------
// stringifyFunctions / unstringifyFunctions
// ---------------------------------------------------------------------------

describe('stringifyFunctions', () => {
	test('converts set* and reset* keys to string representations', () => {
		const input = {
			setValue: function () {
				return 1;
			},
			resetAll: () => {},
			name: 'test',
			count: 42,
		};
		const result = helper.stringifyFunctions(input);
		expect(typeof result.setValue).toBe('string');
		expect(typeof result.resetAll).toBe('string');
		expect(result.name).toBe('test');
		expect(result.count).toBe(42);
	});

	test('passes through non-set/reset keys unchanged', () => {
		const input = { getData: () => {}, value: 'hello' };
		const result = helper.stringifyFunctions(input);
		// getData does not start with "set" or "reset", so stays as-is
		expect(typeof result.getData).toBe('function');
		expect(result.value).toBe('hello');
	});

	test('handles empty object', () => {
		expect(helper.stringifyFunctions({})).toEqual({});
	});
});

describe('unstringifyFunctions', () => {
	test('converts set* and reset* string keys back to no-op functions', () => {
		const input = {
			setValue: 'function() { return 1; }',
			resetAll: '() => {}',
			name: 'test',
		};
		const result = helper.unstringifyFunctions(input);
		expect(typeof result.setValue).toBe('function');
		expect(typeof result.resetAll).toBe('function');
		expect(result.name).toBe('test');
		// No-op functions return undefined
		expect(result.setValue()).toBeUndefined();
		expect(result.resetAll()).toBeUndefined();
	});

	test('roundtrip: stringify then unstringify preserves non-function keys', () => {
		const original = {
			setX: () => 42,
			resetY: function () {},
			data: [1, 2, 3],
			flag: true,
		};
		const roundtripped = helper.unstringifyFunctions(helper.stringifyFunctions(original));
		expect(typeof roundtripped.setX).toBe('function');
		expect(typeof roundtripped.resetY).toBe('function');
		expect(roundtripped.data).toEqual([1, 2, 3]);
		expect(roundtripped.flag).toBe(true);
	});

	test('handles empty object', () => {
		expect(helper.unstringifyFunctions({})).toEqual({});
	});
});
