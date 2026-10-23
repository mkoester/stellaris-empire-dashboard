import { describe, expect, it } from 'vitest';
import { grouped, groupOf } from './modifierGroups.ts';

describe('groupOf', () => {
	it('sorts the resolutions’ modifiers by what they act on', () => {
		expect(groupOf('diplo_weight_economy_mult')).toBe('diplomacy');
		expect(groupOf('monthly_loyalty')).toBe('diplomacy');
		expect(groupOf('country_naval_cap_mult')).toBe('fleet');
		expect(groupOf('ships_upkeep_mult')).toBe('fleet');
		expect(groupOf('starbases_upkeep_mult')).toBe('fleet');
		expect(groupOf('gdf_ship_cost_mult')).toBe('fleet');
		expect(groupOf('damage_vs_country_type_swarm_mult')).toBe('fleet');
		expect(groupOf('armies_upkeep_mult')).toBe('army');
		expect(groupOf('army_defense_morale_mult')).toBe('army');
		expect(groupOf('country_war_exhaustion_mult')).toBe('war');
		expect(groupOf('planet_researchers_produces_mult')).toBe('research');
		expect(groupOf('station_researchers_produces_mult')).toBe('research');
		expect(groupOf('planet_jobs_trade_produces_mult')).toBe('production');
		expect(groupOf('planet_pops_consumer_goods_upkeep_mult')).toBe('pops');
		expect(groupOf('pop_environment_tolerance')).toBe('pops');
		expect(groupOf('lithoid_pop_happiness')).toBe('pops');
		expect(groupOf('planet_bureaucrats_upkeep_mult')).toBe('upkeep');
		expect(groupOf('planet_stability_add')).toBe('planets');
		expect(groupOf('empire_size_colonies_mult')).toBe('empire');
		expect(groupOf('something_new')).toBe('other');
	});

	it('lists the groups in order, empty ones left out', () => {
		const g = grouped(
			['pop_happiness', 'diplo_weight_mult', 'x', 'army_collateral_damage_mult'],
			(k) => k
		);
		expect(g.map((x) => [x.group, x.items])).toEqual([
			['diplomacy', ['diplo_weight_mult']],
			['army', ['army_collateral_damage_mult']],
			['pops', ['pop_happiness']],
			['other', ['x']]
		]);
	});
});
