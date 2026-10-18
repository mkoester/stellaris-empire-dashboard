import { describe, expect, it } from 'vitest';
import {
	contactRows,
	discovered,
	mainNetwork,
	mapView,
	monthsBetween,
	stationOwners
} from './situations.ts';
import type { FirstContact, GalaxySystem } from './types.ts';

const sys = (id: number, lanes: number[], s: Partial<GalaxySystem> = {}): GalaxySystem => ({
	id,
	name: `S${id}`,
	x: id,
	y: 0,
	star: 'sc_g',
	lanes,
	visited: true,
	owned: false,
	ownerId: null,
	bodies: [],
	megastructures: [],
	...s
});
// 1 (ours) — 2 — 3 (their station) — 4 (the contact)
const galaxy = [
	sys(1, [2], { owned: true, ownerId: 0 }),
	sys(2, [3]),
	sys(3, [4], { ownerId: 77 }),
	sys(4, [], { visited: false })
];
// first_contacts.contacts.33 at 2207.03.10 (the "Imps", difficulty 5, no clues yet)
const imps: FirstContact = {
	id: 33,
	countryId: 77,
	name: 'Imps',
	systemId: 4,
	leaderId: 301989892,
	leaderName: 'Ratimir Statnik',
	date: '2207.02.04',
	daysLeft: 44.66,
	difficulty: 5,
	clues: 0,
	stage: 'default_stage_1',
	status: 'in_progress'
};

describe('monthsBetween', () => {
	it('counts whole 30-day months', () => {
		expect(monthsBetween('2207.02.04', '2207.03.10')).toBe(1);
		expect(monthsBetween('2205.05.10', '2207.03.10')).toBe(22);
		expect(monthsBetween('2207.03.10', '2207.03.01')).toBe(0);
	});
});

describe('contactRows', () => {
	it('adds where, how old, how far from our border and their stations', () => {
		const relation = {
			countryId: 77,
			name: 'Imps',
			contact: true,
			communications: false,
			hostile: false,
			opinion: 20,
			trust: 0,
			threat: 0,
			borderRange: null
		};
		const [row] = contactRows([imps], galaxy, [relation], [], '2207.03.10');
		expect(row).toMatchObject({
			system: 'S4',
			months: 1,
			jumps: 3,
			communications: false,
			stations: 1
		});
	});
});

describe('stationOwners', () => {
	it('groups other empires’ stations and links them to their first contact', () => {
		const owners = stationOwners(galaxy, 0, [], [], [imps]);
		expect(owners).toHaveLength(1);
		expect(owners[0]).toMatchObject({ countryId: 77, systems: [3], contact: 33 });
	});
});

describe('discovered', () => {
	it('keeps visited and own systems, the contact sites, and only the lanes among them', () => {
		// 4 is unvisited but a contact site; 3 is visited; 2 is neither
		const g = [
			sys(1, [2, 3], { owned: true }),
			sys(2, [4], { visited: false }),
			sys(3, [4]),
			sys(4, [], { visited: false })
		];
		const none = { whole: false, stars: false };
		expect(discovered(g, none, [4]).map((s) => [s.id, s.lanes])).toEqual([
			[1, [3]],
			[3, [4]],
			[4, []]
		]);
		// every star, but no lane to or from the undiscovered 2
		expect(
			discovered(g, { whole: false, stars: true }, [4]).map((s) => [s.id, s.name, s.lanes])
		).toEqual([
			[1, 'S1', [3]],
			[2, 'Unknown', []],
			[3, 'S3', [4]],
			[4, 'S4', []]
		]);
		expect(discovered(g, { whole: true, stars: false })).toHaveLength(4);
	});
});

describe('mapView', () => {
	// a chain 1–2–3–4–5: 1 visited, 2 and 3 within hyperlane detection range (Map the Stars), 4 and
	// 5 unknown; 1 has an explored wormhole to 9, which lies off the chain
	const g = [
		sys(1, [2], { lanesKnown: true, wormholes: [9] }),
		sys(2, [3], { visited: false, lanesKnown: true }),
		sys(3, [4], { visited: false, lanesKnown: true }),
		sys(4, [5], { visited: false }),
		sys(5, [], { visited: false }),
		sys(9, [], { visited: false, wormholes: [1] })
	];
	const none = { whole: false, stars: false };

	it('draws every lane of a system whose lanes we know, the systems at their ends faint', () => {
		const v = mapView(g, none);
		expect(v.map((s) => [s.id, s.name, s.known, s.lanes])).toEqual([
			[1, 'S1', true, [2]],
			[2, 'Unknown', false, [3]],
			[3, 'Unknown', false, [4]],
			[4, 'Unknown', false, []]
		]);
	});

	it('shows where explored wormholes lead, unless switched off', () => {
		const v = mapView(g, { ...none, wormholes: true });
		expect(v.find((s) => s.id === 1)?.wormholes).toEqual([9]);
		expect(v.some((s) => s.id === 9)).toBe(true);
		expect(mapView(g, none).find((s) => s.id === 1)?.wormholes).toEqual([]);
	});
});

describe('mainNetwork', () => {
	it('leaves out systems off the largest hyperlane network, which the game reveals by a trigger', () => {
		// 1–2–3 connected; 4–5 a pocket of their own; 6 with no lane (Ultima Vigilis, Kleeia)
		const g = [sys(1, [2]), sys(2, [3]), sys(3, []), sys(4, [5]), sys(5, []), sys(6, [])];
		expect([...mainNetwork(g)].sort()).toEqual([1, 2, 3]);
		const shown = discovered(
			g.map((s) => ({ ...s, visited: s.id === 1 })),
			{ whole: false, stars: true }
		).map((s) => s.id);
		expect(shown).toEqual([1, 2, 3]);
	});
});
