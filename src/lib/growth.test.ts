import { describe, expect, it } from 'vitest';
import { growthFlags, growthRows } from './growth.ts';
import type { Colony, Snapshot } from './types.ts';

const colony = (fields: Partial<Colony>) =>
	({
		planetId: 3,
		name: 'Caugantu Prime',
		designation: 'col_mining',
		colonizing: false,
		pops: 556,
		growth: { net: 2, by: { growth: 2 }, byStratum: {} },
		housing: 2900,
		housingUsed: 556,
		habitability: 0.8,
		...fields
	}) as unknown as Colony;
const save = (date: string, growth: number) =>
	({
		kind: 'save',
		date,
		colonies: [colony({ growth: { net: growth, by: { growth }, byStratum: {} } })]
	}) as unknown as Snapshot;

describe('growthRows', () => {
	it('averages the natural growth of the last saves (2212 shapes: 2, 1, 2, 2)', () => {
		const history = [save('2212.01.01', 2), save('2212.02.01', 1), save('2212.03.01', 2)];
		const latest = save('2212.03.05', 2);
		const [row] = growthRows([...history, latest], latest, () => ({ free: 10, blocked: 0 }));
		expect(row.growth).toBe(1.75);
		expect(row.samples).toBe(4);
		expect(row.monthsPer100).toBeCloseTo(100 / 1.75);
		expect(row.free).toBe(10);
	});
});

describe('growthFlags', () => {
	it('names the cap, overcrowding and low habitability', () => {
		expect(growthFlags(colony({ habitability: 1 }), 5)).toEqual(['at the cap (5)']);
		expect(growthFlags(colony({ housing: 1000, housingUsed: 1200, habitability: 1 }), 0)).toEqual([
			'overcrowded: growth stops (1.15 × housing)',
			'not growing'
		]);
		expect(growthFlags(colony({}), 2)).toEqual(['habitability 80 %: slower growth']);
	});
});
