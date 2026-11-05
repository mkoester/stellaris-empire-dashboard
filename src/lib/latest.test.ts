import { describe, expect, it } from 'vitest';
import { latestOf } from './latest.ts';
import type { Snapshot } from './types.ts';

const snap = (kind: string, date: string, colonies: string[]) =>
	({ kind, date, colonies: colonies.map((name) => ({ name })) }) as unknown as Snapshot;

describe('latestOf', () => {
	it('a feed month without colonies takes the last save’s', () => {
		const l = latestOf([
			snap('save', '2207.04.01', ['Theia', 'Curiel']),
			snap('log', '2207.10.01', [])
		]);
		expect(l.date).toBe('2207.10.01');
		expect(l.colonies.map((c) => c.name)).toEqual(['Theia', 'Curiel']);
	});
	it('a save stays as it is', () => {
		const s = snap('save', '2207.04.01', ['Theia']);
		expect(latestOf([snap('save', '2207.03.01', ['X']), s])).toBe(s);
	});
});
