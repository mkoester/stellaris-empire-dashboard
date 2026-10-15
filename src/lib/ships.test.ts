import { describe, expect, it } from 'vitest';
import { idleState, monthsLeft, orderLabel, orderRate, orderTotal } from './ships.ts';
import type { CivilianShip, Snapshot } from './types.ts';

// UNE 3 at 2202.04.01 and 2202.05.01
const ship = (progress: number, orderId = 41): CivilianShip => ({
	fleetId: 1,
	name: 'Armstrong',
	kind: 'science_ship',
	stance: 'evasive',
	automation: null,
	leader: 'Mncedisi Iweala',
	order: { kind: 'research_anomaly', target: 'Proxima Centauri b', progress, orderId },
	queue: [{ kind: 'survey_planet', target: 'Barnards Star IV', progress: 0, orderId: 42 }],
	route: { at: 'Sol', moving: false, stops: [] },
	parked: null
});
const prev = (s: CivilianShip) => ({ civilianShips: [s] }) as unknown as Snapshot;

describe('ships', () => {
	it('knows what orders count to', () => {
		expect(orderTotal({ kind: 'research_anomaly', target: null, progress: 0, orderId: 1 })).toBe(
			100
		);
		expect(
			orderTotal({
				kind: 'build_orbital_station',
				target: null,
				progress: 73,
				orderId: 6,
				size: 'starbase_outpost'
			})
		).toBe(360);
		expect(
			orderTotal({ kind: 'orbit_planet', target: null, progress: null, orderId: 0 })
		).toBeNull();
	});

	it('measures the rate for the same order and estimates what is left', () => {
		const rate = orderRate(ship(73.2), prev(ship(37.2)), 1);
		expect(rate).toBeCloseTo(36);
		expect(monthsLeft(ship(73.2), rate)).toBeCloseTo(26.8 / 36);
		expect(orderRate(ship(5, 99), prev(ship(37.2)), 1)).toBeNull(); // a new order
	});

	it('labels orders', () => {
		expect(orderLabel(ship(0).order!)).toBe('anomaly Proxima Centauri b');
		expect(
			orderLabel({
				kind: 'build_orbital_station',
				target: 'Alpha Centauri A',
				progress: 73,
				orderId: 6,
				size: 'starbase_outpost'
			})
		).toBe('build starbase outpost Alpha Centauri A');
	});
});

describe('idle colony ships', () => {
	const colonizer = (parked: CivilianShip['parked']): CivilianShip => ({
		...ship(0),
		kind: 'colonizer',
		stance: 'evasive',
		automation: null,
		order: null,
		queue: [],
		parked
	});
	const at = (systemOwned: boolean, planetFree = true) => ({
		planet: planetFree ? 'Alpha Centauri III' : 'Earth',
		planetFree,
		system: 'Alpha Centauri',
		systemOwned
	});

	it('waits on purpose in a system not yet owned (Taiwan, 2202.05)', () => {
		expect(idleState(colonizer(at(false)))).toEqual({
			text: 'waiting at Alpha Centauri III — Alpha Centauri not yours yet',
			act: false
		});
	});

	it('asks to colonize once the system is owned', () => {
		expect(idleState(colonizer(at(true))).act).toBe(true);
		expect(idleState(colonizer(at(true))).text).toMatch(/^colonize Alpha Centauri III/);
	});

	it('asks to move a colony ship sitting at home with nothing to settle', () => {
		expect(idleState(colonizer(at(true, false)))).toEqual({
			text: 'colonizer idle at Alpha Centauri',
			act: true
		});
	});
});

describe('automated ships', () => {
	it('never ask to step in: automation picks the next task (Jordan, 2202.06)', () => {
		const jordan = {
			...ship(0),
			kind: 'constructor',
			order: null,
			queue: [],
			automation: ['mining stations', 'research stations']
		};
		expect(idleState(jordan)).toEqual({ text: 'constructor automated, between tasks', act: false });
	});
});
