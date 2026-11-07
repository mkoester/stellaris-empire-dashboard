import { describe, expect, it } from 'vitest';
import {
	agendaSeries,
	colonyDaySeries,
	colonyPopSeries,
	colonySeries,
	gameMonth,
	gameYear,
	lineStyles,
	monthStarts,
	popCause,
	popSeries,
	researchSeries,
	resourceKeys,
	windowMean,
	unbooked,
	resourcePanelSeries,
	resourceSeries,
	stockpileSeries,
	withoutResearch,
	panWindow,
	spanWindow,
	windowRange,
	xExtent,
	zoomWindow
} from './series.ts';
import type { Colony, Snapshot } from './types.ts';

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

const W = { back: 3, ahead: 2 };

describe('series with mod-feed months', () => {
	it('leaves gaps, not zeros, where a source does not report a value', () => {
		const save = { date: '2200.01.01', pops: 10, income: { energy: 3 } } as unknown as Snapshot;
		const log = { date: '2200.02.01', pops: null, income: null } as unknown as Snapshot;
		expect(
			popSeries(
				[
					{ ...save, colonies: [] },
					{ ...log, colonies: [] }
				],
				W
			).lines.pops
		).toEqual([10, null]);
		expect(resourceSeries([save, log], (x) => x.income).lines.energy).toEqual([3, null]);
	});
});

describe('pops and their monthly change', () => {
	const colony = (planetId: number, pops: number, by: Record<string, number> | null) =>
		({ planetId, pops, growth: by && { net: 0, by, byStratum: {} } }) as unknown as Colony;
	const snap = (date: string, pops: number | null, colonies: Colony[]) =>
		({ date, pops, colonies }) as unknown as Snapshot;
	const history = [
		snap('2201.01.01', 300, [
			colony(1, 200, { growth: 3, emigration: -5, promotion: 0, species: 2 }),
			colony(2, 100, { growth: 1, immigration: 7, colonization: 4 }) // 2 refugees
		]),
		snap('2201.02.01', null, []), // a mod-feed month
		snap('2201.03.01', 320, [colony(1, 205, { growth: 2 }), colony(2, 115, null)])
	];

	it('sums the causes over the colonies, migration between them cancelling out', () => {
		expect(popSeries(history, W).lines).toEqual({
			pops: [300, null, 320],
			'growth /mo (mean)': [3, 3, 3],
			'growth /mo': [4, null, 2],
			'migration /mo (mean)': [1, 1, 1],
			'migration /mo': [2, null, 0],
			'other /mo (mean)': [2, 2, 2],
			'other /mo': [4, null, 0]
		});
	});

	it('follows one colony, a gap where it is not ours; no line for a cause that never moved', () => {
		expect(colonyPopSeries(history, 1, W).lines).toEqual({
			pops: [200, null, 205],
			'growth /mo (mean)': [2.5, null, 2.5],
			'growth /mo': [3, null, 2],
			'migration /mo (mean)': [-2.5, null, -2.5],
			'migration /mo': [-5, null, 0]
		});
		expect(colonyPopSeries(history, 1, W).faint).toEqual(['growth /mo', 'migration /mo']);
	});

	it('reads the game start as no month booked yet, not as 0', () => {
		const start = [
			snap('2200.01.01', 100, [colony(1, 100, {})]),
			snap('2200.02.01', 104, [colony(1, 104, { growth: 4 })]),
			snap('2200.03.01', 110, [colony(1, 110, { growth: 6 })])
		];
		expect(popSeries(start, W).lines).toMatchObject({
			'growth /mo (mean)': [5, 5, 5],
			'growth /mo': [null, 4, 6]
		});
		// later, an empty breakdown is a month in which nothing changed
		const later = start.map((s, i) => ({ ...s, date: `2201.0${i + 1}.01` }));
		expect(popSeries(later, W).lines['growth /mo']).toEqual([0, 4, 6]);
	});

	it('averages the months around each point, a month with several saves counted once', () => {
		const dates = ['2200.02.01', '2200.03.01', '2200.03.20', '2200.04.01', '2200.05.01'];
		const values = [4, 6, 7, null, 5];
		expect(windowMean(values, dates, { back: 1, ahead: 0 })).toEqual([4, 5.5, 5.5, 7, 5]);
		expect(windowMean(values, dates, { back: 0, ahead: 1 })).toEqual([5.5, 7, 7, 5, 5]);
		expect(windowMean(values, dates, { back: 0, ahead: 0 }, (i) => i !== 1)).toEqual([
			4,
			null,
			7,
			null,
			5
		]);
	});

	it('draws a faint line thin and dotted in the colour of the line before it', () => {
		const s = { x: [], lines: { pops: [], 'a mean': [], a: [], b: [] }, faint: ['a'] };
		const color = (_: string, n: number) => ['red', 'blue', 'green'][n];
		expect(lineStyles(s, color, [undefined, [6, 4]])).toEqual([
			{ label: 'pops', stroke: 'red', dash: undefined, faint: false },
			{ label: 'a mean', stroke: 'blue', dash: [6, 4], faint: false },
			{ label: 'a', stroke: 'blue', dash: [1, 3], faint: true },
			{ label: 'b', stroke: 'green', dash: undefined, faint: false }
		]);
	});

	it('leaves out the causes that only regroup pops', () => {
		expect(popCause('promotion')).toBeNull();
		expect(popCause('ethics')).toBeNull();
		expect(popCause('resettle')).toBe('migration');
		expect(popCause('decline')).toBe('other');
	});
});

