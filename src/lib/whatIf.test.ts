import { describe, expect, it } from 'vitest';
import { luxuryWhatIf } from './luxuries.ts';
import type { Colony } from './types.ts';
import { wellbeingRules } from './wellbeing.ts';
import {
	colonyFlows,
	designationCandidates,
	split,
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
