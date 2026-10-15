import { describe, expect, it } from 'vitest';
import {
	fromDays,
	scheduleQueue,
	toDays,
	traditionCost,
	upcoming,
	type GameData
} from './events.ts';
import type { Progress, Snapshot } from './types.ts';

// The UNE 3 campaign at 2200.03.01 and 2200.04.01, checked against the in-game screens.
const data: GameData = {
	techs: {
		tech_physics_1: { name: 'Quantum Computing', cost: 1500, area: 'physics', tier: 1 },
		tech_planetary_unification: {
			name: 'Societal Unification',
			cost: 1000,
			area: 'society',
			tier: 1
		}
	},
	agendas: { agenda_unlock_slot: { name: 'Expand The Council', cost: 7000 } },
	jobs: {},
	edicts: {},
	traits: {},
	speciesClasses: {},
	archetypes: {},
	planetClasses: {},
	names: {},
	blockers: [],
	traditionTrees: {},
	perks: {},
	defines: {
		EMPIRE_SIZE_BASE: 100,
		EMPIRE_SIZE_TECH_COST_PENALTY: 0.002,
		EMPIRE_SIZE_COUNCIL_AGENDA_COST_PENALTY: 0.001,
		EMPIRE_SIZE_TRADITION_COST_PENALTY: 0.002,
		TRADITION_COST_AMOUNTS: 300,
		TRADITION_COST_TRADITION: 8,
		TRADITION_COST_TRADITION_EXP: 1.8
	}
};

const progress = (physics: number, agenda: number): Progress => ({
	research: [{ area: 'physics', tech: 'tech_physics_1', progress: physics }],
	researched: [],
	agenda: { key: 'agenda_unlock_slot', progress: agenda },
	traditionsTaken: 0,
	nextElection: '2210.01.01',
	costSettings: { technology: 1, traditions: 1 }
});

const snap = (date: string, p: Progress, extra: Partial<Snapshot> = {}) =>
	({
		date,
		progress: p,
		empireSize: 50,
		stockpile: { unity: 146.21 },
		balance: { unity: 35.403 },
		income: { physics_research: 14.02 },
		colonies: [],
		...extra
	}) as unknown as Snapshot;

const prev = snap('2200.03.01', progress(28.49205, 84));
const latest = snap('2200.04.01', progress(42.79314, 126));

describe('game calendar', () => {
	it('round-trips dates through 30-day months', () => {
		expect(fromDays(toDays('2200.04.01'))).toBe('2200.04.01');
		expect(fromDays(toDays('2200.12.30') + 1)).toBe('2201.01.01');
	});
});

describe('upcoming', () => {
	const events = upcoming(latest, prev, data);
	const of = (kind: string) => events.find((e) => e.kind === kind)!;

	it('dates research from the measured rate and the scaled cost (game: 108 months)', () => {
		expect(of('research')).toMatchObject({
			what: 'Quantum Computing',
			months: 108,
			date: '2209.04.01'
		});
	});

	it('dates the next tradition (game: 153.79 missing, by 2200.09.01)', () => {
		expect(of('tradition')).toMatchObject({ date: '2200.09.01', months: 5 });
	});

	it('dates the agenda from its measured progress (game says 163 months; we round up)', () => {
		expect(of('agenda')).toMatchObject({ what: 'Expand The Council', months: 164 });
	});

	it('includes the election and sorts by date', () => {
		expect(events.map((e) => e.kind)).toEqual(['tradition', 'research', 'election', 'agenda']);
	});

	it('falls back to income when there is no earlier save', () => {
		expect(upcoming(latest, null, data).find((e) => e.kind === 'research')!.detail).toContain(
			'+14.0'
		);
	});

	it('queues construction one item after the other, only the first exact', () => {
		const withQueue = snap('2200.04.01', progress(0, 0), {
			colonies: [
				{
					planetId: 3,
					name: 'Earth',
					buildSlots: 1,
					buildQueue: [
						{ kind: 'district', name: 'district_city', progress: 90, needed: 120 },
						{ kind: 'building', name: 'building_x', progress: 0, needed: 60 }
					]
				}
			]
		} as Partial<Snapshot>);
		const built = upcoming(withQueue, null, data).filter((e) => e.kind === 'construction');
		expect(built.map((e) => [e.date, e.exact, e.queuedAfter, e.act])).toEqual([
			['2200.05.01', true, 1, false], // the next item takes over: information
			['2200.07.01', false, 0, true] // the queue runs empty: act
		]);
	});
});

