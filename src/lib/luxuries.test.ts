import { describe, expect, it } from 'vitest';
import { jobOutput, luxuryCost, luxuryWhatIf, LUXURY_MODIFIER } from './luxuries.ts';
import type { Colony } from './types.ts';
import { wellbeingRules } from './wellbeing.ts';

const rules = wellbeingRules({}, () => undefined); // the game's values (fallbacks)

const colony = (over: Partial<Colony>) =>
	({
		designation: 'col_capital',
		pops: 5700,
		stability: 60,
		amenities: 800,
		amenitiesUsage: 1000,
		approval: 0.5,
		happiness: 0.5,
		planet: { deposits: [], modifiers: [] },
		...over
	}) as Colony;

describe('luxuryCost', () => {
	it('takes 100 Consumer Goods per started 1000 pops, the decision file’s steps', () => {
		expect(
			[0, 999, 1000, 5700, 6999, 7000, 8499, 8500, 9999, 10000, 50000].map(luxuryCost)
		).toEqual([100, 100, 200, 600, 700, 800, 800, 900, 900, 1000, 1000]);
	});
});

describe('luxuryWhatIf', () => {
	it('follows amenities to stability to job output, upkeep untouched', () => {
		// 800 of 1000 → 1000 of 1000: −0.5 × 0.2/0.75 happiness gone (+13.3 points)
		const w = luxuryWhatIf(colony({}), { physics_research: 110 }, null, false, rules)!;
		expect(w.cost).toBe(600);
		expect(w.amenities).toBe(200);
		expect(w.happiness).toBeCloseTo(0.5 * (0.2 / 0.75));
		// approval 0.5 → 0.633: +30 × 0.133/0.5 = +8 stability
		expect(w.stability).toBeCloseTo(8);
		// stability 60 → 68: output +6 % → +7.2 %, a gain of 0.054 on the base (110 / 1.06)
		expect(w.output).toBeCloseTo(0.3 * (8 / 50));
		expect(w.monthly.physics_research).toBeCloseTo((110 / 1.06) * 0.048);
		expect(w.total.physics_research).toBeCloseTo(w.monthly.physics_research * 120);
	});

	it('gains no output at the stability cap', () => {
		const w = luxuryWhatIf(colony({ stability: 100 }), { energy: 50 }, 115, false, rules)!;
		expect(w.output).toBe(0);
		expect(w.monthly.energy).toBe(0);
	});

	it('is not offered to gestalts, Nanotech Worlds or while it runs', () => {
		expect(luxuryWhatIf(colony({}), {}, null, true, rules)).toBeNull();
		expect(
			luxuryWhatIf(colony({ designation: 'col_nanotech_world' }), {}, null, false, rules)
		).toBeNull();
		const running = colony({
			planet: { deposits: [], modifiers: [{ key: LUXURY_MODIFIER, until: '2210.01.01' }] }
		});
		expect(luxuryWhatIf(running, {}, null, false, rules)).toBeNull();
	});
});

describe('jobOutput', () => {
	it('sums what the jobs make, not what they use', () => {
		expect(
			jobOutput([
				{ flows: { physics_research: 14.46, consumer_goods: -5.16 } },
				{ flows: { physics_research: 1 } },
				{}
			])
		).toEqual({ physics_research: 15.46 });
	});
});
