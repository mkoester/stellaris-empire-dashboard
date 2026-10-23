import { describe, expect, it } from 'vitest';
import {
	aiValue,
	canGive,
	enclaveDeal,
	enclaveUnitCost,
	marketPrice,
	marketRate,
	giftOpinion,
	modelFrom,
	monthlyCap,
	offerPrice,
	rate,
	spare,
	stance,
	terms,
	wantPrice,
	WORTH
} from './aiTrade.ts';
import type { AiIntel } from './types.ts';

const info = {
	energy: { name: 'Energy', aiWeight: 1.5, aiWants: 500, max: 25000, tradable: true },
	minerals: { name: 'Minerals', aiWeight: 1, aiWants: 1000, max: 25000, tradable: true },
	alloys: { name: 'Alloys', aiWeight: 5, aiWants: 500, max: 15000, tradable: true },
	unity: { name: 'Unity', aiWeight: 1, aiWants: null, max: 50000, tradable: false },
	trade: { name: 'Trade', aiWeight: null, aiWants: null, max: 50000, tradable: true }
};
const m = modelFrom({});
const ai = (fields: Partial<AiIntel>): AiIntel => ({
	countryId: 7,
	nomadic: false,
	personality: 'peaceful_traders',
	attitude: 'cordial',
	opinion: 50,
	trust: 10,
	opinionModifiers: [],
	stockpile: { energy: 20000, minerals: 5000, alloys: 300, trade: 30000 },
	net: { energy: 50, minerals: 0, alloys: 0, trade: 0 },
	income: {},
	...fields
});
const personalities = {
	peaceful_traders: { name: 'Peaceful Traders', willingness: 1 },
	devouring_swarm: { name: 'Devouring Swarm', willingness: 0 }
};
const attitudes = {
	cordial: { name: 'Cordial', trade: true },
	rival: { name: 'Rival', trade: false }
};

describe('aiValue and stance', () => {
	it('a measured worth, less with income; how full its storage is shows, not counts', () => {
		const a = ai({});
		expect(stance('energy', a, info, m)).toBe('plenty'); // 20000 > 0.75 × 25000 = 18750
		expect(stance('alloys', a, info, m)).toBe('needs'); // 300 < 0.33 × 15000
		expect(stance('minerals', a, info, m)).toBe('needs');
		// no gross income: p itself; an income of its base halves it
		expect(aiValue('energy', a, info, m)).toBe(WORTH.energy.p);
		const halved = { ...a, income: { energy: WORTH.energy.base } };
		expect(aiValue('energy', halved, info, m)).toBeCloseTo(WORTH.energy.p / 2);
		expect(aiValue('alloys', a, info, m)).toBe(WORTH.alloys.p);
		expect(aiValue('unity', a, info, m)).toBeNull();
		expect(aiValue('trade', a, info, m)).toBe(WORTH.trade.p);
		// tradable, but not measured
		expect(aiValue('motes', a, { ...info, motes: { ...info.alloys } }, m)).toBeNull();
	});
	it('spares only what it holds beyond its want', () => {
		expect(spare('energy', ai({}), info, m)).toBe(19500);
		expect(spare('alloys', ai({}), info, m)).toBe(0);
	});
	it('a nomadic empire never gives energy or minerals', () => {
		const n = ai({ nomadic: true });
		expect(spare('energy', n, info, m)).toBe(0);
		expect(spare('minerals', n, info, m)).toBe(0);
		expect(spare('trade', n, info, m)).toBe(29500); // keeps 500 (TRADE_MIN_RESOURCE_STOCKPILE)
		expect(canGive('energy', true)).toBe(false);
		expect(canGive('alloys', true)).toBe(true);
		expect(canGive('energy', false)).toBe(true);
	});
});

