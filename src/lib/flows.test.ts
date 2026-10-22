import { describe, expect, it } from 'vitest';
import { budgetRows, resourceBudget, sourceLabel } from './flows.ts';

describe('flows', () => {
	it('labels budget sources readably', () => {
		expect(sourceLabel('planet_farmers')).toBe('farmers');
		expect(sourceLabel('pop_category_workers')).toBe('workers (pops)');
		expect(sourceLabel('planet_districts_mining')).toBe('mining districts');
		expect(sourceLabel('planet_pops_traits')).toBe('pops (food)');
		expect(sourceLabel('market:monthly_trades')).toBe('market orders');
		expect(sourceLabel('country_base')).toBe('country base');
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
		expect(rows.map((r) => r.label)).toEqual([
			'artisans',
			'workers (pops)',
			'buildings',
			'total basic',
			'total advanced'
		]);
		expect(rows[0].flows).toEqual({ consumer_goods: 47, minerals: -25 });
		expect(rows[3].flows).toEqual({ minerals: -25, trade: 3.6, energy: -11 });
		expect(rows[4].flows).toEqual({ consumer_goods: 42.05 });
	});
});

describe('resourceBudget', () => {
	it("lists one resource's sources, earners first, and sums them", () => {
		const { rows, total } = resourceBudget(
			[
				{ source: 'ships', income: {}, expenses: { energy: 4, alloys: 1 } },
				{ source: 'planet_technician', income: { energy: 30 }, expenses: {} },
				{ source: 'planet_artisans', income: { consumer_goods: 9 }, expenses: { minerals: 6 } },
				{ source: 'market:monthly_trades', income: { energy: 2 }, expenses: { energy: 10 } }
			],
			'energy'
		);
		expect(rows).toEqual([
			{ label: 'technician', income: 30, expenses: 0, net: 30 },
			{ label: 'ships', income: 0, expenses: 4, net: -4 },
			{ label: 'market orders', income: 2, expenses: 10, net: -8 }
		]);
		expect(total).toEqual({ income: 32, expenses: 14, net: 18 });
	});
});
