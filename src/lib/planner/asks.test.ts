import { describe, expect, it } from 'vitest';
import { evaluate, type Trigger } from '#lib/triggers.ts';
import { blockNeeds, techsAsked, withTechs } from './asks.ts';

const tech = (value: string): Trigger => ({ leaf: 'has_technology', value });
const perk = (value: string): Trigger => ({ leaf: 'has_ascension_perk', value });
const facts = (perks: string[], techs: string[] = []) =>
	({
		countryType: 'default',
		government: [],
		origin: null,
		governmentType: null,
		dlcs: null,
		policyFlags: [],
		countryFlags: [],
		traditions: [],
		perks,
		techs,
		atWar: null,
		situations: null,
		nomadic: null
	}) as Parameters<typeof evaluate>[1];

// the shape of 4.6.1 `tr_synthetics_adopt`'s `possible`, shortened
const synthetics: Trigger = {
	op: 'or',
	args: [
		{ op: 'and', args: [perk('ap_synthetic_evolution'), tech('tech_synthetic_workers')] },
		{ op: 'and', args: [perk('ap_synthetic_age'), tech('tech_robomodding_m')] }
	]
};

describe('techsAsked', () => {
	it('takes the branch the empire can meet once it has the techs', () => {
		const machine = (t: Trigger | null) => evaluate(t, facts(['ap_synthetic_age']));
		expect(techsAsked(synthetics, machine)).toEqual(['tech_robomodding_m']);
		const organic = (t: Trigger | null) => evaluate(t, facts(['ap_synthetic_evolution']));
		expect(techsAsked(synthetics, organic)).toEqual(['tech_synthetic_workers']);
	});

	it('counts a planned perk as taken', () => {
		const none = (t: Trigger | null) => evaluate(t, facts([]));
		expect(techsAsked(synthetics, none)).toEqual([]);
		expect(techsAsked(synthetics, none, new Set(['ap_synthetic_age']))).toEqual([
			'tech_robomodding_m'
		]);
	});

	it('asks every tech of an and, none under a not', () => {
		const t: Trigger = {
			op: 'and',
			args: [tech('a'), { op: 'not', args: [tech('b')] }, tech('c')]
		};
		expect(techsAsked(t, () => true)).toEqual(['a', 'c']);
		expect(techsAsked(null, () => true)).toEqual([]);
	});
});

describe('withTechs', () => {
	it('counts asked techs as researched, a forbidden one not', () => {
		const t: Trigger = { op: 'and', args: [tech('a'), { op: 'not', args: [tech('b')] }] };
		expect(evaluate(t, facts([]))).toBe(false);
		expect(evaluate(withTechs(t), facts([]))).toBe(true);
		expect(evaluate(withTechs(t), facts([], ['b']))).toBe(false);
	});
});

describe('blockNeeds', () => {
	const owns = (value: string): Trigger => ({ leaf: 'owns_building', value });
	const civic = (value: string): Trigger => ({ leaf: 'has_valid_civic', value });
	const progress: Trigger = { leaf: 'situation_progress', cmp: '>=', value: '250' };
	const f = (government: string[]) => (t: Trigger | null) =>
		evaluate(t, { ...facts([]), government });
	// 4.6.1 situation_cyberization's two Augmentation Center blocks, shortened
	const center: Trigger = {
		op: 'and',
		args: [
			progress,
			{ op: 'not', args: [civic('civic_augmentation_bazaars')] },
			{ op: 'not', args: [owns('building_augmentation_center')] }
		]
	};
	const bazaar: Trigger = {
		op: 'and',
		args: [
			progress,
			civic('civic_augmentation_bazaars'),
			{
				op: 'not',
				args: [
					{
						op: 'or',
						args: [owns('building_augmentation_center'), owns('building_augmentation_bazaars')]
					}
				]
			}
		]
	};

	it('names the building a block stops without, for the empire it applies to', () => {
		expect(blockNeeds(center, f([]))?.buildings).toEqual(['building_augmentation_center']);
		expect(blockNeeds(bazaar, f([]))).toBeNull();
		expect(blockNeeds(bazaar, f(['civic_augmentation_bazaars']))?.buildings).toEqual([
			'building_augmentation_center',
			'building_augmentation_bazaars'
		]);
		expect(blockNeeds(center, f(['civic_augmentation_bazaars']))).toBeNull();
	});

	it('names a tech and tradition it stops without, and a building it has none of', () => {
		const t: Trigger = {
			op: 'and',
			args: [
				{ leaf: 'current_stage', value: 'stage_2' },
				{ op: 'not', args: [tech('tech_gene_tailoring')] },
				{ op: 'not', args: [{ leaf: 'has_tradition', value: 'tr_x' }] },
				{
					leaf: 'num_buildings',
					building: 'building_chamber_of_silence',
					cmp: '<',
					value: '1'
				} as Trigger
			]
		};
		expect(blockNeeds(t, f([]))).toEqual({
			techs: ['tech_gene_tailoring'],
			traditions: ['tr_x'],
			buildings: ['building_chamber_of_silence']
		});
	});
});
