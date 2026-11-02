import { describe, expect, it } from 'vitest';
import {
	feeMult,
	fitCheck,
	isCapital,
	perWorker,
	localAlternatives,
	logisticsFee,
	shortfall
} from './colonyLogistics.ts';
import type { ProduceRow } from './produce.ts';

describe('shortfall', () => {
	it('keeps what upkeep exceeds output by', () => {
		expect(
			shortfall({ upkeep: { energy: 2, alloys: 1, food: 3 }, produces: { food: 4, alloys: 0.5 } })
		).toEqual({ energy: 2, alloys: 0.5 });
	});
});

describe('logisticsFee', () => {
	// AI empires' booked `planet_resource_deficit`, autosave 2210.01.01 (2026-11-02)
	it.each([
		[{ energy: 2, alloys: 1 }, 0.75],
		[{ consumer_goods: 2, alloys: 6 }, 3.5],
		[{ energy: 0.08, minerals: 2.24, food: 6.2 }, 1.065],
		[{ energy: 9, minerals: 8 }, 2.125],
		[{ minerals: 1.21 }, 0.151]
	])('%o costs %d trade', (short, booked) => {
		expect(logisticsFee(short).total).toBeCloseTo(booked, 3);
	});

	it('scales with the galaxy setting and lists what has no price', () => {
		const f = logisticsFee({ energy: 8, unity: 3 }, {}, 2);
		expect(f.total).toBe(2);
		expect(f.unpriced).toEqual(['unity']);
	});
});

describe('the data DB’s rates and the capital', () => {
	it('takes the rate from the data DB over the fallback', () => {
		expect(logisticsFee({ minor_artifacts: 2 }, { minor_artifacts: 0.5 }).total).toBe(1);
		expect(logisticsFee({ minor_artifacts: 2 }).unpriced).toEqual(['minor_artifacts']);
	});

	// UNE 2202.08.01: booked 12.183; the rule gives 12.714 (the colony tables are the month's)
	it('covers the capital’s shortfall with country_base first', () => {
		const base = { energy: 20, minerals: 20, food: 20, consumer_goods: 15 };
		const earth = shortfall(
			{
				upkeep: { minerals: 36, consumer_goods: 75.589 },
				produces: { minerals: 33.50054, consumer_goods: 47.96668 }
			},
			base
		);
		expect(earth).toEqual({ consumer_goods: expect.closeTo(12.62232, 4) });
		const others = logisticsFee({ food: 2, consumer_goods: 2.1 + 30.95, minerals: 8.37 }).total;
		expect(logisticsFee(earth).total + others).toBeCloseTo(12.714, 2);
	});
	it('knows the capital by its designation', () => {
		expect(isCapital({ designation: 'col_capital_nomad' })).toBe(true);
		expect(isCapital({ designation: 'col_mining' })).toBe(false);
	});
});

describe('feeMult', () => {
	it('reads the setting, 1 without it', () => {
		expect(feeMult({ logistics_planet_deficit_costs: 0.5 })).toBe(0.5);
		expect(feeMult(null)).toBe(1);
	});
});

describe('fitCheck', () => {
	it('compares the model with the booked fee', () => {
		expect(fitCheck([0.5, 0.25], 0.75).off).toBe(0);
		expect(fitCheck([1], 0.8).off).toBeCloseTo(0.25);
		expect(fitCheck([], null).off).toBeNull();
		expect(fitCheck([], 0).off).toBe(0);
	});
});

describe('localAlternatives', () => {
	const row = (perUnit: number, gain: number, count: number, pops: number) =>
		({ perUnit, gain, option: { label: 'Generator District', count, pops } }) as ProduceRow;

	it('imports when making it here costs more than elsewhere plus the fee', () => {
		const [a] = localAlternatives(
			{ energy: 10 },
			{ energy: 0.5 },
			{ energy: [row(0.9, 4, 3, 300)] }
		);
		expect(a.importing).toBeCloseTo(0.625);
		expect(a.best).toMatchObject({ needed: 3, room: 3, workers: 900 });
		expect(a.verdict).toBe('import');
	});

	it('makes it here when that is cheaper, none without an option', () => {
		const [a, b] = localAlternatives(
			{ energy: 2, alloys: 1 },
			{},
			{ energy: [row(0.4, 4, 1, 100)] }
		);
		expect(a.verdict).toBe('local');
		expect(b.verdict).toBe('none');
		expect(b.importing).toBe(4.5);
	});

	it('prices the workers moved off their jobs, the idle first', () => {
		// 1 district of 4 energy, 100 workers; 40 idle, the other 60 make 0.02 trade each
		const [a] = localAlternatives(
			{ energy: 2 },
			{},
			{ energy: [row(0.4, 4, 1, 100)] },
			{},
			1,
			0.02,
			40
		);
		expect(a.best).toMatchObject({ workers: 100, moved: 60 });
		expect(a.best!.lost).toBeCloseTo(0.3);
		expect(a.best!.total).toBeCloseTo(0.7);
		// 4 made at 0.7 against a value of 1: it pays by itself
		expect(a.best!.net).toBeCloseTo(-1.2);
		expect(a.verdict).toBe('local');
		const [b] = localAlternatives({ energy: 2 }, {}, { energy: [row(0.4, 4, 1, 100)] }, {}, 1, 0.1);
		expect(b.verdict).toBe('import');
	});

	it('weighs a small shortfall against the whole district it would take', () => {
		// 0.24 food short: fee 0.03 a month; a district making 4 at 1.1 a unit costs 0.4 a month net
		const [a] = localAlternatives({ food: 0.24 }, {}, { food: [row(1.1, 4, 1, 100)] });
		expect(a.best!.net).toBeCloseTo(0.4);
		expect(a.verdict).toBe('import');
	});

	it('values a worker by the colony’s job output', () => {
		expect(perWorker({ minerals: 100, alloys: 10 }, 200, { alloys: 5 })).toBe(0.75);
		expect(perWorker({ energy: 5 }, 0, {})).toBe(0);
	});
});
