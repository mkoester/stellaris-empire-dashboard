import { describe, expect, it } from 'vitest';
import {
	aiValue,
	marketRate,
	modelFrom,
	monthsLeft,
	rate,
	spare,
	stance,
	terms
} from './aiTrade.ts';
import type { AiIntel } from './types.ts';

const info = {
	energy: { name: 'Energy', aiWeight: 1.5, aiWants: 500, max: 25000, tradable: true },
	minerals: { name: 'Minerals', aiWeight: 1, aiWants: 1000, max: 25000, tradable: true },
	alloys: { name: 'Alloys', aiWeight: 5, aiWants: 500, max: 15000, tradable: true },
	unity: { name: 'Unity', aiWeight: 1, aiWants: null, max: 50000, tradable: false }
};
const m = modelFrom({});
const ai = (fields: Partial<AiIntel>): AiIntel => ({
	countryId: 7,
	personality: 'peaceful_traders',
	attitude: 'cordial',
	opinion: 50,
	trust: 10,
	opinionModifiers: [],
	stockpile: { energy: 20000, minerals: 5000, alloys: 300 },
	net: { energy: 50, minerals: 0, alloys: 0 },
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
	it('weighs by ai_weight, less with income, by how full its storage is', () => {
		const a = ai({});
		expect(stance('energy', a, info, m)).toBe('plenty'); // 20000 > 0.75 × 25000 = 18750
		expect(stance('alloys', a, info, m)).toBe('needs'); // 300 < 0.33 × 15000
		expect(stance('minerals', a, info, m)).toBe('needs');
		// energy: 1.5 × 50 / (50 + 50) × 0.5
		expect(aiValue('energy', a, info, m)).toBeCloseTo(0.375);
		expect(aiValue('alloys', a, info, m)).toBe(10);
		expect(aiValue('unity', a, info, m)).toBeNull();
	});
	it('spares only what it holds beyond its want', () => {
		expect(spare('energy', ai({}), info, m)).toBe(19500);
		expect(spare('alloys', ai({}), info, m)).toBe(0);
	});
});

describe('rate', () => {
	const t = terms(ai({}), personalities, attitudes);
	it('gives our unit’s worth to it in its own resource, times its willingness', () => {
		// 1 alloy (10) for energy (0.375 each): 26.7 energy
		expect(rate('alloys', 'energy', ai({}), t, info, m)).toBeCloseTo(26.67, 1);
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
