import { describe, expect, it } from 'vitest';
import { categoryChain, jobOutput, outputKind, realGain } from './outputBonuses.ts';

// the physicists' chain (data DB economic_category, 4.5.3)
const parents = {
	planet_physicists: 'planet_researchers',
	planet_researchers: 'planet_jobs_specialist',
	planet_jobs_specialist: 'planet_jobs_productive',
	planet_jobs_productive: 'planet_jobs',
	planet_jobs: 'planets',
	planets: 'country',
	country: null
};
const chain = categoryChain('planet_physicists', parents);

describe('categoryChain', () => {
	it('walks up to the top', () => {
		expect(chain).toEqual([
			'planet_physicists',
			'planet_researchers',
			'planet_jobs_specialist',
			'planet_jobs_productive',
			'planet_jobs',
			'planets',
			'country'
		]);
	});
});

describe('outputKind', () => {
	it('a mult reaches the category and every one below it', () => {
		expect(outputKind('planet_jobs_produces_mult', chain, 'physics_research')).toBe('mult');
		expect(outputKind('country_physics_research_produces_mult', chain, 'physics_research')).toBe(
			'mult'
		);
		expect(
			outputKind('planet_jobs_physics_research_produces_mult', chain, 'physics_research')
		).toBe('mult');
		expect(outputKind('planet_jobs_energy_produces_mult', chain, 'physics_research')).toBeNull();
		expect(outputKind('planet_miners_produces_mult', chain, 'physics_research')).toBeNull();
	});
	it('an add only the category itself', () => {
		expect(
			outputKind('planet_physicists_physics_research_produces_add', chain, 'physics_research')
		).toBe('add');
		expect(
			outputKind('planet_researchers_physics_research_produces_add', chain, 'physics_research')
		).toBeNull();
	});
});

describe('jobOutput', () => {
	// Planetforgers' capital 2214.02: 548 physicists + 54.8 efficiency, Field Dynamics Center +0.25,
	// Devouring Giant +100 %, cadet +50 %
	it('is workforce ÷ 100 × (base + adds) × (1 + mults)', () => {
		const o = jobOutput(
			{ type: 'physicist', filled: 548, bonus: 54.8 },
			'physics_research',
			3,
			chain,
			[
				{
					ref: 'a',
					name: 'lab',
					modifiers: [{ key: 'planet_physicists_physics_research_produces_add', value: 0.25 }]
				},
				{
					ref: 'b',
					name: 'giant',
					modifiers: [{ key: 'planet_jobs_physics_research_produces_mult', value: 1 }]
				},
				{ ref: 'c', name: 'cadet', modifiers: [{ key: 'planet_jobs_produces_mult', value: 0.5 }] }
			]
		);
		expect(o.workforce).toBeCloseTo(602.8);
		expect(o.add).toBe(0.25);
		expect(o.mult).toBe(1.5);
		expect(o.output).toBeCloseTo(6.028 * 3.25 * 2.5);
	});
	it('a species trait counts for its share of the workforce', () => {
		const o = jobOutput(
			{ type: 'physicist', filled: 400, species: { '1': 300, '2': 100 } },
			'physics_research',
			3,
			chain,
			[
				{
					ref: 't',
					name: 'trait',
					species: '2',
					modifiers: [{ key: 'planet_jobs_produces_mult', value: 0.2 }]
				}
			]
		);
		expect(o.mult).toBeCloseTo(0.05);
	});
});

describe('realGain', () => {
	it('shrinks with the pile', () => expect(realGain(0.1, 1)).toBe(0.05));
});
