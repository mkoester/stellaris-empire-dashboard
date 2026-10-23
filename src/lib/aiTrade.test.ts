import { describe, expect, it } from 'vitest';
import {
	aiValue,
	canGive,
	enclaveDeal,
	enclaveUnitCost,
	marketPrice,
	marketRate,
	giftOpinion,
	lumpForMonthly,
	modelFrom,
	monthlyCap,
	offerPrice,
	rate,
	room,
	spare,
	stance,
	terms,
	wantPrice,
	worthOf,
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

// Basic resources drift: at the same income KhellZen and Lolehndra valued minerals and food higher
// every half year, energy only until 2213.02; trade, consumer goods, alloys and living metal held.
// The model holds 2213.08; this is each earlier date's level against it.
type Dated = '2212.08' | '2213.01' | '2213.02';
const LEVEL: Record<Dated, Record<string, number>> = {
	'2212.08': { energy: 1 / 1.105, minerals: 1 / (1.075 * 1.085), food: 1 / (1.17 * 1.06) },
	'2213.01': { minerals: 1 / 1.085 },
	'2213.02': { minerals: 1 / 1.085, food: 1 / 1.06 }
};
const level = (date: Dated, r: string) => LEVEL[date][r] ?? 1;

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
		Cydran: {
			willingness: 1,
			income: { food: 21.5, trade: 237.99, consumer_goods: 63.46, alloys: 33.28 }
		},
		Dekron: {
			willingness: 0.9,
			income: { food: 0, trade: 156.23, consumer_goods: 101.13, alloys: 31.87 }
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
		['Ikaanan', 'sr_living_metal', 108, false, 'we', 25],
		['Cydran', 'food', 1000, false, 'we', 132],
		['Cydran', 'trade', 1000, false, 'we', 38],
		['Cydran', 'consumer_goods', 1000, false, 'we', 95],
		['Cydran', 'alloys', 1000, false, 'we', 121],
		['Cydran', 'sr_living_metal', 108, false, 'we', 33],
		['Dekron', 'food', 1000, false, 'we', 129],
		['Dekron', 'trade', 1000, false, 'we', 43],
		['Dekron', 'consumer_goods', 1000, false, 'we', 75],
		['Dekron', 'alloys', 1000, false, 'we', 110],
		['Dekron', 'sr_living_metal', 108, false, 'we', 30]
	];
	// the fit: every line within 3 %, the basic resources at their date's level (KhellZen,
	// Lolehndra and Syvaal were measured in 2212.08, the rest in 2213.02); minerals 8 % and food 10 %,
	// whose drift is less even
	it.each(lines)('%s: %s %d (a month: %s) from %s → %d', (who, r, amount, monthly, giver, tip) => {
		const e = empires[who];
		const seen = tip / amount / (monthly ? 60 : 1) / (giver === 'we' ? e.willingness : 1);
		// the fallen Syvaal's energy drifted like the rest; its minerals stood at 2213.01's level
		// already, its food near 2213.02's
		const date: Dated =
			who === 'Syvaal'
				? r === 'energy'
					? '2212.08'
					: r === 'minerals'
						? '2213.01'
						: '2213.02'
				: ['KhellZen', 'Lolehndra'].includes(who)
					? '2212.08'
					: '2213.02';
		const then = level(date, r);
		const model = aiValue(r, ai({ income: e.income }), game, m)! * then;
		const tolerance = r === 'food' ? 0.1 : r === 'minerals' ? 0.08 : 0.03;
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
		// energy gifts proposed in 2212.08, minerals in 2213.01
		const then = level(r === 'energy' ? '2212.08' : '2213.01', r);
		const got = Math.floor(1000 * aiValue(r, a, game, m)! * t.willingness * then);
		// within a point, or 4 %
		expect(Math.abs(got - tip)).toBeLessThanOrEqual(Math.max(1, 0.04 * tip));
		if (opinion !== null)
			expect(Math.abs(got - opinion)).toBeLessThanOrEqual(Math.max(1, 0.04 * tip));
	});
});

// The drift's check (2213.02.01, nothing sent): 1000 energy and 1000 alloys at the empires measured
// in 2212.08 — energy up 10 %, alloys unchanged; both now on the model's curve
describe('half a year on', () => {
	const game = Object.fromEntries(
		['energy', 'alloys'].map((r) => [
			r,
			{ name: r, aiWeight: 1, aiWants: 500, max: 15000, tradable: true }
		])
	);
	const now: [string, string, number, number, number][] = [
		['KhellZen', 'energy', 182.71, 0.95, 43],
		['KhellZen', 'alloys', 21.37, 0.95, 122],
		['Lolehndra', 'energy', 119.52, 0.8, 42],
		['Lolehndra', 'alloys', 22.34, 0.8, 103]
	];
	it.each(now)('%s: 1000 %s (gross %d)', (_, r, income, willingness, tip) => {
		const v = aiValue(r, ai({ income: { [r]: income } }), game, m)!;
		expect(Math.abs((1000 * v * willingness) / tip - 1)).toBeLessThan(0.02);
	});
});