describe('traditionCost', () => {
	it('is 300 for the first and grows with traditions taken and empire size', () => {
		expect(traditionCost(0, 50, 1, data.defines)).toBe(300);
		expect(traditionCost(1, 50, 1, data.defines)).toBeCloseTo(300 + 8 ** 1.8);
		expect(traditionCost(0, 150, 1, data.defines)).toBeCloseTo(330);
	});
});

describe('scheduleQueue', () => {
	const item = (left: number) => ({ progress: 0, needed: left });

	it('builds one at a time with one slot', () => {
		expect(
			scheduleQueue([item(30), item(60), item(10)], 1).map((p) => [p.doneIn, p.waitingAfter])
		).toEqual([
			[30, 2],
			[90, 1],
			[100, 0]
		]);
	});

	it('fills free slots in queue order with several (wilderness, arkships, mods)', () => {
		const plan = scheduleQueue([item(30), item(60), item(10)], 2);
		expect(plan.map((p) => [p.doneIn, p.startsNow, p.waitingAfter])).toEqual([
			[30, true, 1], // the third item takes its slot
			[60, true, 0], // nothing left to take this slot
			[40, false, 0]
		]);
	});
});

describe('upcoming shipyards', () => {
	it('lists ship queue items by the construction rules', () => {
		const s = snap('2200.12.01', progress(0, 0), {
			stations: [
				{
					id: 0,
					system: 'Sol',
					level: 'starport',
					modules: ['shipyard'],
					buildings: [],
					queue: [],
					slots: 1,
					arkship: false,
					shipyard: {
						slots: 1,
						queue: [
							{
								kind: 'colony_ship',
								name: 'colonizer',
								design: 'Byzantium',
								progress: 77,
								needed: 360
							},
							{ kind: 'ship', name: 'corvette', progress: 0, needed: 60 }
						]
					}
				}
			]
		} as Partial<Snapshot>);
		const yard = upcoming(s, null, data).filter((e) => e.kind === 'shipyard');
		expect(yard.map((e) => [e.what, e.date, e.queuedAfter, e.act, e.detail])).toEqual([
			['colonizer "Byzantium"', '2201.09.14', 1, false, 'Sol starport'],
			['corvette', '2201.11.14', 0, true, 'Sol starport']
		]);
	});
});

describe('upcoming civilian ships', () => {
	const order = (progress: number) => ({
		kind: 'research_anomaly',
		target: 'Proxima Centauri b',
		progress,
		orderId: 41
	});
	const ship = (progress: number, queue = 1) => ({
		fleetId: 1,
		name: 'Armstrong',
		kind: 'science_ship',
		leader: null,
		order: order(progress),
		queue: Array(queue).fill({
			kind: 'survey_planet',
			target: 'Barnards Star IV',
			progress: 0,
			orderId: 42
		}),
		route: { at: 'Sol', moving: false, stops: [] }
	});
	const idle = {
		fleetId: 9,
		name: 'Taiwan',
		kind: 'colonizer',
		leader: null,
		order: null,
		queue: [],
		route: { at: 'Sol', moving: false, stops: [] }
	};

	it('dates the current order from the measured rate and flags idle ships', () => {
		const prev = snap('2202.04.01', progress(0, 0), {
			civilianShips: [ship(37.2)]
		} as Partial<Snapshot>);
		const now = snap('2202.05.01', progress(0, 0), {
			civilianShips: [ship(73.2, 6), idle]
		} as Partial<Snapshot>);
		const rows = upcoming(now, prev, data).filter((e) => e.kind === 'ship');
		expect(rows.map((e) => [e.what, e.date, e.queuedAfter, e.act])).toEqual([
			['colonizer idle', '2202.05.01', 0, true],
			['anomaly Proxima Centauri b', '2202.05.23', 6, false]
		]);
	});
});
