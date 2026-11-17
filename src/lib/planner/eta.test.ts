import { describe, expect, it } from 'vitest';
import type { Snapshot } from '#lib/types.ts';
import type { CostWorld } from './cost.ts';
import { costRows, eta, formatMonths, incomeRates, parseIncomeWindow } from './eta.ts';

const snap = (date: string, balance: Record<string, number>) => ({ date, balance }) as Snapshot;

describe('incomeRates', () => {
	it("averages each month's last reading over the window, this month's net as now", () => {
		const snaps = [
			snap('2210.01.01', { alloys: 100 }), // outside a 3-month window
			snap('2210.02.01', { alloys: 10 }),
			snap('2210.03.01', { alloys: 99 }), // the month's earlier save
			snap('2210.03.20', { alloys: 20 }),
			snap('2210.04.01', { alloys: 30, energy: 9 })
		];
		expect(incomeRates(snaps, 3)).toEqual({
			now: { alloys: 30, energy: 9 },
			avg: { alloys: 20, energy: 3 },
			months: 3
		});
	});
});

describe('eta', () => {
	it('waits for the slowest resource, short of what is in stock', () => {
		expect(
			eta(
				{ alloys: 1000, influence: 50 },
				{ alloys: 400, influence: 0 },
				{ alloys: 60, influence: 10 },
				{}
			)
		).toEqual({ months: 10, binding: 'alloys', overCap: [] });
	});
	it('never, without income or above storage', () => {
		expect(eta({ unity: 10 }, {}, { unity: -1 }, {}).months).toBeNull();
		expect(eta({ alloys: 20000 }, {}, { alloys: 100 }, { alloys: 15000 })).toEqual({
			months: null,
			binding: 'alloys',
			overCap: ['alloys']
		});
	});
	it('is 0 when everything is in stock', () => {
		expect(eta({ alloys: 10 }, { alloys: 10 }, {}, {})).toEqual({
			months: 0,
			binding: null,
			overCap: []
		});
	});
});

describe('costRows', () => {
	const w = {
		latest: { stockpile: { minerals: 0 }, colonies: [] } as unknown as Snapshot,
		galaxy: null,
		bio: false,
		data: {
			megastructures: {},
			buildDays: { district_mining: 300 },
			costs: { district: { district_mining: { cost: { minerals: 300 } } } }
		}
	} as unknown as CostWorld;
	const goal = (id: string, count: number, queued = true) => ({
		id,
		kind: 'district',
		target: { planet: 1, district: 'district_mining', count },
		queued
	});
	it('times each goal alone and, in plan order, after the queued ones above it', () => {
		const rates = { now: { minerals: 100 }, avg: { minerals: 50 }, months: 6 };
		const rows = costRows([goal('a', 1), goal('skip', 1, false), goal('b', 1)], w, rates, {});
		expect(rows.get('a')).toMatchObject({
			alone: { now: { start: 3, finish: 13 }, avg: { start: 6 } },
			ordered: null
		});
		expect(rows.get('skip')?.ordered).toBeNull();
		expect(rows.get('b')?.ordered).toMatchObject({
			now: { start: 6, finish: 16 },
			avg: { start: 12 }
		});
	});
});

describe('formatMonths and parseIncomeWindow', () => {
	it('rounds up to whole months', () => {
		expect([null, 0, 0.5, 3, 12, 14.2].map(formatMonths)).toEqual([
			'never',
			'now',
			'< 1 m',
			'3 m',
			'1 y',
			'1 y 3 m'
		]);
	});
	it('defaults to six months', () => {
		expect([6, 12, 0, 25, 1.5, undefined].map(parseIncomeWindow)).toEqual([6, 12, 6, 6, 6, 6]);
	});
});