describe('time window', () => {
	const at = (date: string) => ({ date }) as Snapshot;
	const extent: [number, number] = [2200, 2250.5];

	it('shows the last 20 years and one ahead by default', () => {
		expect(windowRange(xExtent([at('2200.01.01'), at('2250.07.01')]), { years: 20 })).toEqual([
			2230.5, 2251.5
		]);
	});

	it('never starts before 2200', () => {
		expect(windowRange(xExtent([at('2205.01.01')]), { years: 20 })).toEqual([2200, 2206]);
		expect(windowRange(xExtent([]), { years: 20 })).toEqual([2200, 2201]);
		expect(windowRange([2203, 2240], { years: 'all' })).toEqual([2203, 2241]);
	});

	it('pans into the past and follows the latest again at the right edge', () => {
		expect(panWindow({ years: 20 }, extent, -10)).toEqual({ from: 2220.5, to: 2241.5 });
		expect(panWindow({ from: 2220.5, to: 2241.5 }, extent, 10)).toEqual({ years: 20 });
		expect(panWindow({ from: 2220.5, to: 2241.5 }, extent, 50)).toEqual({ years: 20 });
		// stopped at 2200, the width kept
		expect(panWindow({ years: 20 }, extent, -100)).toEqual({ from: 2200, to: 2221 });
	});

	it('zooms around the year under the cursor', () => {
		expect(zoomWindow({ years: 20 }, extent, 0.5, 2251.5)).toEqual({ years: 9.5 });
		expect(zoomWindow({ from: 2210, to: 2220 }, extent, 0.5, 2215)).toEqual({
			from: 2212.5,
			to: 2217.5
		});
		// out past both ends: everything
		expect(zoomWindow({ years: 20 }, extent, 10, 2240)).toEqual({ years: 'all' });
	});

	it('takes a selection either way round, at least a month wide', () => {
		expect(spanWindow(extent, 2230, 2210)).toEqual({ from: 2210, to: 2230 });
		const w = spanWindow(extent, 2210, 2210) as { from: number; to: number };
		expect(w.to - w.from).toBeCloseTo(1 / 12);
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

describe('colonyDaySeries', () => {
	it('adds the days the mod logged a change between the saves', () => {
		const ark = { planetId: -1, name: 'Ark', pops: 5689, employed: 5689, civilians: 0 };
		const day = (pops: number, unemployed: number, openJobs: number) => ({
			Ark: { pops, unemployed, openJobs }
		});
		const h = [
			{ date: '2205.10.01', colonies: [ark] },
			{
				date: '2205.11.01',
				colonies: [{ ...ark, pops: 5701, employed: 5650, civilians: 51 }],
				ticks: [
					{ date: '2205.10.01', stockpile: {}, colonies: day(1, 1, 1) }, // the save's own day
					{ date: '2205.10.12', stockpile: {}, colonies: day(5701, 0, 391) },
					{ date: '2205.10.15', stockpile: {} },
					{ date: '2205.10.20', stockpile: {}, colonies: { Other: day(1, 1, 1).Ark } },
					{ date: '2205.10.21', stockpile: {}, colonies: day(5701, 51, 240) }
				]
			},
			{ date: '2205.12.01', colonies: [] } // a month only the log saw
		] as unknown as Snapshot[];
		const r = colonyDaySeries(h, -1, 'Ark', (c) => ({
			pops: c.pops,
			employed: c.employed,
			civilians: c.civilians,
			open: 7
		}));
		expect(r.x.length).toBe(5);
		expect(r.lines).toEqual({
			pops: [5689, 5701, 5701, 5701, null],
			employed: [5689, 5701, 5650, 5650, null],
			civilians: [0, 0, 51, 51, null],
			'open jobs': [7, 391, 240, 7, null]
		});
	});

	it('draws enslaved pops from the saves alone, only where there are any', () => {
		const col = (pops: number) => ({
			planetId: 1,
			name: 'Hesuk Prime',
			pops,
			employed: 0,
			civilians: 0
		});
		const day = { 'Hesuk Prime': { pops: 4800, unemployed: 0, openJobs: 0 } };
		const h = [
			{ date: '2200.07.01', colonies: [col(4700)] },
			{
				date: '2200.08.01',
				colonies: [col(4738)],
				ticks: [{ date: '2200.07.15', stockpile: {}, colonies: day }]
			}
		] as unknown as Snapshot[];
		const at = (enslaved: number) => (c: Colony) => ({ ...c, open: 0, enslaved });
		expect(colonyDaySeries(h, 1, 'Hesuk Prime', at(1600)).lines['of which enslaved']).toEqual([
			1600,
			null,
			1600
		]);
		expect(colonyDaySeries(h, 1, 'Hesuk Prime', at(0)).lines['of which enslaved']).toBeUndefined();
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
	it("leaves a gap where a tick did not log a resource (a nomad's reserves), not 0", () => {
		// the reserves come from saves only; withReserves drops the tick's energy and minerals
		const jan = {
			date: '2200.01.01',
			stockpile: { operational_reserves: 14000, alloys: 1 },
			ticks: null
		} as unknown as Snapshot;
		const feb = {
			date: '2200.02.01',
			stockpile: { operational_reserves: 14100, alloys: 3 },
			ticks: [{ date: '2200.01.16', stockpile: { alloys: 2 } }]
		} as unknown as Snapshot;
		expect(stockpileSeries([jan, feb]).lines).toEqual({
			alloys: [1, 2, 3],
			operational_reserves: [14000, null, 14100]
		});
	});
});

describe('resourcePanelSeries', () => {
	it('gives the stockpile on every point and the net per month on snapshots only', () => {
		const jan = {
			date: '2200.01.01',
			stockpile: { energy: 1 },
			balance: { energy: 5 },
			ticks: null
		} as unknown as Snapshot;
		const feb = {
			date: '2200.02.01',
			stockpile: { energy: 2 },
			balance: {},
			ticks: [{ date: '2200.01.16', stockpile: {} }]
		} as unknown as Snapshot;
		expect(resourcePanelSeries([jan, feb], 'energy')).toEqual({
			x: [2200, 2200 + 15 / 360, 2200 + 1 / 12],
			lines: { stockpile: [1, null, 2], 'per month': [5, null, 0] }
		});
	});
});

describe('resourceKeys', () => {
	it("lists the strip's resources and any ever held or moved, in the strip's order", () => {
		const h = [
			{ stockpile: { sr_zro: 0, volatile_motes: 3 }, balance: { physics_research: 9 } },
			{ stockpile: {}, balance: { exotic_gases: -1 } }
		] as unknown as Snapshot[];
		expect(resourceKeys(h)).toEqual([
			'energy',
			'minerals',
			'food',
			'consumer_goods',
			'alloys',
			'trade',
			'exotic_gases',
			'volatile_motes',
			'unity',
			'influence'
		]);
	});
});

describe('unbooked', () => {
	const snap = (date: string, energy: number, balance: number, ticks: [string, number][] = []) =>
		({
			date,
			stockpile: { energy },
			balance: { energy: balance },
			ticks: ticks.map(([date, energy]) => ({ date, stockpile: { energy } }))
		}) as unknown as Snapshot;

	it("splits the change since the month's start into the payout and the rest", () => {
		// as 2207.03.10 → 04.01 → 04.02: −26.54 = +3.455 paid on the 1st, −30 else
		const h = [snap('2207.03.10', 4726.33, 34.58), snap('2207.04.01', 4699.79, 3.455)];
		const u = unbooked(h, 'energy')!;
		expect(u.since).toBe('2207.03.10');
		expect(u.booked).toBe(3.455);
		expect(u.actual).toBeCloseTo(-26.54);
		expect(u.days).toHaveLength(1);
		expect(u.days[0].date).toBe('2207.04.01');
		expect(u.days[0].amount).toBeCloseTo(-29.995);
	});

	it("dates the rest by the mod's daily ticks, the payout taken off the day crossing the 1st", () => {
		const h = [
			snap('2207.03.01', 100, 10),
			snap('2207.04.02', 50, 10, [
				['2207.03.15', 100],
				['2207.03.16', 70],
				['2207.04.01', 80]
			])
		];
		expect(unbooked(h, 'energy')!.days).toEqual([
			{ date: '2207.03.16', amount: -30 },
			{ date: '2207.04.02', amount: -30 }
		]);
	});

	it('gives nothing to show when the budget explains it all, and null across a missing month', () => {
		expect(
			unbooked([snap('2207.03.01', 100, 5), snap('2207.04.01', 105, 5)], 'energy')!.days
		).toEqual([]);
		expect(unbooked([snap('2207.02.01', 100, 5), snap('2207.04.01', 110, 5)], 'energy')).toBeNull();
	});
});
