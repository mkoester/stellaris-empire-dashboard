import { describe, expect, it } from 'vitest';
import type { GalaxySystem, MegaStage, Snapshot } from '#lib/types.ts';
import { goalCost, stageChain, type CostWorld } from './cost.ts';

const stage = (from: string[], cost: MegaStage['cost'] = {}): MegaStage => ({ from, cost });
// 4.5.4 data DB: the Dyson Sphere (stage 2 also from the swarm) and the civilian arkship
const megastructures = {
	dyson_sphere_0: stage([], { any: { unity: 1000 }, regular: { alloys: 5000 } }),
	dyson_sphere_1: stage(['dyson_sphere_0'], { any: { unity: 5000 }, regular: { alloys: 10000 } }),
	dyson_sphere_2: stage(['dyson_sphere_1', 'dyson_swarm_3'], { regular: { alloys: 10000 } }),
	dyson_sphere_ruined: stage([]),
	dyson_sphere_restored: stage(['dyson_sphere_ruined']),
	dyson_swarm_3: stage([]),
	civilian_arkship_megastructure: stage([], {
		any: { influence: 500 },
		regular: { alloys: 10000 },
		bio: { alloys: 5000, food: 17500 }
	})
};
const world = (over: Partial<Snapshot> = {}, galaxy: Partial<GalaxySystem>[] = []): CostWorld => ({
	latest: { ships: [], stations: [], colonies: [], ...over } as unknown as Snapshot,
	galaxy: galaxy as GalaxySystem[],
	bio: false,
	data: {
		megastructures,
		buildDays: { dyson_sphere_0: 1800, dyson_sphere_1: 3600, civilian_arkship_megastructure: 720 },
		costs: {
			district: { district_mining: { cost: { minerals: 300 }, upkeep: {}, produces: {} } },
			ship: {
				starbase_starport: { cost: { alloys: 250 }, upkeep: {}, produces: {} },
				starbase_starhold: { cost: { alloys: 1000 }, upkeep: {}, produces: {} }
			},
			building: {},
			deposit: {},
			module: {},
			starbaseBuilding: {}
		}
	}
});

describe('stageChain', () => {
	it('follows upgrade_from over the numbered stages, ruins and other structures left out', () => {
		expect(stageChain('dyson_sphere', megastructures)).toEqual([
			'dyson_sphere_0',
			'dyson_sphere_1',
			'dyson_sphere_2'
		]);
	});
});

describe('goalCost', () => {
	it('counts the arkships still missing, at the regular or the bio cost', () => {
		const w = world({
			ships: [{ size: 'civilian_arkship_tier_1', count: 1 }]
		} as Partial<Snapshot>);
		expect(goalCost('arkship', { type: 'civilian', count: 3 }, w)).toEqual({
			cost: { influence: 1000, alloys: 20000 },
			days: 1440
		});
		expect(goalCost('arkship', { type: 'civilian', count: 2 }, { ...w, bio: true })?.cost).toEqual({
			influence: 500,
			alloys: 5000,
			food: 17500
		});
		expect(goalCost('arkship', { type: 'civilian', count: 1 }, w)).toBeNull();
	});

	it('sums the stages after the one built, a stage without build days making them unknown', () => {
		const w = world({}, [{ id: 7, megastructures: ['dyson_sphere_0'] }]);
		expect(goalCost('megastructure', { system: 7, structure: 'dyson_sphere' }, w)).toEqual({
			cost: { unity: 5000, alloys: 20000 },
			days: null
		});
	});

	it('upgrades a starbase level by level and builds the districts still missing', () => {
		const w = world({
			stations: [{ systemId: 3, level: 'outpost' }],
			colonies: [{ planetId: 9, districtList: [{ type: 'district_mining', built: 1 }] }]
		} as unknown as Partial<Snapshot>);
		expect(goalCost('station_level', { system: 3, level: 'starhold' }, w)?.cost).toEqual({
			alloys: 1250
		});
		expect(
			goalCost('district', { planet: 9, district: 'district_mining', count: 3 }, w)?.cost
		).toEqual({ minerals: 600 });
	});

	it('has no cost for an unknown key or a kind without one', () => {
		expect(goalCost('building', { building: 'building_x' }, world())).toBeNull();
		expect(goalCost('tech', { tech: 'tech_x' }, world())).toBeNull();
	});
});