// The calibration session (docs/trade-calibration.md, results): KhellZen Republic in the
// 2212.08.01 autosave — federation_builders (willingness 0.95), friendly, opinion 240 — offering
// energy a month for ours a month, 10 years. Its economy as the save has it.
describe('the game’s numbers (2212.08.01)', () => {
	const khellZen = ai({
		personality: 'federation_builders',
		attitude: 'friendly',
		opinion: 240,
		stockpile: {
			energy: 13063.44699,
			minerals: 346.20258,
			food: 9863.86938,
			trade: 1108.15983,
			consumer_goods: 3122.30028,
			alloys: 260.66833,
			sr_dark_matter: 24
		},
		net: {
			energy: 95.18744,
			minerals: 40.60642,
			food: 64.93415,
			trade: 57.15531,
			consumer_goods: 28.76678,
			alloys: 17.54486
		},
		income: { energy: 181.89494, minerals: 100.20642 }
	});
	const game = {
		...info,
		minerals: { ...info.minerals, max: 15000 },
		food: { name: 'Food', aiWeight: 1, aiWants: 500, max: 15000, tradable: true },
		consumer_goods: { name: 'CG', aiWeight: 5, aiWants: 500, max: 15000, tradable: true },
		sr_dark_matter: { name: 'DM', aiWeight: 100, aiWants: 5, max: 15000, tradable: true }
	};
	const t = terms(khellZen, { federation_builders: { name: '', willingness: 0.95 } }, attitudes);
	it('counts what it gets at its willingness: the same resource 0.95 as much as it gives', () => {
		// tooltips: energy it gives 89 for 36, we give 142 for 60; food it gives 140 for 35, we 64 for 17
		const energy = 142 / 60 / (89 / 36);
		const food = 64 / 17 / (140 / 35);
		for (const x of [energy, food]) expect(Math.abs(x - 0.95)).toBeLessThan(0.015);
		const plain = terms(khellZen, { federation_builders: { name: '', willingness: 1 } }, attitudes);
		expect(
			rate('minerals', 'energy', khellZen, t, game, m)! /
				rate('minerals', 'energy', khellZen, plain, game, m)!
		).toBeCloseTo(0.95);
	});
	it('gives at once what it holds above max(its want, 500): 12563 energy, not 12564', () => {
		const at = (r: string) => Math.floor(spare(r, khellZen, game, m));
		expect(at('energy')).toBe(12563);
		expect(at('food')).toBe(9363);
		expect(at('trade')).toBe(608); // no ai_wants: the 500
		expect(at('consumer_goods')).toBe(2622);
		// refused at 1
		expect(at('minerals')).toBe(0); // 346 < its want of 1000
		expect(at('alloys')).toBe(0);
		expect(at('sr_dark_matter')).toBe(0); // 24, want 5: the 500 holds
	});
	it('pays at most 54 energy a month: 0.3 of its gross income, rounded down', () => {
		expect(monthlyCap('energy', khellZen, m)).toBe(54);
		expect(monthlyCap('alloys', khellZen, m)).toBe(0); // no income of it
		expect(monthlyCap('energy', ai({}), m)).toBeNull(); // read before READER 12
		expect(monthlyCap('energy', { ...khellZen, nomadic: true }, m)).toBe(0);
	});
});

