import { describe, expect, it } from 'vitest';
import {
	daysPerJump,
	estimateMonthsLeft,
	idleState,
	monthsLeft,
	orderLabel,
	orderRate,
	orderTotal,
	shipName
} from './ships.ts';
import { pretty } from './format.ts';
import type { CivilianShip, Snapshot } from './types.ts';

// UNE 3: Grissom's anomaly at Xigar V a, 2207.01.01 and 2207.02.01 (done before 2207.03.01)
const levels = { GEN_PLAYGROUND_CAT: 3 };
const ship = (progress: number, orderId = 52): CivilianShip => ({
	fleetId: 1,
	name: 'Armstrong',
	kind: 'science_ship',
	stance: 'evasive',
	automation: null,
	leader: 'Gabriela Rosario',
	leaderLevel: 2,
	order: {
		kind: 'research_anomaly',
		target: 'Xigar V a',
		progress,
		orderId,
		anomaly: 'GEN_PLAYGROUND_CAT'
	},
	queue: [{ kind: 'survey_planet', target: 'Barnards Star IV', progress: 0, orderId: 42 }],
	route: { at: 'Sol', moving: false, stops: [] },
	parked: null
});
const prev = (s: CivilianShip) => ({ civilianShips: [s] }) as unknown as Snapshot;

describe('ships', () => {
	it('knows what orders count to, as completed orders showed', () => {
		const o = (kind: string, extra = {}) => ({
			kind,
			target: null,
			progress: 0,
			orderId: 1,
			...extra
		});
		// a level-2 scientist on a level-3 anomaly: one level below → 180 days
		expect(
			orderTotal(
				o('research_anomaly', { anomaly: 'GEN_PLAYGROUND_CAT' }),
				{ leaderLevel: 2 },
				levels
			)
		).toBe(180);
		expect(
			orderTotal(
				o('research_anomaly', { anomaly: 'GEN_PLAYGROUND_CAT' }),
				{ leaderLevel: 5 },
				levels
			)
		).toBe(80);
		expect(
			orderTotal(o('research_anomaly', { anomaly: 'UNKNOWN_CAT' }), { leaderLevel: 2 }, levels)
		).toBeNull();
		expect(orderTotal(o('survey_planet'), { leaderLevel: null }, levels)).toBe(30);
		expect(
			orderTotal(
				o('build_orbital_station', { size: 'mining_station' }),
				{ leaderLevel: null },
				levels
			)
		).toBe(100);
		expect(orderTotal(o('orbit_planet'), { leaderLevel: null }, levels)).toBeNull();
	});

	it('measures the rate for the same order and estimates what is left', () => {
		const rate = orderRate(ship(176.4), prev(ship(140.4)), 1);
		expect(rate).toBeCloseTo(36);
		expect(monthsLeft(ship(176.4), rate, levels)).toBeCloseTo(3.6 / 36); // done before 03.01 ✓
		expect(orderRate(ship(5, 99), prev(ship(140.4)), 1)).toBeNull(); // a new order
	});

	it('labels orders', () => {
		expect(orderLabel(ship(0).order!)).toBe('anomaly Xigar V a');
		expect(
			orderLabel({
				kind: 'build_orbital_station',
				target: 'Alpha Centauri A',
				progress: 73,
				orderId: 6,
				size: 'starbase_outpost'
			})
		).toBe('build starbase outpost Alpha Centauri A');
		// the system where the name does not give it
		const survey = { kind: 'survey_planet', progress: 3, orderId: 7 };
		expect(orderLabel({ ...survey, target: 'GR- QW1', system: 'Xigar' })).toBe(
			'survey GR- QW1 in Xigar'
		);
		expect(orderLabel({ ...survey, target: 'Xigar II', system: 'Xigar' })).toBe('survey Xigar II');
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
			text: 'Colony Ship idle at Alpha Centauri',
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
		expect(idleState(jordan)).toEqual({
			text: 'Construction Ship automated, between tasks',
			act: false
		});
	});
});

describe('estimates without a rate', () => {
	const route = (jumps: number | null, system = 'Sirius') => ({
		at: 'Sol',
		moving: true,
		stops: [{ system, jumps, unexplored: false }]
	});
	it('days per jump from two readings of one route', () => {
		expect(daysPerJump(route(3), route(6), 30)).toBe(10);
		expect(daysPerJump(route(3), route(6, 'Elsewhere'), 30)).toBeNull();
		expect(daysPerJump(route(6), route(6), 30)).toBeNull();
		expect(daysPerJump(route(3), undefined, 30)).toBeNull();
	});
	it('a survey at the base rate, a move by its jumps', () => {
		const ship = (kind: string, progress: number | null) =>
			({
				leaderLevel: 1,
				order: { kind, target: 'x', progress, orderId: 1 },
				queue: [],
				route: route(4)
			}) as unknown as CivilianShip;
		expect(estimateMonthsLeft(ship('survey_planet', 12), {}, 10)).toBeCloseTo(0.6); // 18 days
		expect(estimateMonthsLeft(ship('move', null), {}, 10)).toBeCloseTo(4 / 3); // 40 days
	});
});

describe('shipName', () => {
	it('names a ship by its size as the game does, the class only when the size is unknown', () => {
		expect(shipName('nomads_constructor', 'constructor')).toBe('Logistic Ship');
		expect(shipName('constructor', 'constructor')).toBe('Construction Ship');
		expect(shipName(undefined, 'constructor')).toBe('Construction Ship');
		expect(shipName(undefined, 'science_ship')).toBe('Science Ship');
		expect(shipName('corvette')).toBe(pretty('corvette'));
	});
});
