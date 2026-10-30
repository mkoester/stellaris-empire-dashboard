import { describe, expect, it } from 'vitest';
import {
	applies,
	attractionSources,
	changeOf,
	countryFactor,
	groupTargets,
	holdings,
	ruleRows,
	targetOf,
	type AttractionSource
} from './ethicSources.ts';
import type { Facts } from './triggers.ts';
import type { Snapshot } from './types.ts';

// 4.5.2's data DB rows, as `loadGameData()` reads them
const rows = [
	{
		tbl: 'tradition_modifier',
		owner: 'veneration_of_saints',
		modifier: 'pop_ethic_spiritualist_attraction_mult',
		value: 0.25,
		scope: null
	},
	{
		tbl: 'tradition_modifier',
		owner: 'agenda_a_higher_purpose#finish',
		modifier: 'pop_ethic_spiritualist_attraction_mult',
		value: 0.4,
		scope: null
	},
	{
		tbl: 'tradition_modifier',
		owner: 'diplo_stance_isolationist',
		modifier: 'pop_government_ethic_attraction',
		value: 0.25,
		scope: null
	},
	{
		tbl: 'building',
		owner: 'building_temple',
		modifier: 'pop_ethic_spiritualist_attraction_mult',
		value: 0.05,
		scope: 'planet'
	},
	{
		tbl: 'leader',
		owner: 'leader_trait_reformer',
		modifier: 'pop_government_ethic_attraction',
		value: 0.35,
		scope: 'councilor'
	},
	{
		tbl: 'static',
		owner: 'promoted_materialist',
		modifier: 'pop_ethic_materialist_attraction_mult',
		value: 1,
		scope: null
	},
	{
		tbl: 'tradition_modifier',
		owner: 'encourage_free_thought',
		modifier: 'pop_ethics_shift_speed_mult',
		value: 1,
		scope: null
	},
	{
		tbl: 'building',
		owner: 'building_temple',
		modifier: 'planet_stability_add',
		value: 5,
		scope: 'planet'
	}
];
const owners = {
	tradition: [],
	perk: [],
	edict: ['veneration_of_saints', 'encourage_free_thought'],
	agenda: ['agenda_a_higher_purpose'],
	policy: ['diplo_stance_isolationist'],
	origin: []
};

describe('attraction sources', () => {
	it('keeps the attraction modifiers, by whose attraction and what owns them', () => {
		expect(targetOf('pop_ethic_materialist_attraction_mult')).toBe('ethic_materialist');
		expect(targetOf('planet_stability_add')).toBeNull();
		const s = attractionSources(rows, owners);
		expect(s.map((x) => `${x.target} ${x.kind} ${x.key}`)).toEqual([
			'ethic_spiritualist edict veneration_of_saints',
			'ethic_spiritualist agenda agenda_a_higher_purpose#finish',
			'government policy diplo_stance_isolationist',
			'ethic_spiritualist building building_temple',
			'government leader leader_trait_reformer',
			'ethic_materialist static promoted_materialist',
			'shift edict encourage_free_thought'
		]);
	});

	it('says what applies to the nomad game at 2200.02.01', () => {
		const snap = {
			traditions: [],
			ascensionPerks: [],
			edicts: ['veneration_of_saints'],
			policies: { diplomatic_stance: 'diplo_stance_isolationist' },
			government: ['ethic_egalitarian', 'ethic_spiritualist', 'ethic_xenophile'],
			origin: 'origin_nomadic',
			progress: { agenda: null },
			countryModifiers: [{ key: 'agenda_a_higher_purpose', until: '2210.01.01' }],
			colonies: [
				{
					designation: 'col_capital_nomad',
					deposits: [],
					planet: null,
					districtList: [{ zones: [{ buildings: ['building_temple', 'building_temple'] }] }]
				}
			],
			council: [],
			leaderList: [{ traits: ['leader_trait_reformer'], council: false, ruler: false }]
		} as unknown as Snapshot;
		const h = holdings(snap);
		const s = attractionSources(rows, owners);
		expect(s.map((x) => applies(x, h))).toEqual([true, true, true, 1, false, false, false]);
		// a governor's trait: whose planet is not read
		const governor = { ...s[4], scope: 'planet' } as AttractionSource;
		expect(applies(governor, h)).toBeNull();
	});

	it('tells what the player can change and how', () => {
		const s = attractionSources(rows, owners);
		expect(s.map((x) => changeOf(x).how)).toEqual([
			'now',
			'now',
			'now',
			'now',
			'now',
			'now',
			'now'
		]);
		expect(changeOf({ kind: 'static', key: 'cost_of_freedom', scope: null }).how).toBe('no');
		expect(changeOf({ kind: 'tradition', key: 'tr_x', scope: null }).how).toBe('slow');
	});

	it('multiplies the factors known to apply and counts what cannot be told', () => {
		const f = {
			government: ['ethic_pacifist'],
			policyFlags: ['unrestricted_wars']
		} as unknown as Facts;
		const rules = ruleRows(
			[
				{
					kind: 'country',
					description: null,
					factor: 2,
					factorText: null,
					trigger: { leaf: 'has_ethic', value: 'ethic_pacifist' }
				},
				{
					kind: 'country',
					description: null,
					factor: 0.75,
					factorText: null,
					trigger: { leaf: 'has_policy_flag', value: 'unrestricted_wars' }
				},
				{
					kind: 'country',
					description: null,
					factor: 3,
					factorText: null,
					trigger: { leaf: 'has_ethic', value: 'ethic_fanatic_pacifist' }
				},
				{
					kind: 'country',
					description: 'From Council',
					factor: null,
					factorText: 'value:count_councilors_with_ethic',
					trigger: null
				},
				{ kind: 'tag', description: 'reason', factor: null, factorText: null, trigger: null }
			],
			f
		);
		expect(rules.map((r) => r.applies)).toEqual([true, true, false, null, true]);
		expect(countryFactor(rules)).toEqual({ known: 1.5, open: 1 });
	});

	it('lists our ethics first, then the others, the governing ethics and the shift speed', () => {
		const order = [
			'ethic_fanatic_authoritarian',
			'ethic_authoritarian',
			'ethic_egalitarian',
			'ethic_spiritualist',
			'ethic_gestalt_consciousness'
		];
		expect(groupTargets(order, ['ethic_fanatic_spiritualist'])).toEqual([
			'ethic_spiritualist',
			'ethic_authoritarian',
			'ethic_egalitarian',
			'government',
			'shift'
		]);
	});
});