// Every tooltip line of the calibration (docs/trade-calibration.md → Results): what one unit at once
// is worth to the empire, in the tooltip's unit — a month's unit over 10 years counts 60 (0.5 × 120),
// and what it gets counts at its willingness. Lines under 15 are left out (rounding: ±3 % and more).
describe('a unit’s worth against the game’s tooltips', () => {
	const game = Object.fromEntries(
		Object.keys(WORTH).map((r) => [
			r,
			{ name: r, aiWeight: 1, aiWants: 500, max: 15000, tradable: true }
		])
	);
	// gross income a month, from the 2212.08.01 autosave; how far the fit may be off there
	const empires = {
		KhellZen: {
			willingness: 0.95,
			income: {
				energy: 181.89,
				minerals: 100.21,
				food: 117.87,
				trade: 172.86,
				consumer_goods: 69.56,
				alloys: 21.37
			}
		},
		Lolehndra: {
			willingness: 0.8,
			income: {
				energy: 118.18,
				minerals: 84.38,
				food: 105.04,
				trade: 36.65,
				consumer_goods: 64.47,
				alloys: 22.4
			}
		},
		// fallen: stockpiles in the 100,000s, incomes in the 1,000s
		// 2213.02.01
		Ikaanan: {
			willingness: 0.75,
			income: {
				food: 85.89,
				trade: 55.48,
				consumer_goods: 56.67,
				alloys: 26.84
			}
		},
		Syvaal: {
			willingness: 0.5,
			income: {
				energy: 4570.68,
				minerals: 2678.82,
				food: 3112.96,
				trade: 1101.14,
				consumer_goods: 1190.43,
				alloys: 561.29,
				sr_living_metal: 22
			}
		}
	};
	// [empire, resource, amount, a month?, who gives it, tooltip]
	type Line = [keyof typeof empires, string, number, boolean, 'we' | 'it', number];
	const lines: Line[] = [
		['KhellZen', 'energy', 36, true, 'it', 89],
		['KhellZen', 'energy', 25, true, 'it', 62],
		['KhellZen', 'sr_living_metal', 5, true, 'we', 90],
		['KhellZen', 'food', 17, true, 'we', 64],
		['KhellZen', 'alloys', 9, true, 'we', 67],
		['KhellZen', 'energy', 60, true, 'we', 142],
		['KhellZen', 'minerals', 52, true, 'we', 143],
		['KhellZen', 'trade', 50, true, 'we', 131],
		['KhellZen', 'consumer_goods', 28, true, 'we', 145],
		['KhellZen', 'alloys', 19, true, 'we', 141],
		['KhellZen', 'food', 35, true, 'it', 140],
		['KhellZen', 'food', 32, true, 'it', 128],
		['KhellZen', 'food', 22, true, 'it', 88],
		['KhellZen', 'minerals', 1000, false, 'we', 46],
		['KhellZen', 'food', 1000, false, 'we', 63],
		['KhellZen', 'alloys', 1000, false, 'we', 124],
		['KhellZen', 'energy', 1000, false, 'we', 39],
		['KhellZen', 'energy', 12563, false, 'it', 522],
		['KhellZen', 'trade', 608, false, 'it', 28],
		['KhellZen', 'consumer_goods', 2622, false, 'it', 238],
		['KhellZen', 'food', 9363, false, 'it', 627],
		['Lolehndra', 'food', 31, true, 'it', 130],
		['Lolehndra', 'food', 18, true, 'it', 75],
		['Lolehndra', 'energy', 57, true, 'we', 132],
		['Lolehndra', 'minerals', 54, true, 'we', 131],
		['Lolehndra', 'trade', 37, true, 'we', 131],
		['Lolehndra', 'consumer_goods', 30, true, 'we', 133],
		['Lolehndra', 'alloys', 21, true, 'we', 131],
		['Lolehndra', 'sr_living_metal', 5, true, 'we', 76],
		['Syvaal', 'minerals', 50, true, 'it', 18],
		['Syvaal', 'minerals', 104, true, 'it', 38],
		['Syvaal', 'alloys', 10, true, 'it', 20],
		['Syvaal', 'alloys', 9, true, 'it', 18],
		['Syvaal', 'alloys', 19, true, 'it', 38],
		['Syvaal', 'energy', 161, true, 'we', 19],
		['Syvaal', 'energy', 178, true, 'we', 21],
		['Syvaal', 'food', 113, true, 'we', 19],
		['Syvaal', 'food', 125, true, 'we', 21],
		['Syvaal', 'trade', 50, true, 'we', 19],
		['Syvaal', 'consumer_goods', 36, true, 'we', 19],
		['Syvaal', 'consumer_goods', 40, true, 'we', 21],
		['Syvaal', 'alloys', 19, true, 'we', 19],
		['Syvaal', 'minerals', 113, true, 'we', 21],
		['Syvaal', 'sr_living_metal', 5, true, 'we', 39],
		['Ikaanan', 'food', 1000, false, 'we', 67],
		['Ikaanan', 'food', 3600, false, 'we', 244],
		['Ikaanan', 'trade', 1000, false, 'we', 50],
		['Ikaanan', 'consumer_goods', 1000, false, 'we', 73],
		['Ikaanan', 'alloys', 1000, false, 'we', 94],
		['Ikaanan', 'sr_living_metal', 108, false, 'we', 25]
	];
	// the fit: every line within 3 %, but food (12 %: no curve fits it) and minerals at the regular empires in 2212.08: 7 % under what
	// the same empires gave minerals at in 2213.01 (the gifts below) — unexplained
	it.each(lines)('%s: %s %d (a month: %s) from %s → %d', (who, r, amount, monthly, giver, tip) => {
		const e = empires[who];
		const seen = tip / amount / (monthly ? 60 : 1) / (giver === 'we' ? e.willingness : 1);
		const model = aiValue(r, ai({ income: e.income }), game, m)!;
		const tolerance = r === 'food' ? 0.12 : r === 'minerals' && who !== 'Syvaal' ? 0.08 : 0.03;
		expect(Math.abs(model / seen - 1)).toBeLessThan(tolerance);
	});
	// 1000 of a resource given to each empire: its gross income of it, willingness, the
	// acceptance's figure, and the rise of its "Favorable Trade Deal" in the next autosave (null:
	// capped at 100, or not accepted yet). Energy proposed 2212.08.01, minerals 2213.01.02.
	type Gift = [string, string, number, number, number, number | null];
	const gifts: Gift[] = [
		['test nomads', 'energy', 139, 0.95, 43, 42],
		['Ikaanan', 'energy', 110, 0.75, 36, 36],
		['Dekron', 'energy', 337, 0.9, 27, 27],
		['Lolehndra', 'energy', 118, 0.8, 38, 37],
		['YlKhahan', 'energy', 107, 0.7, 34, 33],
		['Cydran', 'energy', 240, 1, 36, 35],
		['Karkato', 'energy', 118, 0.25, 12, 11],
		['Kobarian', 'energy', 113, 1, 48, 47],
		['Oklarran', 'energy', 37, 0.9, 54, 53],
		['Dekrus', 'energy', 189, 0.5, 20, 19],
		['Hydarian', 'energy', 155, 0.8, 35, 34],
		['KhellZen', 'energy', 182, 0.95, 39, 38],
		['Themlaran', 'energy', 140, 0.75, 34, 33],
		['test nomads', 'minerals', 0, 0.95, 71, null],
		['Ikaanan', 'minerals', 92, 0.75, 40, 39],
		['Dekron', 'minerals', 179, 0.9, 38, 37],
		['Lolehndra', 'minerals', 84, 0.8, 44, 43],
		['YlKhahan', 'minerals', 0, 0.7, 52, 51],
		['Cydran', 'minerals', 123, 1, 49, 48],
		['Karkato', 'minerals', 117, 0.25, 12, 11],
		['Kobarian', 'minerals', 0, 1, 74, null],
		['Oklarran', 'minerals', 0, 0.9, 67, null],
		['Dekrus', 'minerals', 117, 0.5, 25, null],
		['Hydarian', 'minerals', 0, 0.8, 59, 58],
		['KhellZen', 'minerals', 102, 0.95, 50, 49],
		['Themlaran', 'minerals', 103, 0.75, 39, null]
	];
	it.each(gifts)('%s: 1000 %s (gross income %d)', (_, r, income, willingness, tip, opinion) => {
		const a = ai({ income: { [r]: income } });
		const t = { willingness, trades: true };
		const got = giftOpinion(r, 1000, a, t, game, m, { max: null, current: 0 })!;
		// within a point, or 4 %
		expect(Math.abs(got - tip)).toBeLessThanOrEqual(Math.max(1, 0.04 * tip));
		if (opinion !== null)
			expect(Math.abs(got - opinion)).toBeLessThanOrEqual(Math.max(1, 0.04 * tip));
	});
});

