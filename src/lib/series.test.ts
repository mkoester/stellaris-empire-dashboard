import { describe, expect, it } from 'vitest';
import {
	agendaSeries,
	colonySeries,
	gameMonth,
	gameYear,
	monthStarts,
	popSeries,
	researchSeries,
	resourceSeries,
	stockpileSeries,
	withoutResearch,
	xRange
} from './series.ts';
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

describe('researchSeries', () => {
	it('keeps the three research fields of income, gaps where income is unknown', () => {
		const h = [
			{ date: '2200.01.01', income: { energy: 9, physics_research: 14, society_research: 18 } },
			{ date: '2200.02.01', income: null }
		] as unknown as Snapshot[];
		expect(researchSeries(h).lines).toEqual({
			engineering_research: [0, null],
			physics_research: [14, null],
			society_research: [18, null]
		});
	});
});

describe('gameMonth', () => {
	it('labels a fractional year as year.month, robust to float drift', () => {
		expect(gameMonth(2200)).toBe('2200.01');
		expect(gameMonth(gameYear('2203.07.01'))).toBe('2203.07');
		expect(gameMonth(2200 + 11 / 12)).toBe('2200.12');
		expect(gameMonth(2200 + 3 * (1 / 12))).toBe('2200.04');
	});
});

describe('withoutResearch', () => {
	it('drops the research fields and keeps unknown as unknown', () => {
		expect(withoutResearch({ energy: 1, physics_research: 14 })).toEqual({ energy: 1 });
		expect(withoutResearch(null)).toBeNull();
	});
});

describe('colonySeries', () => {
	it('follows one planet, with gaps before colonisation and in mod-feed months', () => {
		const h = [
			{ date: '2200.01.01', colonies: [] },
			{ date: '2200.02.01', colonies: [{ planetId: 7, pops: 100 }] },
			{ date: '2200.03.01', colonies: [] }
		] as unknown as Snapshot[];
		expect(colonySeries(h, 7, { pops: (c) => c.pops }).lines).toEqual({ pops: [null, 100, null] });
	});
});

describe('agendaSeries', () => {
	const a = (date: string, key: string, progress: number) =>
		({ date, progress: { agenda: { key, progress } } }) as unknown as Snapshot;
	// a throwaway game, 2026-10-19: the start agenda done on day one, then Unlock Slot at +42 a
	// month, a manual save on 05.01 and one on 05.02
	const h = [
		a('2200.01.01', 'agenda_infinite_opportunities', 6000),
		a('2200.02.01', 'agenda_unlock_slot', 42),
		a('2200.04.01', 'agenda_unlock_slot', 126),
		a('2200.05.01', 'agenda_unlock_slot', 168),
		a('2200.05.01', 'agenda_unlock_slot', 168),
		a('2200.05.02', 'agenda_unlock_slot', 168)
	];

	it('draws each agenda as its own line', () => {
		const { lines } = agendaSeries(h);
		expect(lines.infinite_opportunities).toEqual([6000, null, null, null, null, null]);
		expect(lines.unlock_slot).toEqual([null, 42, 126, 168, 168, 168]);
	});

	it('measures the gain per month start, none within a month or across agendas', () => {
		expect(agendaSeries(h).lines['per month']).toEqual([null, null, 42, 42, 42, 42]);
	});

	it('counts month starts between dates', () => {
		expect(monthStarts('2200.04.01', '2200.05.02')).toBe(1);
		expect(monthStarts('2200.05.01', '2200.05.02')).toBe(0);
		expect(monthStarts('2200.11.15', '2201.02.01')).toBe(3);
	});
});

describe('stockpileSeries', () => {
	it("adds the mod's daily stockpiles between snapshots, never one at or before the last", () => {
		const jan = {
			date: '2200.01.01',
			stockpile: { energy: 1 },
			ticks: null
		} as unknown as Snapshot;
		const feb = {
			date: '2200.02.01',
			stockpile: { energy: 2, physics_research: 9 },
			ticks: [
				{ date: '2199.12.30', stockpile: { energy: 0 } },
				{ date: '2200.01.16', stockpile: { energy: 7 } },
				{ date: '2200.02.01', stockpile: { energy: 8 } }
			]
		} as unknown as Snapshot;
		expect(stockpileSeries([jan, feb])).toEqual({
			x: [2200, 2200 + 15 / 360, 2200 + 1 / 12],
			lines: { energy: [1, 7, 2] }
		});
	});
});
