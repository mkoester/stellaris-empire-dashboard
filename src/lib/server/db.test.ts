import { describe, expect, it } from 'vitest';
import type { Snapshot } from '#lib/types.ts';
import { headId, history, nodes, openDb, record, setParent } from './db.ts';

const snap = (date: string, fingerprint: string, energy = 0): Snapshot => ({
	campaign: 'c',
	date,
	fingerprint,
	countryId: 0,
	empireName: 'E',
	pops: 0,
	stockpile: { energy },
	income: {},
	expenses: {},
	balance: {},
	colonies: []
});

describe('db', () => {
	it('records a linear game, then a reload as a branch with its own history', () => {
		const db = openDb(':memory:');
		const a = record(db, snap('2200.01.01', 'a', 1), 't').nodeId;
		const b = record(db, snap('2201.01.01', 'b', 2), 't').nodeId;
		record(db, snap('2202.01.01', 'c', 3), 't');
		// reload of the 2201 save, played on differently
		const d = record(db, snap('2201.06.01', 'd', 9), 't').nodeId;

		expect(headId(db)).toBe(d);
		expect(nodes(db).find((n) => n.id === d)).toMatchObject({ parentId: b, ambiguous: true });
		expect(history(db, d).map((s) => s.stockpile.energy)).toEqual([1, 2, 9]);
		expect(a).toBe(1);
	});

	it('does not duplicate a state seen twice, but moves the head to it', () => {
		const db = openDb(':memory:');
		const a = record(db, snap('2200.01.01', 'a'), 't').nodeId;
		record(db, snap('2201.01.01', 'b'), 't');
		expect(record(db, snap('2200.01.01', 'a'), 't')).toEqual({ nodeId: a, isNew: false });
		expect(nodes(db)).toHaveLength(2);
		expect(headId(db)).toBe(a);
	});

	it('lets a guessed parent be corrected, but not into a cycle', () => {
		const db = openDb(':memory:');
		const a = record(db, snap('2200.01.01', 'a'), 't').nodeId;
		const b = record(db, snap('2201.01.01', 'b'), 't').nodeId;
		const c = record(db, snap('2200.06.01', 'c'), 't').nodeId; // guessed parent: a
		setParent(db, c, b);
		expect(nodes(db).find((n) => n.id === c)).toMatchObject({ parentId: b, ambiguous: false });
		expect(() => setParent(db, a, c)).toThrow(/cycle/);
	});
});