describe('rate', () => {
	const t = terms(ai({}), personalities, attitudes);
	it('gives our unit’s worth to it in its own resource, times its willingness', () => {
		expect(rate('alloys', 'energy', ai({}), t, info, m)).toBeCloseTo(
			WORTH.alloys.p / WORTH.energy.p
		);
		// it has no alloys to spare
		expect(rate('energy', 'alloys', ai({}), t, info, m)).toBeNull();
	});
	it('refuses with a non-trading attitude or a willingness of 0', () => {
		expect(terms(ai({ attitude: 'rival' }), personalities, attitudes).trades).toBe(false);
		expect(terms(ai({ personality: 'devouring_swarm' }), personalities, attitudes).trades).toBe(
			false
		);
	});
	it('compares with selling and buying on the market', () => {
		expect(marketRate('alloys', 'energy', { alloys: 4, energy: 1 }, 0.3)).toBeCloseTo(
			(4 * 0.7) / 1.3
		);
	});
	it('a gift buys its worth in opinion, up to the cap', () => {
		const cap = { max: 100, current: 0 };
		const worth = 1000 * WORTH.energy.p; // no income: 67.6
		expect(giftOpinion('energy', 1000, ai({}), t, info, m, cap)).toBe(Math.floor(worth));
		expect(giftOpinion('energy', 1000, ai({}), t, info, m, { max: 100, current: 80 })).toBe(20);
		expect(giftOpinion('energy', 1000, ai({}), t, info, m, { max: null, current: 0 })).toBe(67);
		expect(giftOpinion('unity', 1000, ai({}), t, info, m, cap)).toBeNull();
		// an attitude that refuses trades still takes gifts
		const rival = terms(ai({ attitude: 'rival' }), personalities, attitudes);
		expect(giftOpinion('energy', 1000, ai({}), rival, info, m, cap)).toBe(Math.floor(worth));
	});
});

