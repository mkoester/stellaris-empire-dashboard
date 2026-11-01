import { describe, expect, it } from 'vitest';
import { isLeaderModifier, leaderGroup, leaderSources } from './leaderSources.ts';
import type { Facts } from './triggers.ts';
import type { Explanation, Modifier } from './types.ts';

const flag = (value: string) => ({ leaf: 'has_country_flag', value }) as never;

const mod = (key: string, value: number, s: Partial<Modifier> = {}): Modifier => ({
	key,
	value,
	label: null,
	positiveIsGood: true,
	...s
});
const ex = (title: string, modifiers: Modifier[]): Explanation => ({
	title,
	description: null,
	modifiers,
	text: null,
	facts: []
});

// every leader modifier key the 4.5.3 data DB's modifier tables hold (2026-10-31)
const KEYS_453 = [
	'envoys_add',
	'councilor_gestalt_growth_exp_gain',
	'species_leader_exp_gain',
	'leaders_upkeep_mult',
	'leader_lifespan_add',
	'councilor_skill_add',
	'country_commander_cap_add',
	'external_leader_pool_add',
	'country_official_cap_add',
	'leader_lifespan_mult',
	'country_scientist_cap_add',
	'envoy_improve_relations_mult',
	'councilor_exp_gain',
	'country_leader_pool_size',
	'leaders_cost_mult',
	'leader_trait_selection_options_add',
	'leader_initial_skill',
	'leader_commanders_upkeep_mult',
	'envoy_harm_relations_mult',
	'country_leader_cap_add',
	'leader_skill_add',
	'leader_organic_lifespan_mult',
	'leader_initial_traits_add',
	'country_councilor_physics_research_produces_add',
	'councilor_research_exp_gain'
];

describe('isLeaderModifier', () => {
	it("takes the data DB's leader keys and nothing else", () => {
		expect(KEYS_453.filter((k) => !isLeaderModifier(k))).toEqual([]);
		for (const k of ['pop_happiness', 'country_unity_produces_mult', 'planet_amenities_add'])
			expect(isLeaderModifier(k)).toBe(false);
	});

	it('groups experience first', () => {
		expect(leaderGroup('species_leader_exp_gain')).toBe('experience');
		expect(leaderGroup('councilor_research_exp_gain')).toBe('experience');
		expect(leaderGroup('leader_lifespan_add')).toBe('lifespan');
		expect(leaderGroup('country_official_cap_add')).toBe('limits and pool');
		expect(leaderGroup('leaders_upkeep_mult')).toBe('upkeep and cost');
		expect(leaderGroup('envoys_add')).toBe('envoys');
	});
});

describe('leaderSources', () => {
	const explanations = {
		'tradition:tr_discovery_adopt': ex('Discovery', [
			mod('species_leader_exp_gain', 0.1),
			mod('country_unity_produces_mult', 0.1)
		]),
		'tech:tech_x': ex('X', [mod('species_leader_exp_gain', 0.15)]),
		'perk:ap_not_taken': ex('Not taken', [mod('species_leader_exp_gain', 0.5)]),
		'civic:civic_y': ex('Y', [mod('leaders_upkeep_mult', -0.1, { positiveIsGood: false })]),
		// ap_wanderlust: −10 % upkeep, and −10 % more once a Wanderlust category is completed
		'perk:ap_wanderlust': ex('Wanderlust', [
			mod('leaders_upkeep_mult', -0.1, { positiveIsGood: false }),
			mod('leaders_upkeep_mult', -0.1, { positiveIsGood: false, when: flag('enclave_completed') })
		]),
		'trait:trait_z': ex('Z', [
			mod('leader_lifespan_add', 20, { when: { leaf: 'num_rivals', value: '1' } as never })
		])
	};
	const held = {
		tradition: new Map([['tr_discovery_adopt', 1]]),
		tech: new Map([['tech_x', 1]]),
		civic: new Map([['civic_y', 1]]),
		perk: new Map([['ap_wanderlust', 1]]),
		trait: new Map([['trait_z', 1]])
	};
	const upkeep = (flags: string[]) =>
		leaderSources(explanations, held, { countryFlags: flags } as unknown as Facts).find(
			(r) => r.mod.key === 'leaders_upkeep_mult'
		);
	const round = (n: number | undefined) => Math.round((n ?? 0) * 100) / 100;

	it('weighs a triggered modifier: counted if it holds, left out if not', () => {
		expect(round(upkeep([])?.mod.value)).toBe(-0.2);
		expect(upkeep([])?.sources.map((x) => [x.ref, x.holds])).toEqual([
			['civic:civic_y', true],
			['perk:ap_wanderlust', true]
		]);
		expect(round(upkeep(['enclave_completed'])?.mod.value)).toBe(-0.3);
		// without facts: shown as unknown, out of the total
		const unsure = leaderSources(explanations, held).find(
			(r) => r.mod.key === 'leaders_upkeep_mult'
		);
		expect(round(unsure?.mod.value)).toBe(-0.2);
		expect(unsure?.sources.map((x) => x.holds)).toEqual([true, true, null]);
	});

	it('sums what the empire holds per leader modifier, experience first', () => {
		const rows = leaderSources(explanations, { ...held, perk: new Map(), trait: new Map() });
		expect(rows.map((r) => [r.group, r.mod.key, Math.round(r.mod.value * 100) / 100])).toEqual([
			['experience', 'species_leader_exp_gain', 0.25],
			['upkeep and cost', 'leaders_upkeep_mult', -0.1]
		]);
		// not held (the perk), not on leaders (unity): left out
		expect(rows[0].sources.map((s) => s.ref)).toEqual([
			'tradition:tr_discovery_adopt',
			'tech:tech_x'
		]);
		expect(rows[1].mod.positiveIsGood).toBe(false);
	});

	it('is empty when nothing held acts on leaders', () => {
		expect(leaderSources(explanations, {})).toEqual([]);
	});
});
