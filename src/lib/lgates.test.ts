import { describe, expect, it } from 'vitest';
import { lgateRelated } from './lgates.ts';

describe('lgateRelated', () => {
	it('tells by the name, or by anything in the tree', () => {
		expect(lgateRelated('L-Gate Insight', null)).toBe(true); // AIANOM_CLUE_CAT
		expect(lgateRelated('Activate L-Gate', null)).toBe(true); // LCLUSTER_PROJECT
		// GEN_OLD_WAR_CAT: 3 in 10, the L-Gate Insights event and its tech option
		const tree = [
			{ t: 'modifier', k: 'ship_graveyard', name: 'Starship Graveyard' },
			{
				t: 'random',
				b: [{ w: 3, e: [{ t: 'event', id: 'distar.9000', title: 'L-Gate Insights', e: [] }] }]
			}
		];
		expect(lgateRelated('Old War', tree)).toBe(true);
		expect(lgateRelated('Old War', [{ t: 'option', k: 'tech_lgate_activation' }])).toBe(true);
		expect(lgateRelated('Old War', [{ t: 'modifier', k: 'ship_graveyard' }])).toBe(false);
		// behind its spoiler: no tree, the name alone
		expect(lgateRelated('Old War', null)).toBe(false);
	});
});
