import { describe, expect, it } from 'vitest';
import { budgetRows, sourceLabel } from './flows.ts';

describe('flows', () => {
	it('labels budget sources readably', () => {
		expect(sourceLabel('planet_farmers')).toBe('farmers');
		expect(sourceLabel('pop_category_workers')).toBe('workers (pops)');
		expect(sourceLabel('planet_districts_mining')).toBe('mining districts');
		expect(sourceLabel('planet_pops_traits')).toBe('pops (food)');
	});

	it('nets each source and adds a total, jobs before pops and buildings', () => {
		const rows = budgetRows([
			{
				source: 'pop_category_workers',
				income: { trade: 3.6 },
				expenses: { consumer_goods: 4.95 }
			},
			{ source: 'planet_buildings', income: {}, expenses: { energy: 11 } },
			{ source: 'planet_artisans', income: { consumer_goods: 47 }, expenses: { minerals: 25 } }
		]);
		expect(rows.map((r) => r.label)).toEqual(['artisans', 'workers (pops)', 'buildings', 'total']);
		expect(rows[0].flows).toEqual({ consumer_goods: 47, minerals: -25 });
		expect(rows[3].flows).toEqual({
			consumer_goods: 42.05,
			minerals: -25,
			trade: 3.6,
			energy: -11
		});
	});
});
