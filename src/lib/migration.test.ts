import { describe, expect, it } from 'vitest';
import {
	flows,
	migrationFrames,
	migrationHistory,
	ownerColors,
	CATEGORICAL,
	OTHER
} from './migration.ts';
import type { MigrationColony, Snapshot } from './types.ts';

let next = 100;
const row = (
	name: string,
	immigration: number,
	emigration: number,
	ownerId = 0,
	planetId = next++
): MigrationColony => ({
	colonyId: planetId,
	planetId,
	name,
	ownerId,
	owner: ownerId === 0 ? 'UNE' : `empire ${ownerId}`,
	own: ownerId === 0,
	system: '',
	x: 0,
	y: 0,
	immigration,
	emigration
});

describe('flows', () => {
	it('is exact with one sender (UNE 3, 2207.03: Earth → Alpha Centauri Prime)', () => {
		const f = flows([
			row('Earth', 0, 18),
			row('Alpha Centauri Prime', 18, 0),
			row('Sirius Prime', 0, 0)
		]);
		expect(f.map((x) => [x.from.name, x.to.name, x.pops, x.estimated])).toEqual([
			['Earth', 'Alpha Centauri Prime', 18, false]
		]);
	});

	it('splits proportionally, flagged, with several senders and receivers', () => {
		const f = flows([row('A', 0, 10), row('B', 0, 20), row('C', 6, 0), row('DD', 24, 0, 11)]);
		expect(f.map((x) => [x.from.name, x.to.name, x.pops, x.estimated])).toEqual([
			['A', 'C', 2, true],
			['A', 'DD', 8, true],
			['B', 'C', 4, true],
			['B', 'DD', 16, true]
		]);
	});
});

describe('ownerColors', () => {
	it('gives the own empire slot 1, two foreign empires slots 2–3, the rest "other"', () => {
		const c = ownerColors([
			row('a', 1, 0),
			row('b', 1, 0, 11),
			row('c', 1, 0, 12),
			row('d', 1, 0, 13)
		]);
		expect(c).toEqual({ 0: CATEGORICAL[0], 11: CATEGORICAL[1], 12: CATEGORICAL[2], 13: OTHER });
	});
});

describe('migrationHistory', () => {
	it('reads the migration field, older snapshots from colony growth, and gaps where nothing is known', () => {
		const old = {
			date: '2204.06.01',
			empireName: 'UNE',
			migration: null,
			colonies: [
				{ planetId: 3, name: 'Earth', growth: { net: -15, by: { emigration: -18, growth: 3 } } }
			]
		};
		const none = {
			date: '2204.07.01',
			empireName: 'UNE',
			migration: null,
			colonies: [{ planetId: 3, name: 'Earth', growth: null }]
		};
		const now = {
			date: '2204.08.01',
			empireName: 'UNE',
			migration: [row('Earth', 0, 12, 0, 3)],
			colonies: []
		};
		const h = migrationHistory([old, none, now] as unknown as Snapshot[]);
		expect(h.colonies).toHaveLength(1);
		expect(h.colonies[0].emigration).toEqual([18, null, 12]);
	});
});

describe('migrationFrames', () => {
	it('keeps months with data, rebuilding old ones from growth with the newest known positions', () => {
		const earth = { ...row('Earth', 0, 12, 0, 3), x: -6, y: 279, system: 'Sol' };
		const old = {
			date: '2206.11.01',
			empireName: 'UNE',
			migration: null,
			colonies: [{ planetId: 3, name: 'Earth', growth: { net: -15, by: { emigration: -18 } } }]
		};
		const none = {
			date: '2206.12.01',
			empireName: 'UNE',
			migration: null,
			colonies: [{ planetId: 3, name: 'Earth', growth: null }]
		};
		const now = { date: '2207.03.01', empireName: 'UNE', migration: [earth], colonies: [] };
		const frames = migrationFrames([old, none, now] as unknown as Snapshot[]);
		expect(frames.map((f) => f.date)).toEqual(['2206.11.01', '2207.03.01']);
		expect(frames[0].rows[0]).toMatchObject({
			name: 'Earth',
			emigration: 18,
			x: -6,
			y: 279,
			system: 'Sol'
		});
	});
});
