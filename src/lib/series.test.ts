import { describe, expect, it } from 'vitest';
import { gameYear, popSeries, resourceSeries, xRange } from './series.ts';
import type { Snapshot } from './types.ts';

const s = (date: string, stockpile: Record<string, number>) =>
	({ date, stockpile }) as unknown as Snapshot;

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

describe('series with mod-feed months', () => {
	it('leaves gaps, not zeros, where a source does not report a value', () => {
		const save = { date: '2200.01.01', pops: 10, income: { energy: 3 } } as unknown as Snapshot;
		const log = { date: '2200.02.01', pops: null, income: null } as unknown as Snapshot;
		expect(popSeries([save, log]).lines.pops).toEqual([10, null]);
		expect(resourceSeries([save, log], (x) => x.income).lines.energy).toEqual([3, null]);
	});
});

describe('xRange', () => {
	const at = (date: string) => ({ date }) as Snapshot;

	it('shows the last 20 years and one ahead', () => {
		expect(xRange([at('2200.01.01'), at('2250.07.01')])).toEqual([2230.5, 2251.5]);
	});

	it('never starts before 2200', () => {
		expect(xRange([at('2205.01.01')])).toEqual([2200, 2206]);
		expect(xRange([])).toEqual([2200, 2201]);
	});
});
