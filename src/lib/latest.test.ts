import { describe, expect, it } from 'vitest';
import { latestOf } from './latest.ts';
import type { Snapshot } from './types.ts';

const snap = (kind: string, date: string, colonies: string[], more = {}) =>
	({ kind, date, colonies: colonies.map((name) => ({ name })), ...more }) as unknown as Snapshot;

describe('latestOf', () => {
	it('a feed month without colonies takes the last save’s', () => {
		const l = latestOf([
			snap('save', '2207.04.01', ['Theia', 'Curiel']),
			snap('log', '2207.10.01', [])
		]);
		expect(l.date).toBe('2207.10.01');
		expect(l.colonies.map((c) => c.name)).toEqual(['Theia', 'Curiel']);
	});
	it('a feed month keeps its own data and takes the rest from the last save', () => {
		const save = snap('save', '2207.04.01', ['Theia'], {
			empireName: 'United Nations of Earth',
			empireSize: 149,
			score: { rank: 6, score: 2639.7 },
			stockpile: { energy: 100 },
			logEvents: [{ kind: 'colony' }],
			ticks: [{ date: '2207.03.15' }],
			multiplayer: false
		});
		const log = snap('log', '2207.05.01', [], {
			empireName: '',
			empireSize: null,
			score: null,
			stockpile: { energy: 120 },
			logEvents: [],
			ticks: [],
			multiplayer: false
		});
		const l = latestOf([save, log]);
		expect(l.kind).toBe('log');
		expect(l.date).toBe('2207.05.01');
		expect(l.empireName).toBe('United Nations of Earth');
		expect(l.empireSize).toBe(149);
		expect(l.score).toEqual({ rank: 6, score: 2639.7 });
		expect(l.stockpile).toEqual({ energy: 120 });
		// the save's events and days are not this month's
		expect(l.logEvents).toEqual([]);
		expect(l.ticks).toEqual([]);
	});
	it('a feed month without a save before it stays as it is', () => {
		const log = snap('log', '2207.05.01', []);
		expect(latestOf([log])).toBe(log);
	});
	it('a save stays as it is', () => {
		const s = snap('save', '2207.04.01', ['Theia']);
		expect(latestOf([snap('save', '2207.03.01', ['X']), s])).toBe(s);
	});
});