// 1000 food at once, not sent (2213.02.01): gross food income, willingness, "Our Offer Total" —
// every empire with food at one date; Karkato and Hydarian fly bio ships
describe('food at one date', () => {
	const game = { food: { name: 'Food', aiWeight: 1, aiWants: 500, max: 15000, tradable: true } };
	const food: [string, number, number, number][] = [
		['YlKhahan', 99.98, 0.7, 59],
		['Karkato', 77.32, 0.25, 23],
		['KhellZen', 118.06, 0.95, 74],
		['Kobarian', 113.52, 1, 79],
		['Lolehndra', 104.75, 0.8, 66],
		['Mandate', 0, 0.5, 72],
		['Oklarran', 20, 0.9, 120],
		['Themlaran', 102.39, 0.75, 62],
		['Hydarian', 141.51, 0.8, 56],
		['test nomads', 87.19, 0.95, 85],
		['Ikaanan', 85.89, 0.75, 67],
		['Cydran', 21.5, 1, 132],
		['Dekron', 0, 0.9, 129]
	];
	it.each(food)('%s (gross %d)', (_, income, willingness, tip) => {
		const v =
			aiValue('food', ai({ income: { food: income } }), game, m)! * level('2213.02', 'food');
		expect(Math.abs((1000 * v * willingness) / tip - 1)).toBeLessThan(0.05);
	});
});

