import { describe, expect, it } from 'vitest';
import { jobRows } from './jobs.ts';

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
