import { describe, expect, it } from 'vitest';
import { gameYear, resourceSeries } from './series.ts';
import type { Snapshot } from './types.ts';

const s = (date: string, stockpile: Record<string, number>) => ({ date, stockpile }) as Snapshot;

describe('series', () => {
	it('maps game dates onto a fractional year', () => {
		expect(gameYear('2200.01.01')).toBe(2200);
		expect(gameYear('2203.07.01')).toBe(2203.5);
	});

	it('builds one line per resource seen anywhere, zero where missing', () => {
		const h = [s('2200.01.01', { energy: 1 }), s('2200.02.01', { energy: 2, alloys: 5 })];
		expect(resourceSeries(h, (x) => x.stockpile)).toEqual({
			x: [2200, 2200 + 1 / 12],
			lines: { alloys: [0, 5], energy: [1, 2] }
		});
	});
});
