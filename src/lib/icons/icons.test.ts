import { describe, expect, it } from 'vitest';
import { ICONS, iconFor } from './icons.ts';

describe('iconFor', () => {
	it.each([
		['district_city', 'city'],
		['district_hive', 'city'],
		['district_generator', 'energy'],
		['district_generator_physics', 'energy'],
		['district_mining_engineering', 'mining'],
		['district_farming_society', 'food'],
		['district_rare_crystals_hive', 'crystal'],
		['district_arcology_fortress', 'army'],
		['district_ring_world_administrative', 'government'],
		['zone_research_physics_hive', 'physics'],
		['zone_research_unity', 'research'],
		['zone_foundry_nexus', 'foundry'],
		['building_capital', 'government'],
		['building_research_lab_1', 'research'],
		['building_biolab_1', 'society'],
		['building_holo_theatres', 'amenity'],
		['building_luxury_residence', 'amenity'],
		['building_crystal_plant', 'crystal'],
		['building_robot_assembly_plant', 'assembly']
	])('%s → %s', (key, icon) => expect(iconFor(key)).toBe(icon));

	it('falls back to the building category, then to the generic icon', () => {
		expect(iconFor('building_modded_thing', 'manufacturing')).toBe('industry');
		expect(iconFor('building_modded_thing', 'unknown')).toBe('generic');
		expect(iconFor('building_modded_thing')).toBe('generic');
	});

	it('takes words, not substrings', () => {
		// "labor" holds "lab", "farmhouse" holds "farm" — neither is a word of the key
		expect(iconFor('building_labor_farmhouse')).toBe('generic');
	});

	it('has paths for every icon', () => {
		for (const paths of Object.values(ICONS)) expect(paths.length).toBeGreaterThan(0);
	});
});
