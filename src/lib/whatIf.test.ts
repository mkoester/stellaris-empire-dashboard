import { describe, expect, it } from 'vitest';
import { luxuryWhatIf } from './luxuries.ts';
import type { Colony } from './types.ts';
import { wellbeingRules } from './wellbeing.ts';
import {
	colonyFlows,
	designationCandidates,
	edictPrices,
	ownModifiers,
	priced,
	split,
	upkeepOf,
	swapModifiers,
	wellbeingChain,
	whatIf
} from './whatIf.ts';

const rules = wellbeingRules({}, () => undefined);

const colony = (over: Partial<Colony> = {}) =>
	({
		designation: 'col_mining',
		pops: 4000,
		stability: 60,
		amenities: 800,
		amenitiesUsage: 1000,
		approval: 0.5,
		happiness: 0.5,
		planet: { deposits: [], modifiers: [] },
		...over
	}) as Colony;

describe('split', () => {
	it('sends wellbeing keys one way, output keys the other, lists the rest', () => {
		const s = split({
			pop_happiness: 0.05,
			planet_miners_produces_mult: 0.1,
			miner_jobs_bonus_workforce_mult: 0.15,
			country_unity_produces_mult: 0.1,
			country_influence_upkeep_add: 1
		});
		expect(s.push).toEqual({ happiness: 0.05 });
		expect(Object.keys(s.output).sort()).toEqual([
			'country_unity_produces_mult',
			'miner_jobs_bonus_workforce_mult',
			'planet_miners_produces_mult'
		]);
		expect(s.unmodelled).toEqual(['country_influence_upkeep_add']);
	});
});

describe('wellbeingChain', () => {
	it('gives Luxury Goods the same numbers as before', () => {
		const c = colony({ designation: 'col_capital' });
		const jobs = { energy: 100 };
		const lux = luxuryWhatIf(c, jobs, null, false, rules)!;
		const chain = wellbeingChain(
			{ colony: c, jobOutput: jobs, uncapped: null },
			{ amenitiesMult: 0.25 },
			false,
			rules
		)!;
		expect(chain.stability).toBeCloseTo(lux.stability);
		expect(chain.monthly.energy).toBeCloseTo(lux.monthly.energy);
	});

	it('turns +5 % happiness into stability and output', () => {
		const c = wellbeingChain(
			{ colony: colony({ amenities: 1000 }), jobOutput: { minerals: 100 }, uncapped: null },
			{ happiness: 0.1 },
			false,
			rules
		)!;
		// approval 50 → 60 %: +30 × 0.1 / 0.5 = +6 stability; 60 → 66: output +3.6 points of 30 % / 50
		expect(c.stability).toBeCloseTo(6);
		expect(c.output).toBeCloseTo(0.036);
		expect(c.monthly.minerals).toBeCloseTo((100 / 1.06) * 0.036);
	});

	it('adds flat stability as it is, times the colony’s multiplier', () => {
		const c = wellbeingChain(
			{
				colony: colony({ amenities: 1000, stabilityMult: 0.2 }),
				jobOutput: {},
				uncapped: null
			},
			{ stability: 5 },
			false,
			rules
		)!;
		expect(c.stability).toBeCloseTo(6);
	});
});

describe('whatIf', () => {
	it('sums the output share and every colony’s wellbeing gain', () => {
		const w = whatIf(
			{ planet_miners_produces_mult: 0.1, planet_stability_add: 5, edict_upkeep: 1 },
			{ 'job:miner': { minerals: 200 } },
			[{ colony: colony({ amenities: 1000 }), jobOutput: { minerals: 200 }, uncapped: null }],
			false,
			rules
		);
		// 10 % of 200, and stability 60 → 65: +3 % of 200 / 1.06
		expect(w.monthly.minerals).toBeCloseTo(20 + (200 / 1.06) * 0.03);
		expect(w.stability).toBeCloseTo(5);
		expect(w.unmodelled).toEqual(['edict_upkeep']);
	});
});