// A year and a half on (2213.08.01, nothing sent): KhellZen and Lolehndra again, 1000 of every
// resource and 145 living metal at once — the model's own level
describe('a year and a half on', () => {
	const game = Object.fromEntries(
		Object.keys(WORTH).map((r) => [
			r,
			{ name: r, aiWeight: 1, aiWants: 500, max: 15000, tradable: true }
		])
	);
	const income = {
		KhellZen: {
			energy: 182.42,
			minerals: 102.21,
			food: 118.06,
			trade: 174.52,
			consumer_goods: 69.56,
			alloys: 21.37
		},
		Lolehndra: {
			energy: 119.19,
			minerals: 84.25,
			food: 104.79,
			trade: 31.63,
			consumer_goods: 64.3,
			alloys: 22.34
		}
	};
	const willingness = { KhellZen: 0.95, Lolehndra: 0.8 };
	const tips: [keyof typeof income, string, number][] = [
		['KhellZen', 'energy', 42],
		['KhellZen', 'minerals', 53],
		['KhellZen', 'food', 78],
		['KhellZen', 'trade', 43],
		['KhellZen', 'consumer_goods', 86],
		['KhellZen', 'alloys', 122],
		['KhellZen', 'sr_living_metal', 43],
		['Lolehndra', 'energy', 42],
		['Lolehndra', 'minerals', 47],
		['Lolehndra', 'food', 70],
		['Lolehndra', 'trade', 59],
		['Lolehndra', 'consumer_goods', 74],
		['Lolehndra', 'alloys', 102],
		['Lolehndra', 'sr_living_metal', 36]
	];
	// the months after (2213.09.01, 10.01): the same at the same incomes but a point lost to the
	// tooltip's rounding, and the living metal we had (151, 158)
	const nextMonths: [string, keyof typeof income, string, number, number][] = [
		['2213.09', 'KhellZen', 'food', 1000, 77],
		['2213.09', 'KhellZen', 'sr_living_metal', 151, 45],
		['2213.09', 'Lolehndra', 'food', 1000, 69],
		['2213.09', 'Lolehndra', 'sr_living_metal', 151, 37],
		['2213.10', 'KhellZen', 'minerals', 1000, 52],
		['2213.10', 'KhellZen', 'sr_living_metal', 158, 47],
		['2213.10', 'Lolehndra', 'sr_living_metal', 158, 39],
		['2213.11', 'Lolehndra', 'minerals', 1000, 46],
		['2213.11', 'Lolehndra', 'sr_living_metal', 164, 41],
		['2213.12', 'Lolehndra', 'food', 1000, 68],
		['2213.12', 'Lolehndra', 'sr_living_metal', 170, 42]
	];
	// 2213.11.01: KhellZen's alloy, consumer goods and trade income moved, and its values with them
	const khellZen11 = {
		...income.KhellZen,
		energy: 179.8,
		trade: 166.61,
		consumer_goods: 75.03,
		alloys: 24.1
	};
	const moved: [string, number, number][] = [
		['energy', 1000, 42],
		['trade', 1000, 44],
		['consumer_goods', 1000, 85],
		['alloys', 1000, 120],
		['sr_living_metal', 164, 48],
		['sr_living_metal', 170, 50] // 2213.12, incomes as in 2213.11
	];
	it.each(moved)('2213.11: KhellZen: %s %d → %d', (r, amount, tip) => {
		const v = aiValue(r, ai({ income: khellZen11 }), game, m)!;
		expect(Math.abs((amount * v * willingness.KhellZen) / tip - 1)).toBeLessThan(0.03);
	});
	// 2213.12.01: Lolehndra's trade income fell (31.43 → 25.86), its trade value rose
	it('2213.12: Lolehndra: trade follows its income', () => {
		const v = aiValue('trade', ai({ income: { ...income.Lolehndra, trade: 25.86 } }), game, m)!;
		expect(Math.abs((1000 * v * willingness.Lolehndra) / 61 - 1)).toBeLessThan(0.03);
	});
	it.each(nextMonths)('%s: %s: %s %d → %d', (_, who, r, amount, tip) => {
		const v = aiValue(r, ai({ income: income[who] }), game, m)!;
		expect(Math.abs((amount * v * willingness[who]) / tip - 1)).toBeLessThan(0.03);
	});
	it.each(tips)('%s: %s → %d', (who, r, tip) => {
		const amount = r === 'sr_living_metal' ? 145 : 1000;
		const v = aiValue(r, ai({ income: income[who] }), game, m)!;
		expect(Math.abs((amount * v * willingness[who]) / tip - 1)).toBeLessThan(0.03);
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
		const a = ai({ stockpile: { energy: 5000 } }); // room for it under 0.8 × 25,000
		const worth = 1000 * WORTH.energy.p; // no income: 67.6
		expect(giftOpinion('energy', 1000, a, t, info, m, cap)).toBe(Math.floor(worth));
		expect(giftOpinion('energy', 1000, a, t, info, m, { max: 100, current: 80 })).toBe(20);
		expect(giftOpinion('energy', 1000, a, t, info, m, { max: null, current: 0 })).toBe(
			Math.floor(worth)
		);
		expect(giftOpinion('unity', 1000, a, t, info, m, cap)).toBeNull();
		// an attitude that refuses trades still takes gifts
		const rival = terms(ai({ attitude: 'rival' }), personalities, attitudes);
		expect(giftOpinion('energy', 1000, a, rival, info, m, cap)).toBe(Math.floor(worth));
		// into full storage: nothing (the default empire holds 20,000 of 25,000)
		expect(giftOpinion('energy', 1000, ai({}), t, info, m, cap)).toBe(0);
	});
});

