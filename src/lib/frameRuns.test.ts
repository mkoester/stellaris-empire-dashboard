import { describe, expect, it } from 'vitest';
import { runs } from './frameRuns.ts';

describe('runs', () => {
	it('joins consecutive marked entries into one run', () => {
		expect(runs([false, true, true, false, true, false, true, true, true])).toEqual([
			[1, 2],
			[4, 4],
			[6, 8]
		]);
	});

	it('has none without marks', () => {
		expect(runs([])).toEqual([]);
		expect(runs([false, false])).toEqual([]);
	});
});
