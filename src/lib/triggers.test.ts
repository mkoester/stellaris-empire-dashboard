import { describe as group, expect, it } from 'vitest';
import { describe, evaluate, type Facts, type Trigger } from './triggers.ts';

// Our 2207.03.10 empire: a democracy, not nomadic, with the policy flags the save lists.
const facts: Facts = {
	countryType: 'default',
	government: ['civic_beacon_of_liberty', 'ethic_fanatic_egalitarian', 'auth_democratic'],
	origin: 'origin_default',
	governmentType: 'gov_representative_democracy',
	dlcs: ['Utopia'],
	policyFlags: ['unrestricted_wars', 'diplo_stance_expansionist'],
	countryFlags: [],
	traditions: [],
	perks: [],
	techs: ['tech_lasers_1'],
	atWar: false,
	situations: 0
};

// diplo_stance_belligerent's potential (4.5.2 common/policies/00_policies.txt)
const belligerent: Trigger = {
	op: 'and',
	args: [
		{
			op: 'or',
			args: [
				{ leaf: 'is_country_type', value: 'default' },
				{ leaf: 'is_country_type', value: 'awakened_fallen_empire' }
			]
		},
		{ leaf: 'is_nomadic', value: 'no' }
	]
};

group('evaluate', () => {
	it('answers the leaves the save knows', () => {
		expect(evaluate(belligerent, facts)).toBe(true);
		expect(evaluate({ leaf: 'is_country_type', value: 'fallen_empire' }, facts)).toBe(false);
		expect(evaluate({ leaf: 'has_policy_flag', value: 'unrestricted_wars' }, facts)).toBe(true);
		expect(evaluate({ leaf: 'is_gestalt', value: 'yes' }, facts)).toBe(false);
		expect(evaluate({ leaf: 'is_democratic_authority', value: 'yes' }, facts)).toBe(true);
		expect(evaluate({ leaf: 'is_imperial_authority', value: 'yes' }, facts)).toBe(false);
		// fanatic egalitarian: egalitarian and fanatic egalitarian, not xenophobe
		expect(evaluate({ leaf: 'is_egalitarian', value: 'yes' }, facts)).toBe(true);
		expect(evaluate({ leaf: 'is_fanatic_egalitarian', value: 'yes' }, facts)).toBe(true);
		expect(evaluate({ leaf: 'is_xenophobe', value: 'yes' }, facts)).toBe(false);
		expect(evaluate({ leaf: 'any_situation', value: 'scope' }, facts)).toBe(false);
	});

	it('stays unknown where the save cannot tell, unless the rest decides', () => {
		const rivals: Trigger = { leaf: 'num_rivals', cmp: '>', value: '0' };
		expect(evaluate(rivals, facts)).toBeNull();
		expect(evaluate({ op: 'and', args: [rivals, belligerent] }, facts)).toBeNull();
		expect(
			evaluate({ op: 'and', args: [rivals, { leaf: 'is_gestalt', value: 'yes' }] }, facts)
		).toBe(false);
		expect(evaluate({ op: 'or', args: [rivals, belligerent] }, facts)).toBe(true);
		expect(evaluate({ op: 'not', args: [rivals] }, facts)).toBeNull();
	});

	it('takes no trigger as always true', () => {
		expect(evaluate(null, facts)).toBe(true);
	});
});

group('describe', () => {
	it('reads like the condition', () => {
		expect(
			describe({
				op: 'or',
				args: [
					{ leaf: 'has_policy_flag', value: 'unrestricted_wars' },
					{ leaf: 'has_policy_flag', value: 'liberation_wars' }
				]
			})
		).toBe('policy flag unrestricted wars or policy flag liberation wars');
		expect(describe({ op: 'not', args: [{ leaf: 'is_subject', value: 'yes' }] })).toBe(
			'not subject'
		);
		expect(describe({ leaf: 'num_rivals', cmp: '>', value: '1' })).toBe('num rivals > 1');
	});
});
