import { describe, expect, it } from 'vitest';
import { districtCaps } from './districtCaps.ts';

// Earth at 2207.03.10: its deposits and their modifiers as in the data DB (4.5.2); the game
// showed farming 8, generator 8, mining 7.
const effects = {
	'deposit:d_mesopotamian_urban_corridor': [{ key: 'district_mining_max_add', value: 3 }],
	'deposit:d_boswash_metropolitan_axis': [{ key: 'district_generator_max_add', value: 3 }],
	'deposit:d_mauritanian_security_zone': [{ key: 'district_mining_max_add', value: 1 }],
	'deposit:d_great_albertan_crater': [{ key: 'district_mining_max_add', value: 3 }],
	'deposit:d_scandinavian_reclamation_sector': [{ key: 'district_farming_max_add', value: 1 }],
	'deposit:d_saharan_irrigation_project': [{ key: 'district_farming_max_add', value: 4 }],
	'deposit:d_pearl_river_agglomerate': [{ key: 'district_generator_max_add', value: 3 }],
	'deposit:d_great_pacific_garbage_patch': [{ key: 'planet_max_districts_add', value: -1 }],
	'deposit:d_pacific_algae_tracts': [{ key: 'district_farming_max_add', value: 3 }],
	'deposit:d_failing_infrastructure_earth': [{ key: 'planet_max_districts_add', value: -1 }],
	'deposit:d_delhi_sprawl': [{ key: 'district_generator_max_add', value: 2 }],
	'modifier:tidal_locked': [
		{ key: 'planet_max_districts_mult', value: -0.3 },
		{ key: 'district_farming_max_add', value: -3 }
	],
	'building:building_farming_districts_1': [{ key: 'district_farming_max_add', value: 2 }]
};
const d = (key: string, swap: string | null = null) => ({ key, swap });
const earth = {
	size: 18,
	habitat: false,
	buildings: ['building_capital'],
	modifiers: [{ key: 'prosp_uni_mod', until: '2219.11.01' }],
	deposits: [
		d('d_mesopotamian_urban_corridor'),
		d('d_boswash_metropolitan_axis'),
		d('d_mauritanian_security_zone'),
		d('d_great_albertan_crater'),
		d('d_scandinavian_reclamation_sector'),
		d('d_saharan_irrigation_project'),
		d('d_pearl_river_agglomerate'),
		d('d_great_pacific_garbage_patch', 'd_pacific_algae_tracts'),
		d('d_failing_infrastructure_earth', 'd_delhi_sprawl')
	]
};
const built = { district_city: 7, district_generator: 3, district_mining: 2, district_farming: 4 };

describe('districtCaps', () => {
	it("reproduces the game's caps for Earth, blocked features included", () => {
		const c = districtCaps(earth, built, effects);
		expect(c.types.map((t) => [t.district, t.built, t.cap])).toEqual([
			['district_city', 7, null],
			['district_farming', 4, 8],
			['district_generator', 3, 8],
			['district_mining', 2, 7]
		]);
		expect(c.types[1].sources.find((s) => s.blocked)).toMatchObject({
			from: 'deposit:d_pacific_algae_tracts',
			value: 3
		});
		// size 18, two blockers
		expect([c.built, c.limit]).toEqual([16, 16]);
	});

	it('tells what clearing the blockers adds', () => {
		const c = districtCaps(earth, built, effects, [
			'd_great_pacific_garbage_patch',
			'd_failing_infrastructure_earth'
		]);
		expect(c.types.map((t) => [t.district, t.blocked])).toEqual([
			['district_city', 0],
			['district_farming', 3], // Pacific Algae Tracts
			['district_generator', 2], // Delhi Sprawl
			['district_mining', 0]
		]);
		expect([c.limit, c.limitCleared]).toEqual([16, 18]);
	});

	it('applies multipliers, rounds down, and counts each building', () => {
		const c = districtCaps(
			{
				...earth,
				modifiers: [{ key: 'tidal_locked', until: null }],
				buildings: ['building_farming_districts_1', 'building_farming_districts_1']
			},
			built,
			effects
		);
		expect(c.types.find((t) => t.district === 'district_farming')?.cap).toBe(9); // 8 − 3 + 2 × 2
		expect(c.limit).toBe(11); // (18 − 2) × 0.7 = 11.2
	});

	it('leaves the limit open for habitats', () => {
		expect(districtCaps({ ...earth, habitat: true }, {}, effects).limit).toBeNull();
	});

	it("adds the empire's civics and traditions (Embron 2212.06.01: the game's 25)", () => {
		const fx = {
			'civic:civic_world_forgers': [{ key: 'pc_volcanic_max_districts_add', value: 3 }],
			'tradition:tr_expansion_finish': [
				{ key: 'planet_non_artificial_max_districts_add', value: 1 },
				{ key: 'habitat_max_districts_add', value: 1 }
			],
			'tradition:tr_adaptability_adaptive_ecology': [
				{ key: 'planet_non_artificial_max_districts_add', value: 1 }
			]
		};
		const owners = Object.keys(fx);
		const planet = (planetClass: string, size: number) => ({
			size,
			habitat: false,
			planetClass,
			buildings: [],
			modifiers: [],
			deposits: []
		});
		expect(districtCaps(planet('pc_volcanic', 20), {}, fx, [], owners).limit).toBe(25);
		expect(districtCaps(planet('pc_arid', 12), {}, fx, [], owners).limit).toBe(14); // Caugantu
		expect(districtCaps(planet('pc_volcanic', 20), {}, fx).limit).toBe(20);
	});
});
