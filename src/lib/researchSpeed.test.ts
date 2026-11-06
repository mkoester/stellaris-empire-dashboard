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
	it('reads an area missing from the stored points as none stored', () => {
		const a = { ...save('2201.02.01', 0, 50), techStored: {} } as Snapshot;
		expect(researchSpeed([a, save('2201.03.01', 53.5, 50)]).physics.factor).toBeCloseTo(1.07);
		const old = { ...save('2201.02.01', 0, 50), techStored: null } as Snapshot;
		expect(researchSpeed([old, save('2201.03.01', 53.5, 50)])).toEqual({});
	});
	it('reads an idle area’s stored points growing (UNE 2, 2201.02 → 03)', () => {
		const idle = (date: string, stored: number) =>
			({
				kind: 'save',
				date,
				income: { physics_research: 14.03796 },
				techStored: { physics: stored },
				progress: { research: [] }
			}) as unknown as Snapshot;
		const r = researchSpeed([idle('2201.02.01', 186.01548), idle('2201.03.01', 200.33419)]);
		expect(r.physics).toEqual({ factor: expect.closeTo(1.02, 4), date: '2201.03.01', tech: null });
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
