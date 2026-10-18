import { describe, expect, it } from 'vitest';
import {
	DEFAULT_EXPANSION_VIEW,
	expansionCounts,
	parseExpansionView,
	rangeChoices,
	visible,
	type ExpansionRow
} from './expansion.ts';

const row = (
	name: string,
	colonizable: boolean,
	candidate: string | null,
	beyond: number | null = 0
) => ({ name, colonizable, candidate, beyond }) as ExpansionRow;

describe('expansion filter', () => {
	const rows = [
		row('Alpha Centauri II', true, null),
		row('Mars', false, 'terraforming_candidate'),
		row('Avishek III', false, 'toxic_terraforming_candidate'),
		row('Mercury', false, null)
	];
	const names = (view: { candidates: boolean; all: boolean }) =>
		rows.filter((p) => visible(p, { ...view, beyond: 0 })).map((p) => p.name);

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

	it('limits the distance beyond the borders', () => {
		const far = [
			row('Mars', true, null, 0),
			row('Xigar', true, null, 2),
			row('Lost', true, null, null)
		];
		const at = (beyond: number | null) =>
			far.filter((p) => visible(p, { candidates: false, all: false, beyond })).map((p) => p.name);
		expect(at(0)).toEqual(['Mars']);
		expect(at(2)).toEqual(['Mars', 'Xigar']);
		expect(at(null)).toEqual(['Mars', 'Xigar', 'Lost']);
		expect(rangeChoices(far)).toEqual([0, 1, 2]);
		expect(rangeChoices([])).toEqual([0]);
	});

	it('reads a stored view', () => {
		expect(parseExpansionView(undefined)).toEqual(DEFAULT_EXPANSION_VIEW);
		expect(parseExpansionView({ beyond: null, all: true })).toEqual({
			candidates: false,
			all: true,
			beyond: null
		});
		expect(parseExpansionView({ beyond: -1 }).beyond).toBe(0);
	});
});
