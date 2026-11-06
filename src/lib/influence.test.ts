import { describe, expect, it } from 'vitest';
import {
	influenceSeries,
	lostAtCap,
	powerProjection,
	rivalSlots,
	uncollected
} from './influence.ts';
import type { Unbooked } from './series.ts';
import type { Snapshot } from './types.ts';

describe('powerProjection', () => {
	// the fits: used naval capacity, empire size → booked power projection (saves, 2026-11-05)
	it.each([
		[15, 52, 1.15384],
		[15, 51, 1.17646],
		[15, 119, 0.5042],
		[12, 69, 0.69564],
		[28, 70, 1.6],
		[15, 50, 1.2]
	])('%d used at size %d books what 2 × coverage gives', (used, size, booked) => {
		const pp = powerProjection(size, used, booked);
		expect(2 * pp.coverage).toBeCloseTo(booked, 3);
		expect(pp.max).toBeCloseTo(2, 3);
		expect(pp.floored).toBe(false);
	});
	it('stays at 2 with full coverage, and says how much navy is missing', () => {
		expect(powerProjection(70, 52, 2)).toMatchObject({ max: 2, coverage: 1, navalToMax: 0 });
		expect(powerProjection(52, 15, 1.15384).navalToMax).toBe(11);
	});
	it('reads a raised maximum from the booked amount', () => {
		expect(powerProjection(60, 15, 1.5).max).toBeCloseTo(3, 6); // coverage 0.5
	});
	it('floors coverage at 10 % (Roaming Korinth: no navy, 0.2 booked)', () => {
		expect(powerProjection(68, 0, 0.2)).toMatchObject({ coverage: 0.1, max: 2, floored: true });
	});
});

describe('rivalSlots', () => {
	it('adds the Animosity stance and Enmity', () => {
		expect(rivalSlots([], [])).toBe(3);
		expect(rivalSlots(['diplo_stance_animosity'], ['tr_enmity_adopt'])).toBe(6);
	});
});

const snap = (o: Partial<Snapshot>) =>
	({
		date: '2201.06.01',
		budget: [],
		empireSize: 52,
		navalUsed: 15,
		policyFlags: [],
		traditions: [],
		storageMax: null,
		stockpile: {},
		income: {},
		balance: {},
		...o
	}) as unknown as Snapshot;

describe('uncollected', () => {
	it('names power projection and the empty rival slots', () => {
		const u = uncollected(
			snap({
				budget: [
					{ source: 'country_power_projection', income: { influence: 1.15384 }, expenses: {} }
				]
			}),
			0
		);
		expect(u.map((x) => x.what)).toEqual(['power projection', '3 free rival slots']);
		expect(u[0].amount).toBeCloseTo(0.846, 3);
		expect(u[1].amount).toBe(1.5);
	});
	it('values a rival slot at what a rival books now', () => {
		const u = uncollected(
			snap({
				navalUsed: 26,
				budget: [
					{ source: 'country_power_projection', income: { influence: 2 }, expenses: {} },
					{ source: 'rivalries', income: { influence: 1.2 }, expenses: {} }
				]
			}),
			2
		);
		expect(u).toEqual([
			expect.objectContaining({ what: 'a free rival slot', amount: 0.6, estimated: false })
		]);
	});
	it('counts income lost at a full stockpile', () => {
		const u = uncollected(
			snap({
				navalUsed: 26,
				policyFlags: null,
				storageMax: { influence: 1000 },
				stockpile: { influence: 1000 },
				income: { influence: 4 },
				balance: { influence: 3 }
			}),
			0
		);
		expect(u).toEqual([expect.objectContaining({ what: 'storage full', amount: 3 })]);
	});
});

describe('influenceSeries', () => {
	it('draws each source net, skipping months without a budget', () => {
		const s = influenceSeries(
			[
				snap({
					date: '2201.01.01',
					balance: { influence: 2.5 },
					budget: [
						{ source: 'country_base', income: { influence: 3 }, expenses: {} },
						{ source: 'migration_pacts', income: {}, expenses: { influence: 0.25 } },
						{ source: 'planet_miners', income: { minerals: 4 }, expenses: {} }
					]
				}),
				snap({ date: '2201.01.15', budget: null })
			],
			(x) => x
		);
		expect(s.x).toHaveLength(1);
		expect(s.lines).toEqual({ net: [2.5], country_base: [3], migration_pacts: [-0.25] });
	});
});

describe('lostAtCap', () => {
	const u = (actual: number, booked: number) => ({ actual, booked }) as Unbooked;
	it('without the mod: a stockpile that did not move although the budget booked a gain', () => {
		// Planetforgers 2214.01 → 02: 1000 both months, +5.8 booked
		const s = snap({ stockpile: { influence: 1000 }, balance: { influence: 5.8 } });
		expect(lostAtCap(s, u(0, 5.8))).toEqual({ amount: 5.8, at: 1000, estimated: true });
		expect(lostAtCap(s, u(5.8, 5.8))).toBeNull();
	});
	it('with the mod: the net while at the maximum', () => {
		const s = snap({
			storageMax: { influence: 1000 },
			stockpile: { influence: 1000 },
			balance: { influence: 3 }
		});
		expect(lostAtCap(s, null)).toEqual({ amount: 3, at: 1000, estimated: false });
	});
});
