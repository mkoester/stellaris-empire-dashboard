import { describe, expect, it } from 'vitest';
import type { BudgetSource, Colony } from './types.ts';
import {
	colonyEfficiency,
	costSources,
	stratumUpkeep,
	unitCosts,
	unitValues
} from './unitCosts.ts';

const jobs = {
	researcher: { name: 'Researcher', category: 'specialist' },
	miner: { name: 'Miner', category: 'worker' }
};
const colony = (planetId: number, name: string, fields: Partial<Colony>) =>
	({
		planetId,
		name,
		designation: 'col_mining',
		colonizing: false,
		jobs: [],
		strata: [],
		produces: {},
		...fields
	}) as unknown as Colony;

// 100 researchers (40 physics, 10 consumer goods in), 200 miners (40 minerals); upkeep per stratum
const budget: BudgetSource[] = [
	{
		source: 'planet_researchers',
		income: { physics_research: 40 },
		expenses: { consumer_goods: 10 }
	},
	{ source: 'planet_miners', income: { minerals: 40 }, expenses: {} },
	{ source: 'pop_category_specialists', income: { trade: 5 }, expenses: { consumer_goods: 20 } },
	{ source: 'pop_category_workers', income: {}, expenses: { food: 20 } },
	{ source: 'orbital_research_deposits', income: { physics_research: 10 }, expenses: {} },
	{ source: 'station_researchers', income: {}, expenses: { energy: 2 } }
];
const colonies = [
	colony(1, 'Earth', {
		jobs: [
			{ type: 'researcher', pops: 100, filled: 100, positions: 100 },
			{ type: 'miner', pops: 100, filled: 100, positions: 100 }
		],
		strata: [
			{ category: 'specialist', size: 100, happiness: 1 },
			{ category: 'worker', size: 100, happiness: 1 }
		],
		produces: { physics_research: 40, minerals: 25 }
	}),
	colony(2, 'Mars', {
		jobs: [{ type: 'miner', pops: 100, filled: 100, positions: 100 }],
		strata: [{ category: 'worker', size: 100, happiness: 1 }],
		produces: { minerals: 15 }
	})
];

describe('costSources and unitValues', () => {
	it('adds what every pop eats to each stratum', () => {
		const eating = [
			...budget,
			{ source: 'planet_pops_traits', income: {}, expenses: { food: 60 } }
		];
		// 60 food for 300 pops (Earth's 200, Mars' 100): 0.2 each on top of the stratum's own
		const u = stratumUpkeep(eating, colonies);
		expect(u.specialist.consumer_goods).toBeCloseTo(0.2);
		expect(u.specialist.food).toBeCloseTo(0.2);
		expect(u.worker.food).toBeCloseTo(0.3);
	});
	it('charges workers their stratum’s upkeep per pop', () => {
		expect(stratumUpkeep(budget, colonies)).toEqual({
			specialist: { consumer_goods: 0.2 },
			worker: { food: 0.1 }
		});
	});
	it('splits a gestalt’s shared drone upkeep over all drone strata', () => {
		const hive = [
			colony(3, 'Yorphia', {
				strata: [
					{ category: 'complex_drone', size: 100, happiness: 1 },
					{ category: 'simple_drone', size: 300, happiness: 1 }
				]
			})
		];
		const drones = [{ source: 'pop_category_drones', income: {}, expenses: { energy: 40 } }];
		expect(stratumUpkeep(drones, hive)).toEqual({
			complex_drone: { energy: 0.1 },
			simple_drone: { energy: 0.1 }
		});
	});
	it('values research at what it costs us, across jobs and stations', () => {
		const sources = costSources(budget, colonies, jobs);
		expect(sources.map((s) => s.id)).toEqual(['job:researcher', 'job:miner', 'station:research']);
		// researchers: 10 + 100 × 0.2 = 30 consumer goods = 60 trade for 40 physics → 1.5
		// stations: 2 energy for 10 physics → 0.2; weighted (40 × 1.5 + 10 × 0.2) / 50 = 1.24
		const values = unitValues(sources);
		expect(values.physics_research).toBeCloseTo(1.24);
		expect(values.minerals).toBe(1); // the market's
		const physics = unitCosts(sources, values).filter((c) => c.resource === 'physics_research');
		expect(physics.map((c) => c.source.id)).toEqual(['job:researcher', 'station:research']);
		expect(physics[0].perUnit).toBeCloseTo(1.5);
		expect(physics[1].perUnit).toBeCloseTo(0.2);
	});
});

describe('colonyEfficiency', () => {
	it('compares a colony’s output with its jobs at the empire’s mean', () => {
		const [earth, mars] = colonyEfficiency(budget, colonies, jobs);
		// miners average 40 / 200 = 0.2 minerals per pop: Earth 25 of 20, Mars 15 of 20
		expect(earth.ratio.minerals).toBeCloseTo(1.25);
		expect(mars.ratio.minerals).toBeCloseTo(0.75);
		expect(earth.ratio.physics_research).toBeCloseTo(1);
	});
});
