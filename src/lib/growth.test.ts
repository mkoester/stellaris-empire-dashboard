import { describe, expect, it } from 'vitest';
import { growthFlags, growthRows, planetCapacity } from './growth.ts';
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
		buildQueue: [],
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

describe('planetCapacity', () => {
	it("matches the game's Colony Capacity (Planetforgers 2212.03.05–2213.08.01)", () => {
		// [housing, free slots (max − built − queued), the game's capacity]
		const readings: [number, number, number][] = [
			[9800, 24 - 17, 12600], // Embron 03.05
			[9800, 24 - 18, 12200], // Embron 04.01: a city district queued
			[9800, 25 - 18, 12600], // Embron 06.01: + Adaptive Ecology
			[10400, 25 - 18, 13200], // Embron 2213.08.01: the city district built, +600 housing
			[2900, 13 - 5, 6100], // Caugantu Prime 03.05 (80 %) and 05.01 (90 %)
			[2900, 14 - 5, 6500] // Caugantu Prime 06.01
		];
		for (const [housing, free, game] of readings) expect(planetCapacity(housing, free)).toBe(game);
		expect(planetCapacity(null, 3)).toBeNull();
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
		const queued = colony({
			habitability: 1,
			buildQueue: [{ kind: 'district', name: 'district_city', progress: 26, needed: 480 }]
		} as Partial<Colony>);
		expect(growthFlags(queued, 2)).toEqual(['1 queued district: −400 capacity now']);
	});
});
