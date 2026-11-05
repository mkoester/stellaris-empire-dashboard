import { describe, expect, it } from 'vitest';
import { researchSpeed, savedShare } from './researchSpeed.ts';
import type { Snapshot } from './types.ts';

const save = (date: string, progress: number, physics: number, stored = 0) =>
	({
		kind: 'save',
		date,
		income: { physics_research: physics },
		techStored: { physics: stored },
		progress: { research: [{ area: 'physics', tech: 'tech_power_hub_1', progress }] }
	}) as unknown as Snapshot;

describe('researchSpeed', () => {
	// Planetforgers 2213.10 → 11: 131.68 progress on 88.97 physics booked
	it('is the progress gained over the earlier month’s output', () => {
		const r = researchSpeed([save('2213.10.01', 100, 88.97), save('2213.11.01', 231.68, 90)]);
		expect(r.physics.factor).toBeCloseTo(1.48, 3);
	});
	it('skips months with stored research, gaps and mid-month saves', () => {
		expect(
			researchSpeed([save('2214.01.01', 0, 88.95, 500), save('2214.02.01', 220.61, 88)])
		).toEqual({});
		expect(researchSpeed([save('2213.10.01', 0, 50), save('2213.12.01', 150, 50)])).toEqual({});
		expect(researchSpeed([save('2213.10.01', 0, 50), save('2213.10.15', 30, 50)])).toEqual({});
	});
});

describe('savedShare', () => {
	it('shrinks the more speed there already is', () => {
		expect(savedShare(0.25)).toBeCloseTo(0.2);
		expect(savedShare(0.25, 1.48)).toBeCloseTo(0.1445, 4);
	});
});
