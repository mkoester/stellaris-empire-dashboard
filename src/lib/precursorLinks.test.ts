import { describe, expect, it } from 'vitest';
import { precursorsOf } from './precursorLinks.ts';

describe('precursorsOf', () => {
	it('names the precursors in a key or its outcome tree', () => {
		expect(precursorsOf('cybrex_1_cat', [{ t: 'event', id: 'precursor.2005' }])).toEqual([
			'Cybrex'
		]);
		// league_1_cat: the First League by its key alone
		expect(precursorsOf('league_1_cat', [])).toEqual(['First League']);
		expect(
			precursorsOf('life_frozen_category', [
				{ t: 'if', c: [{ leaf: 'has_country_flag', value: 'vultaum_intro' }] },
				{ t: 'if', c: [{ leaf: 'has_country_flag', value: 'cybrex_intro' }] }
			])
		).toEqual(['Vultaum', 'Cybrex']);
		expect(precursorsOf('site_debris_belt', [{ t: 'modifier', k: 'ship_graveyard' }])).toEqual([]);
	});
});