describe('prices in trade', () => {
	const t = terms(ai({}), personalities, attitudes);
	it('what we pay for a unit and what we get for one', () => {
		// trade per energy: energy's worth over trade's
		expect(wantPrice('energy', ai({}), t, info, m)).toBeCloseTo(WORTH.energy.p / WORTH.trade.p);
		expect(offerPrice('alloys', ai({}), t, info, m)).toBeCloseTo(WORTH.alloys.p / WORTH.trade.p);
		// no alloys to spare
		expect(wantPrice('alloys', ai({}), t, info, m)).toBeNull();
		// a nomad sells no energy for trade
		expect(wantPrice('energy', ai({ nomadic: true }), t, info, m)).toBeNull();
	});
	it('the market: the fee on top when buying, off when selling', () => {
		expect(marketPrice('alloys', 'buy', { alloys: 4 }, 0.3)).toBeCloseTo(5.2);
		expect(marketPrice('alloys', 'sell', { alloys: 4 }, 0.3)).toBeCloseTo(2.8);
		expect(marketPrice('sr_zro', 'buy', { alloys: 4 }, 0.3)).toBeNull();
	});
});

describe('trader enclaves', () => {
	it('cost the same energy per unit whatever the deal size', () => {
		// 500 at once + 10 a month for 120 months, per unit a month
		expect(enclaveUnitCost()).toBeCloseTo(1700 / 120);
	});
	it('find our running deal in the country modifiers', () => {
		const mods = [
			{ key: 'enclave_trade_3_rig', until: '2220.01.01' },
			{ key: 'enclave_trade_2_xur', until: '2219.05.01' }
		];
		expect(enclaveDeal(1, mods)).toEqual({ perMonth: 2, until: '2219.05.01' });
		expect(enclaveDeal(2, mods)).toEqual({ perMonth: 3, until: '2220.01.01' });
		expect(enclaveDeal(3, mods)).toBeNull();
	});
});
