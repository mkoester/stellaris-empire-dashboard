import { describe, expect, it } from 'vitest';
import type { Explanation, Modifier } from './types.ts';
import { raises, wellbeingLevers, type Held } from './wellbeingLevers.ts';

const mod = (key: string, value: number): Modifier => ({
	key,
	value,
	label: null,
	positiveIsGood: true
});
const ex = (...modifiers: Modifier[]): Explanation => ({
	title: 't',
	description: null,
	modifiers,
	text: null,
	facts: []
});
const held = (local: Record<string, string[]>, empire: Record<string, string[]>): Held => {
	const maps = (o: Record<string, string[]>) =>
		Object.fromEntries(Object.entries(o).map(([k, v]) => [k, new Map(v.map((x) => [x, 1]))]));
	return { local: maps(local), empire: maps(empire) };
};

describe('wellbeing levers', () => {
	it('knows which modifiers raise happiness or amenities', () => {
		expect(raises(mod('pop_happiness', 0.15), false)).toBe('happiness');
		expect(raises(mod('pop_cat_worker_happiness', 0.1), false)).toBe('happiness');
		expect(raises(mod('pop_happiness', -0.2), false)).toBeNull();
		expect(raises(mod('planet_amenities_add', 1000), false)).toBe('amenities');
		expect(raises(mod('planet_amenities_mult', 0.25), false)).toBe('amenities');
		// a cut in the need raises the ratio; giving it up lowers it
		expect(raises(mod('pop_amenities_usage_mult', -0.1), false)).toBe('amenities');
		expect(raises(mod('pop_amenities_usage_mult', 0.1), false)).toBeNull();
		expect(raises(mod('planet_crime_no_happiness_add', 5), false)).toBeNull();
		// a gestalt has no happiness, its amenities are the no_happiness ones
		expect(raises(mod('pop_happiness', 0.15), true)).toBeNull();
		expect(raises(mod('planet_amenities_add', 1000), true)).toBeNull();
		expect(raises(mod('planet_amenities_no_happiness_add', 1000), true)).toBe('amenities');
	});

	it('lists the sources that hold, with their other modifiers as side effects', () => {
		const explanations = {
			'building:building_capital': ex(
				mod('planet_amenities_add', 1000),
				mod('planet_housing_add', 500)
			),
			'modifier:prosp_uni_mod': ex(mod('planet_amenities_mult', 0.25), mod('pop_happiness', 0.15)),
			'edict:encourage_free_thought': ex(mod('pop_happiness', 0.05)),
			'edict:not_enacted': ex(mod('pop_happiness', 0.1)),
			'tradition:tr_x': ex(mod('pop_happiness', 0.05)),
			'right:slavery_indentured': ex(mod('pop_happiness', -0.2))
		};
		const l = wellbeingLevers(
			explanations,
			held(
				{ building: ['building_capital'], modifier: ['prosp_uni_mod'] },
				{ edict: ['encourage_free_thought'], tradition: ['tr_x'], right: ['slavery_indentured'] }
			),
			false
		);
		// changeable now first, local before empire-wide; fixed last
		expect(l.happiness.map((x) => x.ref)).toEqual([
			'edict:encourage_free_thought',
			'modifier:prosp_uni_mod',
			'tradition:tr_x'
		]);
		expect(l.amenities.map((x) => x.ref)).toEqual([
			'building:building_capital',
			'modifier:prosp_uni_mod'
		]);
		const capital = l.amenities[0];
		// the capital's building goes only with the capital
		expect(capital).toMatchObject({ local: true, how: 'no', count: 1 });
		expect(capital.side.map((m) => m.key)).toEqual(['planet_housing_add']);
		// the timed modifier raises both: each list names the other as a side effect
		expect(l.happiness[1].side.map((m) => m.key)).toEqual(['planet_amenities_mult']);
	});
});
