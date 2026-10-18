import { describe, expect, it } from 'vitest';
import type { BlockerHint } from './blockers.ts';
import { countLabel, designationResources, profile, resourceOf } from './colonyProfile.ts';
import type { PlanetCaps } from './districtCaps.ts';

const mod = (key: string, value: number, positiveIsGood = true) => ({
	key,
	value,
	label: null,
	positiveIsGood
});
const explain = {
	'deposit:d_mineral_rich': {
		title: 'Mineral Rich',
		description: null,
		text: null,
		facts: [],
		modifiers: [mod('district_mining_max_add', 4), mod('planet_jobs_minerals_produces_mult', 0.15)]
	},
	'modifier:unstable_tectonics': {
		title: 'Unstable Tectonics',
		description: null,
		text: null,
		facts: [],
		modifiers: [
			mod('planet_jobs_engineering_research_produces_mult', 0.2),
			mod('pop_happiness', -0.05)
		]
	},
	'modifier:prosperous_unification': {
		title: 'Prosperous Unification',
		description: null,
		text: null,
		facts: [],
		modifiers: [mod('pop_happiness', 0.15)]
	},
	'deposit:d_toxic_kelp': {
		title: 'Toxic Kelp',
		description: null,
		text: null,
		facts: [],
		modifiers: []
	}
};
const caps: PlanetCaps = {
	built: 10,
	limit: 13,
	limitSources: [],
	types: [
		{
			district: 'district_mining',
			built: 4,
			cap: 7,
			sources: [
				{
					from: 'deposit:d_mineral_rich',
					key: 'district_mining_max_add',
					value: 4,
					blocked: false
				},
				{ from: 'building:b_x', key: 'district_mining_max_add', value: 3, blocked: false }
			]
		},
		{ district: 'district_generator', built: 2, cap: 2, sources: [] },
		{ district: 'district_farming', built: 0, cap: 0, sources: [] },
		{ district: 'district_city', built: 4, cap: null, sources: [] }
	]
};
const hint = {
	blocker: 'd_toxic_kelp',
	districts: 1,
	days: 360,
	missing: ['tech_x'],
	lodge: false,
	clearing: false
} as BlockerHint;
const names = { district_mining: 'Mining District', b_x: 'Mine', d_toxic_kelp: 'Toxic Kelp' };
const colony = (designation: string, habitability: number | null = 0.8) => ({
	designation,
	habitability,
	planet: {
		deposits: [
			{ key: 'd_mineral_rich', swap: null },
			{ key: 'd_toxic_kelp', swap: null }
		],
		modifiers: [
			{ key: 'unstable_tectonics', until: null },
			{ key: 'prosperous_unification', until: '2210.01.01' }
		]
	}
});

describe('profile', () => {
	const p = profile({ colony: colony('col_generator'), caps, hints: [hint], explain, names });

	it('lists caps, effects other than caps, free room as pros', () => {
		expect(p.pros.map((t) => t.label)).toEqual([
			'Mining cap 7',
			'generator cap 2',
			'+15% Planet Jobs Minerals Produces',
			'+20% Planet Jobs Engineering Research Produces',
			'+15% Pop Happiness',
			'3 districts free'
		]);
		expect(p.pros[0].detail).toBe('+4 Mineral Rich, +3 Mine');
		expect(p.pros[0].resource).toBe('minerals');
		expect(p.pros[2]).toMatchObject({ detail: 'Mineral Rich', ref: 'deposit:d_mineral_rich' });
	});

	it('marks temporary planet modifiers and counts them apart', () => {
		const temp = p.pros.find((t) => t.ref === 'modifier:prosperous_unification')!;
		expect(temp.until).toBe('2210.01.01');
		expect(p.pros.find((t) => t.ref === 'modifier:unstable_tectonics')!.until).toBeUndefined();
		expect(countLabel(p.pros)).toBe('6 (5+1)');
		expect(countLabel(p.cons)).toBe('3');
	});

	it('lists bad effects, blockers and habitability as cons', () => {
		expect(p.cons.map((t) => t.label)).toEqual([
			'-5% Pop Happiness',
			'Toxic Kelp −1 district',
			'habitability 80%'
		]);
		expect(p.cons[1].detail).toBe('clearing takes 360 days, needs tech x');
	});

	it('ranks what it suits and flags a designation that does not fit', () => {
		expect(p.suits.map((s) => [s.resource, s.score])).toEqual([
			['minerals', 9],
			['energy', 2],
			['engineering_research', 2]
		]);
		expect(p.mismatch).toMatch(/^suits minerals better \(9 vs 2\)/);
		expect(
			profile({ colony: colony('col_mining'), caps, hints: [], explain, names }).mismatch
		).toBeNull();
		// capitals aim at nothing in particular
		expect(
			profile({ colony: colony('col_capital'), caps, hints: [], explain, names }).mismatch
		).toBeNull();
	});

	it('says nothing without caps or habitability', () => {
		const empty = profile({
			colony: { designation: '', habitability: null, planet: null },
			caps: null,
			hints: [],
			explain,
			names
		});
		expect(empty).toEqual({ pros: [], cons: [], suits: [], mismatch: null });
	});
});

describe('resourceOf / designationResources', () => {
	it('reads resources from modifier, job and district words', () => {
		expect(resourceOf('planet_jobs_minerals_produces_mult')).toBe('minerals');
		expect(resourceOf('planet_miners_engineering_research_produces_add')).toBe(
			'engineering_research'
		);
		expect(resourceOf('district_hab_mining')).toBe('minerals');
		expect(resourceOf('district_generator')).toBe('energy');
		expect(resourceOf('pop_happiness')).toBeNull();
		expect(resourceOf('district_city')).toBeNull();
	});
	it('knows what designations aim at', () => {
		expect(designationResources('col_habitat_mining')).toEqual(['minerals']);
		expect(designationResources('col_capital_foundry')).toEqual([]);
		expect(designationResources('col_city')).toEqual([]);
	});
});
