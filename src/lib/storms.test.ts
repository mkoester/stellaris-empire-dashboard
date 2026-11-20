import { describe, expect, it } from 'vitest';
import { canForecast, stormArrivals, stormFill, stormsSeen, STORM_COLOR } from './storms.ts';
import type { Storm } from './types.ts';

// Roaming Cybergang 2226.08.01, the particle storm: at 334, next 1073 (43.3 units away), then 543
const pos: Record<number, { x: number; y: number }> = {
	334: { x: 160.79, y: 338.14 },
	1073: { x: 170.82, y: 296.06 },
	543: { x: 176.58, y: 245.73 }
};
const storm: Storm = {
	id: 16777216,
	type: 'particle_storm',
	name: 'Tempest Shibbal',
	systems: [334, 39],
	path: [1073, 543],
	daysToNext: 2163,
	speed: 0.02,
	affectsUs: false
};
const at = (id: number) => pos[id];

describe('storms', () => {
	it('reaches each system on its path: the save’s days, then distance over speed', () => {
		const a = stormArrivals(storm, at);
		expect(a.map((x) => x.systemId)).toEqual([1073, 543]);
		expect(a[0].days).toBe(2163);
		expect(a[1].days).toBeCloseTo(2163 + Math.hypot(5.76, 50.33) / 0.02, 0);
		// a system without a position ends the chain
		expect(stormArrivals({ ...storm, path: [1073, 9, 543] }, at).length).toBe(1);
		expect(stormArrivals({ ...storm, daysToNext: null }, at)).toEqual([]);
	});

	it('fills covered systems in the storm’s colour, those ahead lighter, with when', () => {
		const { fill, titles } = stormFill([storm], at, '2226.08.01');
		expect(fill[334]).toBe(STORM_COLOR.particle_storm);
		expect(fill[1073]).toBe(`${STORM_COLOR.particle_storm}66`);
		expect(titles[334]).toBe('Tempest Shibbal (Particle Storm) is here');
		expect(titles[1073]).toBe('Tempest Shibbal (Particle Storm) ≈ 2232.08.04 (in ≈ 6.0 years)');
	});

	it('shows the path only with storm movement intel', () => {
		expect(canForecast(['tech_storm_prediction_1'])).toBe(true);
		expect(canForecast(['tech_industrial_storm_protection'])).toBe(false);
		expect(stormsSeen([storm], false)[0].path).toEqual([]);
		expect(stormsSeen([storm], true)[0].path).toEqual([1073, 543]);
	});
});
