import { describe, expect, it } from 'vitest';
import { layoutRows } from './colonyLayout.ts';
import type { ColonyDistrict } from './types.ts';

const d = (type: string, built: number, zones: string[] = []): ColonyDistrict => ({
	type,
	built,
	zones: zones.map((z) => ({ type: z, buildings: [] }))
});

describe('layoutRows', () => {
	it('splits the city district’s zones and fills in the special districts from the caps', () => {
		const rows = layoutRows(
			[
				d('district_generator', 3),
				d('district_city', 3, ['zone_government', 'zone_urban', 'zone_industrial']),
				d('district_mining', 2)
			],
			{
				district_city: null,
				district_generator: 8,
				district_mining: 7,
				district_farming: 8
			}
		);
		expect(rows.city?.type).toBe('district_city');
		expect(rows.city?.zones.map((z) => z.type)).toEqual(['zone_government']);
		expect(rows.cityZones.map((z) => z.type)).toEqual(['zone_urban', 'zone_industrial']);
		expect(rows.special.map((s) => [s.type, s.built])).toEqual([
			['district_generator', 3],
			['district_mining', 2],
			['district_farming', 0]
		]);
	});

	it('finds a hive’s city district by its name', () => {
		const rows = layoutRows([d('district_hive_energy', 1), d('district_hive', 2, ['z'])], {});
		expect(rows.city?.type).toBe('district_hive');
		expect(rows.special.map((s) => s.type)).toEqual(['district_hive_energy']);
	});

	it('falls back to the uncapped district, else no city', () => {
		const modded = layoutRows([d('district_modded_core', 1), d('district_mining', 1)], {
			district_modded_core: null,
			district_mining: 5
		});
		expect(modded.city?.type).toBe('district_modded_core');
		expect(layoutRows([d('district_mining', 1)], { district_mining: 5 }).city).toBeNull();
	});
});
