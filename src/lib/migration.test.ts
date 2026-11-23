import { describe, expect, it } from 'vitest';
import {
	arkshipFirstSeen,
	arkshipOrder,
	DEFAULT_MIGRATION_VIEW,
	parseMigrationView,
	flows,
	migrationFrames,
	migrationHistory,
	monthBefore,
	movesByMonth,
	ownerColors,
	resettleFlows,
	CATEGORICAL,
	OTHER
} from './migration.ts';
import type { Arkship, MigrationColony, Snapshot } from './types.ts';

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
	it("adds our colonies' resettlement from their growth causes, and the month's mod lines", () => {
		const earth = row('Earth', 0, 0, 0, 3);
		const theirs = row('Theirs', 2, 0, 7, 4);
		const s = {
			date: '2228.04.01',
			empireName: 'UNE',
			migration: [earth, theirs],
			colonies: [{ planetId: 3, name: 'Earth', growth: { net: -4, by: { resettle: -4 } } }],
			logEvents: [
				{ date: '2228.03.14', kind: 'resettled', fields: ['Earth', 'Mars', '4', 'Human'] }
			]
		};
		const [f] = migrationFrames([s] as unknown as Snapshot[]);
		expect(f.rows.map((r) => [r.name, r.resettled])).toEqual([
			['Earth', -4],
			['Theirs', 0]
		]);
		expect(f.moves).toEqual([{ from: 'Earth', to: 'Mars', pops: 4, species: 'Human' }]);
	});

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
		expect(frames.map((f) => f.moves)).toEqual([null, null]);
		expect(frames[0].rows[0]).toMatchObject({
			name: 'Earth',
			emigration: 18,
			x: -6,
			y: 279,
			system: 'Sol'
		});
	});
});

describe('resettleFlows', () => {
	const settled = (name: string, resettled: number, ownerId = 0) => ({
		...row(name, 0, 0, ownerId),
		resettled
	});

	it("pairs the save's signed totals, apart from migration (2228.04.01: −4 / +4)", () => {
		const f = resettleFlows([settled('Ark One', -4), settled('Ark Two', 4), row('Mars', 3, 0)]);
		expect(f.map((x) => [x.from.name, x.to.name, x.pops, x.estimated, x.kind])).toEqual([
			['Ark One', 'Ark Two', 4, false, 'resettle']
		]);
	});

	it("takes the mod's lines over the totals, summed per pair; unknown colonies left out", () => {
		const rows = [settled('Earth', -5), settled('Mars', 3), settled('Luna', 2)];
		const f = resettleFlows(rows, [
			{ from: 'Earth', to: 'Mars', pops: 2, species: 'Human' },
			{ from: 'Earth', to: 'Mars', pops: 1, species: 'Blorg' },
			{ from: 'Earth', to: 'Luna', pops: 2, species: 'Human' },
			{ from: 'Elsewhere', to: 'Luna', pops: 9, species: 'Human' }
		]);
		expect(f.map((x) => [x.from.name, x.to.name, x.pops, x.estimated])).toEqual([
			['Earth', 'Mars', 3, false],
			['Earth', 'Luna', 2, false]
		]);
	});

	it("ignores other empires' colonies", () => {
		expect(resettleFlows([settled('Theirs', -3, 5), settled('Also', 3, 5)])).toEqual([]);
	});
});

describe('monthBefore', () => {
	it("gives the month a save's last-month figures cover", () => {
		expect(monthBefore('2228.04.01')).toBe('2228.03');
		expect(monthBefore('2228.01.01')).toBe('2227.12');
	});
});

describe('movesByMonth', () => {
	it("reads the mod's resettled lines once each, by month", () => {
		const e = { date: '2228.03.14', kind: 'resettled', fields: ['Earth', 'Mars', '3', 'Human'] };
		const m = movesByMonth([
			{ logEvents: [e] },
			{ logEvents: [e, { date: '2228.03.20', kind: 'edict', fields: [] }] }
		] as unknown as Snapshot[]);
		expect([...m]).toEqual([
			['2228.03', [{ from: 'Earth', to: 'Mars', pops: 3, species: 'Human' }]]
		]);
	});
});

describe('arkships on the circle', () => {
	const ark = (shipId: number, name: string, tier: number, planetSize = 9): Arkship => ({
		shipId,
		colonyId: shipId + 100,
		name,
		size: `civilian_arkship_tier_${tier}`,
		tier,
		planetSize,
		systemId: null,
		capital: false,
		cargo: []
	});
	const arks = [ark(7, 'Beta', 1), ark(2, 'Alpha', 2, 6), ark(9, 'Gamma', 2, 12)];

	it('orders oldest first: first seen, then ship id', () => {
		const seen = arkshipFirstSeen([
			{ date: '2200.01.01', arkships: [arks[0], arks[1]] },
			{ date: '2201.01.01', arkships: null },
			{ date: '2203.05.01', arkships: arks }
		]);
		expect(seen).toEqual({ 7: '2200.01.01', 2: '2200.01.01', 9: '2203.05.01' });
		expect(arkshipOrder(arks, 'age', seen).map((a) => a.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
	});
	it('orders by size, the biggest first: tier, then planet size', () => {
		expect(arkshipOrder(arks, 'size').map((a) => a.name)).toEqual(['Gamma', 'Alpha', 'Beta']);
	});
	it('orders alphabetically', () => {
		expect(arkshipOrder(arks, 'name').map((a) => a.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
	});
	it('reads a stored view, defaults for anything else', () => {
		expect(parseMigrationView({ layout: 'circle', order: 'size' })).toEqual({
			layout: 'circle',
			order: 'size'
		});
		expect(parseMigrationView({ layout: 'x', order: 'y' })).toEqual(DEFAULT_MIGRATION_VIEW);
		expect(parseMigrationView(null)).toEqual({ layout: 'map', order: 'age' });
	});
});