describe('swapModifiers', () => {
	it('is the new option’s modifiers less the old one’s', () => {
		expect(swapModifiers({ a: 0.1, b: 1 }, { a: 0.1, c: 2 })).toEqual({ b: -1, c: 2 });
		expect(swapModifiers(undefined, { c: 2 })).toEqual({ c: 2 });
	});
});

describe('ownModifiers', () => {
	it('drops what every alternative has at the same value', () => {
		const nomad = { planet_stability_add: 5, pop_bonus_workforce_mult: 0.1 };
		const forge = { planet_stability_add: 5, foundry_jobs_bonus_workforce_mult: 0.15 };
		expect(ownModifiers(nomad, [forge, { planet_stability_add: 5 }])).toEqual({
			pop_bonus_workforce_mult: 0.1
		});
		expect(ownModifiers(nomad, [])).toEqual(nomad);
	});
});

describe('workforce modifiers', () => {
	it('prices every pop’s and a stratum’s extra workforce as output', () => {
		const flows = { jobs: { alloys: 100 }, 'stratum:worker': { minerals: 50 } };
		const w = whatIf(
			{ pop_bonus_workforce_mult: -0.1, worker_and_simple_drone_cat_bonus_workforce_mult: 0.15 },
			flows,
			[],
			false,
			rules
		);
		expect(w.monthly.alloys).toBeCloseTo(-10);
		expect(w.monthly.minerals).toBeCloseTo(7.5);
		expect(w.unmodelled).toEqual([]);
	});
});

describe('designationCandidates', () => {
	const all = [
		'col_city',
		'col_mining',
		'col_hive',
		'col_capital',
		'col_capital_factory',
		'col_capital_hive',
		'col_habitat_mining',
		'col_habitat_research',
		'col_nomad_city',
		'col_capital_nomad',
		'col_capital_nomad_factory',
		'col_pre_ftl_steam',
		'col_nanotech_world'
	];
	it('keeps a colony among its own district set, a capital among capitals', () => {
		expect(designationCandidates('col_mining', all, false)).toEqual(['col_city']);
		expect(designationCandidates('col_habitat_mining', all, false)).toEqual([
			'col_habitat_research'
		]);
		expect(designationCandidates('col_capital', all, false)).toEqual(['col_capital_factory']);
		expect(designationCandidates('col_capital_nomad', all, false)).toEqual([
			'col_capital_nomad_factory'
		]);
	});
	it('offers gestalt designations to gestalts only', () => {
		expect(designationCandidates('col_mining', all, true)).toEqual(['col_hive']);
	});
});

describe('colonyFlows', () => {
	it('groups a colony’s job output by job, stratum and all jobs', () => {
		const f = colonyFlows([
			{ type: 'miner', category: 'worker', flows: { minerals: 12, energy: -1 } },
			{ type: 'artisan', category: 'worker', flows: { consumer_goods: 6, minerals: -6 } }
		]);
		expect(f['job:miner']).toEqual({ minerals: 12 });
		expect(f['stratum:worker']).toEqual({ minerals: 12, consumer_goods: 6 });
		expect(f.jobs).toEqual({ minerals: 12, consumer_goods: 6 });
	});
});

// the 2203.09 save's pop upkeep: `pop_category_*` 1.1175 + 18.03 + 2 consumer goods
const upkeep = {
	flows: {
		pops: { consumer_goods: 21.1475 },
		pops_traits: { food: 42.53, energy: 8.514 },
		jobs: { minerals: 51.3, consumer_goods: 6.669 },
		'job:artisan': { minerals: 51.3 },
		'job:physicist': { consumer_goods: 6.669 },
		edicts: { energy: 30 }
	},
	workforce: { 'job:miner': 300 },
	strata: { specialist: 3606, worker: 1400 }
};

