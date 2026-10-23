import { describe, expect, it } from 'vitest';
import {
	aiValue,
	canGive,
	enclaveDeal,
	enclaveUnitCost,
	marketPrice,
	marketRate,
	modelFrom,
	monthlyCap,
	monthsLeft,
	offerPrice,
	rate,
	spare,
	stance,
	terms,
	wantPrice
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
	it('weighs by ai_weight, less with income; how full its storage is shows, not counts', () => {
		const a = ai({});
		expect(stance('energy', a, info, m)).toBe('plenty'); // 20000 > 0.75 × 25000 = 18750
		expect(stance('alloys', a, info, m)).toBe('needs'); // 300 < 0.33 × 15000
		expect(stance('minerals', a, info, m)).toBe('needs');
		// energy: 1.5 × 50 / (50 + 50)
		expect(aiValue('energy', a, info, m)).toBeCloseTo(0.75);
		expect(aiValue('alloys', a, info, m)).toBe(5);
		expect(aiValue('unity', a, info, m)).toBeNull();
		// trade: the guessed weight
		expect(aiValue('trade', a, info, m)).toBe(m.tradeWeight);
	});
	it('spares only what it holds beyond its want', () => {
		expect(spare('energy', ai({}), info, m)).toBe(19500);
		expect(spare('alloys', ai({}), info, m)).toBe(0);
	});
	it('a nomadic empire never gives energy or minerals', () => {
		const n = ai({ nomadic: true });
		expect(spare('energy', n, info, m)).toBe(0);
		expect(spare('minerals', n, info, m)).toBe(0);
		expect(spare('trade', n, info, m)).toBe(30000);
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
		stockpile: { energy: 13063.4, minerals: 346.2 },
		net: { energy: 95.18744, minerals: 40.60642 },
		income: { energy: 181.89494, minerals: 100.20642 }
	});
	const game = { ...info, minerals: { ...info.minerals, max: 15000 } };
	const t = terms(khellZen, { federation_builders: { name: '', willingness: 0.95 } }, attitudes);
	it('its energy at the tooltip’s worth: 36 a month 89, 25 a month 62', () => {
		const e = aiValue('energy', khellZen, game, m)!;
		// the tooltip's unit is the model's × a constant (≈ 4.79): one fits both
		const k = 89 / (36 * e);
		expect(Math.round(25 * e * k)).toBe(62);
	});
	it('takes 46 minerals a month for 50 energy, not 45 — within 2 %', () => {
		// 50 / 46 = 1.087 … 50 / 45 = 1.111 minerals' worth in energy
		const r = rate('minerals', 'energy', khellZen, t, game, m)!;
		expect(r).toBeGreaterThan(1.087 * 0.98);
		expect(r).toBeLessThan(1.111);
	});
	it('pays at most 54 energy a month: 0.3 of its gross income, rounded down', () => {
		expect(monthlyCap('energy', khellZen, m)).toBe(54);
		expect(monthlyCap('alloys', khellZen, m)).toBe(0); // no income of it
		expect(monthlyCap('energy', ai({}), m)).toBeNull(); // read before READER 12
		expect(monthlyCap('energy', { ...khellZen, nomadic: true }, m)).toBe(0);
	});
});

describe('rate', () => {
	const t = terms(ai({}), personalities, attitudes);
	it('gives our unit’s worth to it in its own resource', () => {
		// 1 alloy (5) for energy (0.75 each): 6.67 energy
		expect(rate('alloys', 'energy', ai({}), t, info, m)).toBeCloseTo(6.67, 2);
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
	it('counts a gift’s months at its decay', () => {
		expect(monthsLeft(30, 2)).toBe(15);
	});
});

describe('prices in trade', () => {
	const t = terms(ai({}), personalities, attitudes);
	it('what we pay for a unit and what we get for one', () => {
		// it gives energy (0.75) for trade (1): 1.33 energy per trade, so 0.75 trade per energy
		expect(wantPrice('energy', ai({}), t, info, m)).toBeCloseTo(0.75);
		// alloys (5) for its trade (1): 5 trade per alloy
		expect(offerPrice('alloys', ai({}), t, info, m)).toBeCloseTo(5);
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
