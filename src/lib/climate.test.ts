import { describe, expect, it } from 'vitest';
import { climateOf } from './climate.ts';

const cls = (colonizable: boolean, standard: boolean, climate: string | null, ideal = false) => ({
	name: '',
	colonizable,
	standard,
	climate,
	ideal
});
const classes = {
	pc_arid: cls(true, true, 'dry'),
	pc_ocean: cls(true, true, 'wet'),
	pc_tundra: cls(true, true, 'cold'),
	pc_volcanic: cls(true, true, 'dry'),
	pc_city: cls(true, false, 'dry', true), // dry in the files, a gold icon in game
	pc_gaia: cls(true, false, null, true),
	pc_toxic: cls(false, false, null),
	pc_barren: cls(false, false, null)
};

describe('climateOf', () => {
	it('groups classes as the game colours them', () => {
		expect(Object.keys(classes).map((k) => climateOf(k, classes))).toEqual([
			'dry',
			'wet',
			'cold',
			'volcanic',
			'special',
			'special',
			'toxic',
			'uninhabitable'
		]);
		expect(climateOf('pc_unknown', classes)).toBe('uninhabitable');
	});
});
