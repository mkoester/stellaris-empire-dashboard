import { describe, expect, it } from 'vitest';
import { activeBuildings, colonyActiveBuildings } from './buildings.ts';

describe('active buildings', () => {
	// the nomad game's arkship at 2201.05.01: its Holo Theatres disabled
	it('takes each disabled one out once', () => {
		const z = {
			type: 'zone_ark_city',
			buildings: ['building_temple', 'building_holo_theatres', 'building_temple'],
			disabled: ['building_temple']
		};
		expect(activeBuildings(z)).toEqual(['building_holo_theatres', 'building_temple']);
		expect(activeBuildings({ type: 'z', buildings: ['building_temple'] })).toEqual([
			'building_temple'
		]);
	});

	it("gathers a colony's working buildings over its zones", () => {
		expect(
			colonyActiveBuildings([
				{
					type: 'district_ark_city',
					built: 3,
					zones: [
						{
							type: 'a',
							buildings: ['building_holo_theatres'],
							disabled: ['building_holo_theatres']
						},
						{ type: 'b', buildings: ['building_commercial_zone'] }
					]
				}
			])
		).toEqual(['building_commercial_zone']);
	});
});
