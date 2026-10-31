import { describe, expect, it } from 'vitest';
import type { Upcoming } from './events.ts';
import { idleIn, idles, withIdleShips } from './idle.ts';
import type { Snapshot } from './types.ts';

const save = (date: string, over: Partial<Snapshot> = {}) =>
	({
		date,
		progress: {
			research: [
				{ area: 'physics', tech: 't1', progress: 1 },
				{ area: 'society', tech: 't2', progress: 1 },
				{ area: 'engineering', tech: 't3', progress: 1 }
			],
			researched: [],
			agenda: { key: 'a', progress: 1 },
			traditionsTaken: 0,
			nextElection: null,
			costSettings: { technology: 1, traditions: 1 }
		},
		colonies: [],
		stations: [],
		idleLeaders: [],
		council: [],
		leaders: null,
		civilianShips: [],
		...over
	}) as Snapshot;

const busy = save('2200.01.01');
const colony = (queue: number) => ({
	planetId: 7,
	name: 'Earth',
	colonizing: false,
	buildQueue: Array(queue).fill({})
});

describe('idleIn', () => {
	it('finds nothing in an empire where everything works', () => {
		expect([...idleIn(busy).keys()]).toEqual([]);
	});

	it('finds empty research fields, no agenda, empty queues and shipyards, unposted leaders, empty seats', () => {
		const s = save('2200.02.01', {
			progress: { ...busy.progress!, research: [], agenda: null },
			colonies: [colony(0)] as Snapshot['colonies'],
			stations: [
				{ id: 3, system: 'Sol', shipyard: { queue: [], slots: 1 } },
				{ id: 4, system: 'Vega', shipyard: null }
			] as unknown as Snapshot['stations'],
			idleLeaders: [{ id: 9, class: 'scientist', name: 'Ada' }],
			council: [{ type: 'councilor_research', leaderId: null }] as Snapshot['council']
		});
		expect([...idleIn(s).keys()].sort()).toEqual([
			'country:idle:agenda',
			'country:idle:council:councilor_research',
			'country:idle:leader:9',
			'country:idle:research:engineering',
			'country:idle:research:physics',
			'country:idle:research:society',
			'country:idle:shipyard:3',
			'planet:7:idle:build'
		]);
	});

	it('counts free leader slots against the limit', () => {
		const s = save('2200.02.01', { leaders: { official: 2, scientist: 3, commander: 4 } });
		const cap = { 'tech:t': { official: 1 } };
		const s2 = { ...s, progress: { ...s.progress!, researched: ['t'] } };
		expect(idleIn(s2, cap).get('country:idle:leaders:official')?.what).toBe(
			'2 official slots free'
		);
		expect(idleIn(s2, cap).has('country:idle:leaders:scientist')).toBe(false);
	});
});

describe('idles', () => {
	const idleQueue = (date: string) => save(date, { colonies: [colony(0)] as Snapshot['colonies'] });

	it('dates a row by the first save of its idle spell, so dismissing hides that spell only', () => {
		const saves = [busy, idleQueue('2200.02.01'), idleQueue('2200.03.01')];
		const { rows } = idles(saves);
		expect(rows.map((r) => [r.what, r.date, r.dismiss])).toEqual([
			['Nothing being built on Earth', '2200.02.01', 'planet:7:idle:build:2200.02.01']
		]);
		expect(idles(saves, undefined, new Set(['planet:7:idle:build:2200.02.01'])).rows).toEqual([]);
		// busy again, then idle again: a new spell, shown again
		const again = [
			...saves,
			save('2200.04.01', { colonies: [colony(1)] as Snapshot['colonies'] }),
			idleQueue('2200.05.01')
		];
		expect(
			idles(again, undefined, new Set(['planet:7:idle:build:2200.02.01'])).rows.map((r) => r.date)
		).toEqual(['2200.05.01']);
	});

	it('makes idle civilian ships dismissable, and drops them once dismissed', () => {
		const ship = {
			fleetId: 5,
			name: 'Ark',
			kind: 'constructor',
			size: 'nomads_constructor',
			order: null,
			automation: null,
			queue: [],
			parked: null
		};
		const saves = [
			save('2200.02.01', { civilianShips: [ship] as unknown as Snapshot['civilianShips'] })
		];
		const { rows, ships } = idles(saves);
		expect(rows).toEqual([]);
		expect(ships.get(5)).toBe('country:idle:ship:5:2200.02.01');
		const row = { kind: 'ship', fleetId: 5 } as Upcoming;
		expect(withIdleShips([row], ships)[0].dismiss).toBe('country:idle:ship:5:2200.02.01');
		const gone = idles(saves, undefined, new Set(['country:idle:ship:5:2200.02.01'])).ships;
		expect(withIdleShips([row], gone)).toEqual([]);
	});
});
