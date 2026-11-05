import { describe, expect, it } from 'vitest';
import { appliesTo, classify, pileSum, realGain, researchLines } from './researchBonuses.ts';

describe('classify', () => {
	it('sorts the research modifiers into their piles', () => {
		expect(classify('all_technology_research_speed')).toEqual({
			pile: 'speed',
			scope: { kind: 'all' }
		});
		expect(classify('country_physics_tech_research_speed')?.scope).toEqual({
			kind: 'area',
			area: 'physics'
		});
		expect(classify('category_new_worlds_research_speed_mult')?.scope).toEqual({
			kind: 'category',
			category: 'new_worlds'
		});
		expect(classify('society_tech_cost_mult')?.pile).toBe('cost');
		expect(classify('planet_jobs_engineering_research_produces_mult')).toEqual({
			pile: 'output',
			scope: { kind: 'jobs', area: 'engineering' }
		});
		expect(classify('pop_happiness')).toBeNull();
	});
});

// Planetforgers 2214.02: the six lines that add up to the measured ×1.48 in every area
const sources = [
	{
		ref: 'tradition:tr_discovery_finish',
		name: 'Discovery',
		modifiers: [{ key: 'all_technology_research_speed', value: 0.1 }]
	},
	{
		ref: 'ethic:ethic_fanatic_materialist',
		name: 'Fanatic Materialist',
		modifiers: [{ key: 'all_technology_research_speed', value: 0.1 }]
	},
	{
		ref: 'tech:tech_administrative_ai',
		name: 'Administrative AI',
		modifiers: [{ key: 'all_technology_research_speed', value: 0.05 }]
	},
	{
		ref: 'policy:research_policy_no_focus',
		name: 'General Studies',
		modifiers: [{ key: 'country_society_tech_research_speed', value: 0.1 }]
	},
	{
		ref: 'seat:councilor_research',
		name: 'Head of Research × 4',
		modifiers: [{ key: 'all_technology_research_speed', value: 0.08 }]
	},
	{
		ref: 'seat:councilor_research',
		name: 'Statistician',
		modifiers: [{ key: 'all_technology_research_speed', value: 0.05 }]
	},
	{
		ref: 'policy:research_policy_particles',
		name: 'Particles',
		modifiers: [{ key: 'category_particles_research_speed_mult', value: 0.1 }]
	},
	{
		ref: 'trait:x',
		name: 'conditional',
		modifiers: [
			{ key: 'all_technology_research_speed', value: 1, when: { leaf: 'is_ruler', value: 'yes' } }
		]
	}
];

describe('pileSum', () => {
	const lines = researchLines(sources as never);
	it('adds the lines that apply to the tech: area and field', () => {
		expect(pileSum(lines, 'speed', 'society', { category: 'new_worlds' })).toBeCloseTo(0.48);
		expect(pileSum(lines, 'speed', 'physics', { category: 'particles' })).toBeCloseTo(0.48);
		expect(pileSum(lines, 'speed', 'physics', { category: 'computing' })).toBeCloseTo(0.38);
	});
	it('leaves out conditional modifiers (weighed where they come from)', () => {
		expect(lines.some((l) => l.name === 'conditional')).toBe(false);
	});
	it('counts a source held several times', () => {
		const l = researchLines([
			{
				ref: 'a',
				name: 'a',
				count: 3,
				modifiers: [{ key: 'all_technology_research_speed', value: 0.05 }]
			}
		]);
		expect(l[0].value).toBeCloseTo(0.15);
	});
});

describe('appliesTo', () => {
	it('rare-tech bonuses only on rare techs', () => {
		expect(appliesTo({ kind: 'rare' }, 'physics', { rare: true })).toBe(true);
		expect(appliesTo({ kind: 'rare' }, 'physics', { rare: false })).toBe(false);
	});
});

describe('realGain', () => {
	it('is the bonus over the pile', () => {
		expect(realGain(0.1, 0.48)).toBeCloseTo(0.0676, 4);
		expect(realGain(0.25, 0)).toBe(0.25);
	});
});
