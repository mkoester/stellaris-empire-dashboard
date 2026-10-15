import { describe, expect, it } from 'vitest';
import { expansionCounts, visible, type ExpansionRow } from './expansion.ts';

const row = (name: string, colonizable: boolean, candidate: string | null) =>
	({ name, colonizable, candidate }) as ExpansionRow;

describe('expansion filter', () => {
	const rows = [
		row('Alpha Centauri II', true, null),
		row('Mars', false, 'terraforming_candidate'),
		row('Avishek III', false, 'toxic_terraforming_candidate'),
		row('Mercury', false, null)
	];
	const names = (view: { candidates: boolean; all: boolean }) =>
		rows.filter((p) => visible(p, view)).map((p) => p.name);

	it('shows colonizable classes by default, candidates and the rest behind toggles', () => {
		expect(names({ candidates: false, all: false })).toEqual(['Alpha Centauri II']);
		expect(names({ candidates: true, all: false })).toEqual([
			'Alpha Centauri II',
			'Mars',
			'Avishek III'
		]);
		expect(names({ candidates: false, all: true })).toHaveLength(4);
		expect(expansionCounts(rows)).toEqual({ candidates: 2, rest: 1 });
	});
});
