import { describe, expect, it } from 'vitest';
import { jobFlows, jobRows, withFlows } from './jobs.ts';
import type { BudgetSource } from './types.ts';

describe('jobRows', () => {
	const info = {
		farmer: { name: 'Farmer', category: 'worker' },
		foundry: { name: 'Metallurgist', category: 'specialist' },
		civilian: { name: 'Civilian', category: 'civilian' }
	};

	it('sums jobs over colonies and orders them by stratum, then pops', () => {
		const rows = jobRows(
			[
				{ type: 'civilian', pops: 1907, filled: 1906, positions: null },
				{ type: 'farmer', pops: 800, filled: 800, positions: 800 },
				{ type: 'foundry', pops: 150, filled: 150, positions: 150 },
				{ type: 'farmer', pops: 100, filled: 100, positions: 200 },
				{ type: 'unknown_job', pops: 5, filled: 5, positions: 5 }
			],
			info
		);
		expect(rows.map((r) => [r.name, r.pops, r.positions])).toEqual([
			['Metallurgist', 150, 150],
			['Farmer', 900, 1000],
			['Civilian', 1907, null],
			['unknown_job', 5, 5]
		]);
	});
});

describe('jobFlows', () => {
	const info = {
		farmer: { name: 'Farmer', category: 'worker' },
		foundry: { name: 'Metallurgist', category: 'specialist' },
		technician: { name: 'Technician', category: 'worker' },
		primitive_farmer: { name: 'Farmer', category: 'worker' }
	};
	// Sources as in the 2200.05.01 budget.
	const budget: BudgetSource[] = [
		{ source: 'planet_farmers', income: { food: 107.26 }, expenses: {} },
		{ source: 'planet_metallurgists', income: { alloys: 10.16 }, expenses: { minerals: 10.8 } },
		{ source: 'planet_technician', income: { energy: 74.5 }, expenses: {} },
		{ source: 'planet_buildings', income: {}, expenses: { energy: 11 } },
		{ source: 'pop_category_workers', income: { trade: 3.6 }, expenses: {} }
	];

	it('maps planet_<job> sources to job types by key or name, plural or not', () => {
		expect(jobFlows(budget, info)).toEqual({
			farmer: { food: 107.26 },
			foundry: { alloys: 10.16, minerals: -10.8 },
			technician: { energy: 74.5 }
		});
	});

	it('gives a planet its pops share, marked as estimated when partial', () => {
		const rows = jobRows([{ type: 'farmer', pops: 200, filled: 200, positions: 200 }], info);
		const [r] = withFlows(rows, { farmer: { food: 100 } }, { farmer: 800 });
		expect(r.flows).toEqual({ food: 25 });
		expect(r.estimated).toBe(true);
		expect(withFlows(rows, { farmer: { food: 100 } }, { farmer: 200 })[0].estimated).toBe(false);
	});
});
