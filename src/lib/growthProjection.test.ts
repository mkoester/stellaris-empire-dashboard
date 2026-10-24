import { describe, expect, it } from 'vitest';
import { growthLimit, logisticGrowth, projectColony, sumProjections } from './growthProjection.ts';

// Caugantu-like: 2000 pops, capacity 6100, housing 3000 all used
const row = {
	pops: 2000,
	growth: 2.5,
	assembly: null,
	capacity: 6100,
	housing: 3000,
	housingUsed: 2000
};

describe('logisticGrowth', () => {
	it('is fastest at half the capacity and floored at 10 % near it', () => {
		expect(logisticGrowth(3000, 6000)).toBeCloseTo(0.0025 * 3000 * 0.5);
		expect(logisticGrowth(5900, 6000)).toBeCloseTo(0.0025 * 5900 * 0.1);
	});

	it('counts a small colony as 10 pops', () => {
		expect(logisticGrowth(1, 6000)).toBeCloseTo(0.0025 * 10 * (1 - 1 / 6000));
	});
});

describe('projectColony', () => {
	it('starts at the measured growth (the speed is calibrated to it)', () => {
		const p = projectColony(row, 1);
		expect(p.bio[1]).toBeCloseTo(2.5);
		expect(p.pops[1]).toBeCloseTo(2002.5);
	});

	it('never grows faster than the cap', () => {
		const p = projectColony({ ...row, growth: 5 }, 600);
		const steps = p.pops.slice(1).map((v, i) => v - p.pops[i]);
		expect(Math.max(...steps)).toBeLessThanOrEqual(5 + 1e-9);
	});

	it('stops at 1.15 × housing, housing need per pop as today', () => {
		expect(growthLimit(row, 1.15)).toBeCloseTo(3450);
		const p = projectColony(row, 1200);
		expect(p.pops.at(-1)!).toBeLessThan(3450 + 5);
		expect(p.pops.at(-1)!).toBeGreaterThanOrEqual(3450);
		expect(p.stopsAt).not.toBeNull();
	});

	it('assembles at the measured rate, apart from growth', () => {
		const machine = { ...row, growth: null, assembly: 4, housing: 100000 };
		const p = projectColony(machine, 12);
		expect(p.mech[12]).toBeCloseTo(48);
		expect(p.bio[12]).toBe(0);
	});

	it('keeps the measured rate without a capacity', () => {
		const p = projectColony({ ...row, capacity: null, housing: 100000 }, 10);
		expect(p.bio[10]).toBeCloseTo(25);
	});
});

describe('sumProjections', () => {
	it('adds the colonies month by month', () => {
		const a = projectColony(row, 3);
		const b = projectColony({ ...row, growth: null, assembly: 1 }, 3);
		const sum = sumProjections([a, b], 3);
		expect(sum.pops[3]).toBeCloseTo(a.pops[3] + b.pops[3]);
		expect(sum.mech[3]).toBeCloseTo(3);
	});
});