describe('upkeepOf', () => {
	it('scales the pops’ consumer goods upkeep (Recycling Campaign)', () => {
		expect(
			upkeepOf('planet_pops_consumer_goods_upkeep_mult', -0.1, upkeep)!.consumer_goods
		).toBeCloseTo(-2.11475);
	});
	it('takes organic pops’ food from the traits source, all of it for every pop', () => {
		expect(upkeepOf('planet_pops_organics_upkeep_mult', -0.1, upkeep)).toEqual({ food: -4.253 });
		const all = upkeepOf('planet_pops_upkeep_mult', 0.1, upkeep)!;
		expect(all.consumer_goods).toBeCloseTo(2.11475);
		expect(all.energy).toBeCloseTo(0.8514);
	});
	it('scales one job’s upkeep, or every job’s', () => {
		expect(upkeepOf('planet_artisans_upkeep_mult', -0.2, upkeep)).toEqual({ minerals: -10.26 });
		expect(upkeepOf('planet_jobs_upkeep_mult', 0.1, upkeep)!.consumer_goods).toBeCloseTo(0.6669);
	});
	it('adds per 100 workforce of a job and per 100 pops of a stratum', () => {
		expect(upkeepOf('planet_miners_trade_upkeep_add', 1, upkeep)).toEqual({ trade: 3 });
		expect(
			upkeepOf('pop_category_specialists_consumer_goods_upkeep_add', 0.5, upkeep)!.consumer_goods
		).toBeCloseTo(18.03);
	});
	it('reads nothing it has no group for', () => {
		expect(upkeepOf('planet_buildings_clone_vats_upkeep_mult', -0.2, upkeep)).toBeNull();
		expect(upkeepOf('ships_upkeep_mult', -0.1, upkeep)).toBeNull();
		expect(upkeepOf('pop_category_rulers_consumer_goods_upkeep_add', 1, upkeep)).toBeNull();
		expect(upkeepOf('country_influence_upkeep_add', 1, upkeep)).toBeNull();
	});
});

describe('edictPrices', () => {
	const rows: Parameters<typeof edictPrices>[0] = [
		{ key: 'education', active: {}, cost: { upkeep: { energy: 15 } } },
		{ key: 'recycling', active: {}, cost: { upkeep: { energy: 15 } } },
		{ key: 'research', active: null, cost: { cost: { energy: 15 }, upkeep: { energy: 15 } } },
		{ key: 'unity', active: null, cost: { upkeep: { unity: 10 } } }
	];
	it('scales by what the budget books over the active edicts’ base', () => {
		const p = edictPrices(rows, { energy: 33 });
		expect(p.research).toEqual({
			cost: { energy: 16.5 },
			upkeep: { energy: 16.5 },
			measured: true
		});
		expect(p.recycling).toEqual({ cost: {}, upkeep: { energy: -16.5 }, measured: true });
	});
	it('keeps base values where nothing measures the factor', () => {
		expect(edictPrices(rows, { energy: 33 }).unity).toEqual({
			cost: {},
			upkeep: { unity: 10 },
			measured: false
		});
		expect(edictPrices(rows, undefined).research.measured).toBe(false);
	});
});

describe('Recycling Campaign, priced', () => {
	it('sets the consumer goods saved against its 15 energy', () => {
		const w = whatIf(
			{ planet_pops_consumer_goods_upkeep_mult: -0.1 },
			{ jobs: {} },
			[],
			false,
			rules,
			upkeep
		);
		expect(w.modelled).toEqual(['planet_pops_consumer_goods_upkeep_mult']);
		expect(w.unmodelled).toEqual([]);
		const p = priced(
			w,
			{ cost: { energy: 15 }, upkeep: { energy: 15 }, measured: false },
			{
				energy: 1,
				consumer_goods: 2
			}
		);
		expect(p.gained).toBeCloseTo(4.2295);
		expect(p.net).toBeCloseTo(4.2295 - 15);
	});
});
