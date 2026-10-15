import { describe, expect, it } from 'vitest';
import { fromDays, toDays, traditionCost, upcoming, type GameData } from './events.ts';
import type { Progress, Snapshot } from './types.ts';

// The UNE 3 campaign at 2200.03.01 and 2200.04.01, checked against the in-game screens.
const data: GameData = {
	techs: {
		tech_physics_1: { name: 'Quantum Computing', cost: 1500 },
		tech_planetary_unification: { name: 'Societal Unification', cost: 1000 }
	},
	agendas: { agenda_unlock_slot: { name: 'Expand The Council', cost: 7000 } },
	jobs: {},
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
					buildQueue: [
						{ kind: 'district', name: 'district_city', progress: 90, needed: 120 },
						{ kind: 'building', name: 'building_x', progress: 0, needed: 60 }
					]
				}
			]
		} as Partial<Snapshot>);
		const built = upcoming(withQueue, null, data).filter((e) => e.kind === 'construction');
		expect(built.map((e) => [e.date, e.exact])).toEqual([
			['2200.05.01', true],
			['2200.07.01', false]
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
