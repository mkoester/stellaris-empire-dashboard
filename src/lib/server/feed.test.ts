import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assembler, monthFingerprint, parseLine, tailLog, type Month } from './feed.ts';

const prefix = '[21:55:30][effect_impl.cpp:1234]: ';

describe('parseLine', () => {
	it('reads a resource line behind game.log’s prefix', () => {
		expect(parseLine(`${prefix}SDASH|1|2201.03.01|energy|1200.5|-3.25`)).toEqual({
			kind: 'resource',
			date: '2201.03.01',
			resource: 'energy',
			stockpile: 1200.5,
			income: -3.25
		});
	});

	it('reads the end marker and pads unpadded dates', () => {
		expect(parseLine('SDASH|1|2201.3.1|end')).toEqual({ kind: 'end', date: '2201.03.01' });
	});

	it('ignores unrelated lines', () => {
		expect(parseLine(`${prefix}2132 defines loaded`)).toBeNull();
	});

	it('refuses formatted numbers rather than misreading them', () => {
		expect(() => parseLine('SDASH|1|2201.03.01|energy|1.2K|3')).toThrow(/malformed/);
	});

	it('refuses an unknown date format and an unknown version', () => {
		expect(() => parseLine('SDASH|1|1 March 2201|end')).toThrow(/date format/);
		expect(() => parseLine('SDASH|3|2201.03.01|end')).toThrow(/format 3/);
	});

	it('reads the format 2 lines', () => {
		expect(parseLine('SDASH|2|2201.03.01|energy|10|1')).toMatchObject({ kind: 'resource' });
		expect(parseLine('SDASH|2|2201.03.01|timeline|482913|7')).toEqual({
			kind: 'timeline',
			date: '2201.03.01',
			id: 482913,
			previous: 7
		});
		expect(parseLine('SDASH|2|2201.03.05|tick|energy|12.5')).toEqual({
			kind: 'tick',
			date: '2201.03.05',
			resource: 'energy',
			stockpile: 12.5
		});
		expect(parseLine('SDASH|2|2201.03.05|tick-end')).toEqual({
			kind: 'tick-end',
			date: '2201.03.05'
		});
		expect(parseLine('SDASH|2|2201.03.05|load|482913')).toEqual({
			kind: 'load',
			date: '2201.03.05',
			id: 482913
		});
		expect(parseLine('SDASH|2|2201.03.05|load|0')).toMatchObject({ id: null });
		expect(parseLine('SDASH|2|2201.03.07|event|combat|Us|1st Fleet|Them|Raiders|Sol')).toEqual({
			kind: 'event',
			event: {
				date: '2201.03.07',
				kind: 'combat',
				fields: ['Us', '1st Fleet', 'Them', 'Raiders', 'Sol']
			}
		});
	});

	it('reads the spending events, the edict without a field', () => {
		expect(parseLine('SDASH|2|2201.03.07|event|district-queued|Earth')).toEqual({
			kind: 'event',
			event: { date: '2201.03.07', kind: 'district-queued', fields: ['Earth'] }
		});
		expect(parseLine('SDASH|2|2201.03.07|event|edict')).toEqual({
			kind: 'event',
			event: { date: '2201.03.07', kind: 'edict', fields: [] }
		});
	});

	it('skips a newer mod\'s event kinds, refuses wrong field counts (a "|" in a name)', () => {
		expect(parseLine('SDASH|2|2201.03.07|event|nonsense|x')).toBeNull();
		expect(() => parseLine('SDASH|2|2201.03.07|event|colony|New|Hope')).toThrow(/malformed/);
		expect(() => parseLine('SDASH|2|2201.03.07|tick|energy|')).toThrow(/malformed/);
	});
});

