import { describe, expect, it } from 'vitest';
import { habitatRow, habitatVisible, sortHabitats } from './habitats.ts';

const site = (system: string, major: number, minor: number, deposits: string[], beyond = 0) => ({
	systemId: 0,
	system,
	jumps: 0,
	shipyard: 0,
	beyond,
	via: [],
	major,
	minor,
	deposits
});
const effects = {
	d_minerals_3: { district_hab_mining_max_add: 2 },
	d_energy_5: { district_hab_energy_max_add: 3 },
	d_farmland: { district_farming_max_add: 1 } // not a habitat's
};
const none = { researched: [], voidDweller: false };

describe('habitatRow', () => {
	it('sets the district limit from the bodies, as the game does', () => {
		expect(habitatRow(site('Sol', 9, 12, []), none, effects).limit).toBe(8); // 6 + 9/4
		const all = { researched: ['tech_habitat_2', 'tech_habitat_3'], voidDweller: true };
		expect(habitatRow(site('Sol', 9, 12, []), all, effects).limit).toBe(15); // 6 + 27/4 + 12/4
	});
	it('caps its districts from the orbital deposits', () => {
		expect(
			habitatRow(
				site('Sol', 4, 0, ['d_minerals_3', 'd_minerals_3', 'd_energy_5', 'd_farmland']),
				none,
				effects
			).caps
		).toEqual({ district_hab_mining: 4, district_hab_energy: 3 });
	});
	it('filters by range and size and sorts', () => {
		const rows = [
			habitatRow(site('A', 20, 0, [], 0), none, effects), // 11
			habitatRow(site('B', 4, 0, [], 0), none, effects), // 7
			habitatRow(site('C', 40, 0, [], 2), none, effects) // 16
		];
		expect(rows.filter((r) => habitatVisible(r, 0, 10)).map((r) => r.system)).toEqual(['A']);
		expect(rows.filter((r) => habitatVisible(r, null, 10)).map((r) => r.system)).toEqual([
			'A',
			'C'
		]);
		expect(sortHabitats(rows, { column: 'limit', desc: true }).map((r) => r.system)).toEqual([
			'C',
			'A',
			'B'
		]);
	});
});