// 10,000 of each at once, nothing sent (2214.01.01; we had just filled our own storage by console —
// it changed nothing): what an AI takes in counts only up to 0.8 of its storage
describe('room in storage', () => {
	const game = {
		energy: { name: 'Energy', aiWeight: 1.5, aiWants: 500, max: 25000, tradable: true },
		minerals: { name: 'Minerals', aiWeight: 1, aiWants: 1000, max: 15000, tradable: true },
		food: { name: 'Food', aiWeight: 1, aiWants: 500, max: 15000, tradable: true },
		trade: { name: 'Trade', aiWeight: null, aiWants: null, max: 50000, tradable: true },
		consumer_goods: { name: 'CG', aiWeight: 5, aiWants: 500, max: 15000, tradable: true },
		alloys: { name: 'Alloys', aiWeight: 5, aiWants: 500, max: 15000, tradable: true },
		sr_living_metal: { name: 'LM', aiWeight: 100, aiWants: 5, max: 15000, tradable: true }
	};
	const khellZen = ai({
		stockpile: {
			energy: 13621,
			minerals: 444,
			food: 10974,
			trade: 2081,
			consumer_goods: 3623,
			alloys: 341,
			sr_living_metal: 119
		},
		income: {
			energy: 180.68,
			minerals: 102.91,
			food: 119.66,
			trade: 166.58,
			consumer_goods: 75.03,
			alloys: 24.1
		}
	});
	const lolehndra = ai({
		stockpile: {
			energy: 877,
			minerals: 224,
			food: 1188,
			trade: 1147,
			consumer_goods: 666,
			alloys: 137
		},
		income: {
			energy: 118.18,
			minerals: 84.67,
			food: 106.44,
			trade: 25.8,
			consumer_goods: 64.23,
			alloys: 22.32
		}
	});
	const cases: [string, AiIntel, number, string, number][] = [
		['KhellZen', khellZen, 0.95, 'energy', 273], // 6,379 fit
		['KhellZen', khellZen, 0.95, 'minerals', 522],
		['KhellZen', khellZen, 0.95, 'food', 78], // 1,026 fit
		['KhellZen', khellZen, 0.95, 'trade', 444],
		['KhellZen', khellZen, 0.95, 'consumer_goods', 714], // 8,377 fit
		['KhellZen', khellZen, 0.95, 'alloys', 1202],
		['KhellZen', khellZen, 0.95, 'sr_living_metal', 2980],
		['Lolehndra', lolehndra, 0.8, 'energy', 422],
		['Lolehndra', lolehndra, 0.8, 'minerals', 465],
		['Lolehndra', lolehndra, 0.8, 'food', 683],
		['Lolehndra', lolehndra, 0.8, 'trade', 617],
		['Lolehndra', lolehndra, 0.8, 'consumer_goods', 746],
		['Lolehndra', lolehndra, 0.8, 'alloys', 1021],
		['Lolehndra', lolehndra, 0.8, 'sr_living_metal', 2509]
	];
	it.each(cases)('%s: 10,000 %s → %d', (_, a, willingness, r, tip) => {
		const w = worthOf(r, 10000, a, game, m)! * willingness;
		expect(Math.abs(w / tip - 1)).toBeLessThan(0.025);
	});
	it('room is 0.8 of storage less the stockpile', () => {
		expect(room('energy', khellZen, game, m)).toBeCloseTo(0.8 * 25000 - 13621);
		expect(room('food', khellZen, game, m)).toBeCloseTo(1026);
		expect(room('food', ai({ stockpile: { food: 14000 } }), game, m)).toBe(0);
	});
});

describe('pay once, receive monthly', () => {
	// KhellZen at 2213.02.01: 1000 alloys at once (tooltip 122) for energy a month
	const khellZen = ai({
		personality: 'federation_builders',
		stockpile: { energy: 14633, alloys: 260 },
		net: { energy: 94.02, alloys: 17.17 },
		income: { energy: 182.71, alloys: 21.37 }
	});
	const t = { willingness: 0.95, trades: true };
	const game = Object.fromEntries(
		['energy', 'alloys'].map((r) => [
			r,
			{ name: r, aiWeight: 1, aiWants: 500, max: 15000, tradable: true }
		])
	);
	it('pays twice the one-off swap over the deal, whatever its length', () => {
		const once = 1000 * rate('alloys', 'energy', khellZen, t, game, m)!;
		const ten = lumpForMonthly('alloys', 1000, 'energy', 10, khellZen, t, game, m)!;
		const thirty = lumpForMonthly('alloys', 1000, 'energy', 30, khellZen, t, game, m)!;
		expect(ten.perMonth).toBe(Math.floor((2 * once) / 120)); // ≈ 45
		expect(ten.total / (2 * once)).toBeGreaterThan(0.97);
		expect(thirty.perMonth).toBe(Math.floor((2 * once) / 360)); // ≈ 15
		expect(ten.capped).toBe(false);
	});
	it('is held to its monthly cap, and tells how long it can afford it', () => {
		const big = lumpForMonthly('alloys', 3000, 'energy', 10, khellZen, t, game, m)!;
		expect(big.perMonth).toBe(54); // 0.3 × 182.71
		expect(big.capped).toBe(true);
		expect(big.netAfter).toBeCloseTo(94.02 - 54);
		expect(big.monthsLeft).toBeNull();
		// a poorer payer: net 10 a month, 500 in store, 45 a month due → 14 months
		const poor = { ...khellZen, net: { energy: 10 }, stockpile: { energy: 500 } };
		const deal = lumpForMonthly('alloys', 1000, 'energy', 10, poor, t, game, m)!;
		expect(deal.monthsLeft).toBe(Math.floor(500 / (deal.perMonth - 10)));
	});
	it('nothing from a nomad’s reserve, nor when it does not trade', () => {
		const nomad = { ...khellZen, nomadic: true };
		expect(lumpForMonthly('alloys', 1000, 'energy', 10, nomad, t, game, m)).toBeNull();
		const refuses = { willingness: 0.95, trades: false };
		expect(lumpForMonthly('alloys', 1000, 'energy', 10, khellZen, refuses, game, m)).toBeNull();
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
