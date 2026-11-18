import { describe, expect, it } from 'vitest';
import { estimateFund, fundOf, fundState, unityUpkeep } from './edictFund.ts';
import { edictPrices } from './whatIf.ts';

describe('the fund', () => {
	it('is the add times one plus the mult', () => {
		expect(fundOf(60, 0.5)).toBe(90);
		expect(fundOf(-5, 0)).toBe(0);
	});
	it('sums what the empire holds and the council seats', () => {
		const by = {
			'modifier:empire_base': { add: 10 },
			'tech:tech_adaptive_bureaucracy': { add: 20 },
			'civic:civic_x': { mult: 0.1 },
			'tech:not_held': { add: 99 }
		};
		const held = ['modifier:empire_base', 'tech:tech_adaptive_bureaucracy', 'civic:civic_x'];
		// ruler +5 a level at level 3
		expect(estimateFund(held, by, [{ key: 'country_edict_fund_add', value: 15 }])).toBeCloseTo(
			49.5
		);
	});
});

describe('an edict against the fund', () => {
	// Roaming Korinth 2217.06.01: Farming Subsidies (30) active, nothing booked
	it('costs nothing while it fits in the room left', () => {
		const s = fundState({ amount: 75, exact: true }, 30, 0);
		expect(s.room).toBe(45);
		expect(unityUpkeep(30, false, s)).toBe(0); // Capacity Subsidies
		expect(unityUpkeep(60, false, s)).toBe(15);
		expect(unityUpkeep(30, true, s)).toBe(-0); // cancelling saves nothing
	});
	it('reads the fund as at least what the active edicts need when nothing is booked', () => {
		const s = fundState({ amount: 15, exact: false }, 30, 0);
		expect(s.fund.amount).toBe(30);
		expect(unityUpkeep(30, false, s)).toBe(30);
	});
	it('measures the scale where the budget books some', () => {
		// 60 base active, fund 40, booked 26: k = 66 / 60 = 1.1, need 66
		const s = fundState({ amount: 40, exact: true }, 60, 26);
		expect(s.k).toBeCloseTo(1.1);
		expect(s.room).toBe(0);
		expect(unityUpkeep(30, false, s)).toBeCloseTo(33);
		// cancelling 30 of 60: need 33, fund 40 → nothing booked: saves all 26
		expect(unityUpkeep(30, true, s)).toBeCloseTo(-26);
	});
});

describe('edictPrices with the fund', () => {
	const rows: Parameters<typeof edictPrices>[0] = [
		{ key: 'farming', active: true, cost: { cost: { unity: 30 }, upkeep: { unity: 30 } } },
		{ key: 'capacity', active: false, cost: { cost: { unity: 30 }, upkeep: { unity: 30 } } },
		{ key: 'campaign', active: false, cost: { cost: { energy: 50 }, upkeep: { energy: 50 } } }
	];
	it('charges unity only beyond the room left, and leaves other resources alone', () => {
		const fund = fundState({ amount: 75, exact: true }, 30, 0);
		const p = edictPrices(rows, {}, fund);
		expect(p.capacity.upkeep).toEqual({ unity: 0 });
		expect(p.capacity.note).toMatch(/^edict fund 75 unity a month, 30 of it in use/);
		expect(p.campaign.upkeep).toEqual({ energy: 50 });
		expect(p.campaign.note).toBeUndefined();
	});
	it('charges the full upkeep without a fund (the old reading)', () => {
		expect(edictPrices(rows, undefined).capacity.upkeep).toEqual({ unity: 30 });
	});
});