describe('assembler', () => {
	it('returns a month only at its end marker, even with other months interleaved', () => {
		const add = assembler();
		expect(add(parseLine('SDASH|1|2201.03.01|energy|10|1')!)).toBeNull();
		expect(add(parseLine('SDASH|1|2201.04.01|energy|11|1')!)).toBeNull();
		expect(add(parseLine('SDASH|1|2201.03.01|alloys|5|-2')!)).toBeNull();
		expect(add(parseLine('SDASH|1|2201.03.01|end')!)).toEqual({
			kind: 'month',
			month: {
				date: '2201.03.01',
				stockpile: { energy: 10, alloys: 5 },
				balance: { energy: 1, alloys: -2 },
				timelineId: null,
				previousTimelineId: null,
				events: [],
				ticks: []
			}
		});
	});

	const feed = (add: ReturnType<typeof assembler>, lines: string) =>
		lines
			.trim()
			.split('\n')
			.map((l) => add(parseLine(l.trim())!))
			.filter((o) => o !== null);

	it('reports each day at once and hands days and events to the month that completes next', () => {
		const add = assembler();
		const out = feed(
			add,
			`SDASH|2|2201.02.29|tick|energy|4
			SDASH|2|2201.02.29|tick-end
			SDASH|2|2201.02.30|event|colony|Mars
			SDASH|2|2201.03.01|timeline|222222|111111
			SDASH|2|2201.03.01|energy|5|1
			SDASH|2|2201.03.01|end`
		);
		expect(out[0]).toEqual({
			kind: 'tick',
			tick: { date: '2201.02.29', stockpile: { energy: 4 } }
		});
		expect(out[1]).toMatchObject({
			kind: 'month',
			month: {
				timelineId: 222222,
				previousTimelineId: 111111,
				events: [{ date: '2201.02.30', kind: 'colony', fields: ['Mars'] }],
				ticks: [{ date: '2201.02.29', stockpile: { energy: 4 } }]
			}
		});
	});

	it('drops what happened after the last month once a save is loaded: that future was left', () => {
		const add = assembler();
		const out = feed(
			add,
			`SDASH|2|2201.03.10|event|colony|Mars
			SDASH|2|2201.03.10|tick|energy|9
			SDASH|2|2201.03.10|tick-end
			SDASH|2|2201.03.15|energy|9|1
			SDASH|2|2201.02.20|load|111111
			SDASH|2|2201.03.01|energy|5|1
			SDASH|2|2201.03.01|end`
		);
		expect(out[1]).toEqual({ kind: 'load', date: '2201.02.20', id: 111111 });
		expect(out[2]).toMatchObject({
			kind: 'month',
			month: { events: [], ticks: [], stockpile: { energy: 5 } }
		});
	});
});

describe('monthFingerprint', () => {
	const m = (energy: number): Month => ({
		date: '2201.03.01',
		stockpile: { energy },
		balance: {},
		timelineId: null,
		previousTimelineId: null,
		events: [],
		ticks: []
	});
	it('differs between branches with different stockpiles at the same date', () => {
		expect(monthFingerprint(m(1))).not.toBe(monthFingerprint(m(2)));
		expect(monthFingerprint(m(1))).toBe(monthFingerprint(m(1)));
	});
});

describe('tailLog', () => {
	const until = async (cond: () => boolean) => {
		for (const end = Date.now() + 3000; !cond();) {
			if (Date.now() > end) throw new Error('timed out');
			await new Promise((r) => setTimeout(r, 20));
		}
	};

	it('skips what was there before, follows appends, and restarts after the game recreates the file', async () => {
		const file = join(mkdtempSync(join(tmpdir(), 'log-')), 'game.log');
		writeFileSync(
			file,
			`${prefix}SDASH|1|2200.01.01|energy|1|1\n${prefix}SDASH|1|2200.01.01|end\n`
		);
		const months: Month[] = [];
		const errors: unknown[] = [];
		const stop = await tailLog(file, {
			onMonth: (m) => months.push(m),
			onError: (e) => errors.push(e),
			intervalMs: 20
		});
		try {
			// a line split across two writes must still be read whole
			appendFileSync(file, `${prefix}SDASH|1|2200.02.01|ener`);
			await new Promise((r) => setTimeout(r, 60));
			appendFileSync(file, `gy|2|1\n${prefix}SDASH|1|2200.02.01|end\n`);
			await until(() => months.length === 1);
			expect(months[0]).toMatchObject({
				date: '2200.02.01',
				stockpile: { energy: 2 },
				balance: { energy: 1 }
			});

			writeFileSync(
				file,
				`${prefix}SDASH|1|2200.01.01|energy|7|1\n${prefix}SDASH|1|2200.01.01|end\n`
			);
			await until(() => months.length === 2);
			expect(months[1].stockpile).toEqual({ energy: 7 });
			expect(errors).toEqual([]);
		} finally {
			stop();
		}
	});
});
