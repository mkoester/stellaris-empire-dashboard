import { describe, expect, it } from 'vitest';
import {
	contactRows,
	discovered,
	mainNetwork,
	mapView,
	monthsBetween,
	stationOwners,
	surveyView
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
			agreements: [],
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

	it('shows a wormhole once both ends are visited, every pair only as a spoiler', () => {
		// 1 visited, 9 not: Phiroza and Eye of Bal at 2207.03.10, never jumped through
		expect(mapView(g, { ...none, wormholes: true }).find((s) => s.id === 1)?.wormholes).toEqual([]);
		const both = g.map((s) => (s.id === 9 ? { ...s, visited: true } : s));
		expect(mapView(both, { ...none, wormholes: true }).find((s) => s.id === 1)?.wormholes).toEqual([
			9
		]);
		expect(mapView(both, none).find((s) => s.id === 1)?.wormholes).toEqual([]);
		const pairs = mapView(g, { ...none, wormholePairs: true });
		expect(pairs.find((s) => s.id === 1)?.wormholes).toEqual([9]);
		expect(pairs.find((s) => s.id === 9)?.known).toBe(false);
	});
});

describe('surveyView', () => {
	const planet = (id: number, surveyed: boolean) => ({
		id,
		name: `P${id}`,
		class: 'pc_barren',
		size: 10,
		star: false,
		moonOf: null,
		ownerId: null,
		colonized: false,
		deposits: [],
		anomaly: 'battle',
		dist: 10,
		surveyed
	});
	const g = [
		sys(1, [], { bodies: [planet(1, true), planet(2, false)] }),
		sys(2, [], { visited: false, bodies: [planet(3, false)] })
	];
	it('hides the bodies of unvisited systems and anomalies on unsurveyed planets', () => {
		const v = surveyView(g, false);
		expect(v[0].bodies?.map((b) => b.anomaly)).toEqual(['battle', null]);
		expect(v[1].bodies).toBeNull();
	});
	it('shows everything as if surveyed with the spoiler', () => {
		expect(surveyView(g, true)).toEqual(g);
	});
});

describe('mapView and L-Gates', () => {
	// 1 visited; 5 an L-Gate far off; 8 and 9 the L-Cluster (spawned once open), the gate linked to 8
	const g = [
		sys(1, [2], { lanesKnown: true }),
		sys(2, [], { visited: false }),
		sys(5, [], { visited: false, lgate: true, lgateTo: [8] }),
		sys(8, [9], { visited: false, lcluster: true }),
		sys(9, [], { visited: false, lcluster: true })
	];
	const none = { whole: false, stars: false };
	it('reveals every L-Gate and the L-Cluster, named and linked, only with the spoiler', () => {
		expect(mapView(g, none).map((s) => s.id)).toEqual([1, 2]);
		const v = mapView(g, { ...none, lgates: true });
		expect(v.map((s) => [s.id, s.name, s.lgates, s.lanes])).toEqual([
			[1, 'S1', [], [2]],
			[2, 'Unknown', [], []],
			[5, 'S5', [8], []],
			[8, 'S8', [], [9]],
			[9, 'S9', [], []]
		]);
	});

	it('links every gate to the predicted L-Cluster before it exists', () => {
		const closed = g.filter((s) => !s.lcluster).map((s) => ({ ...s, lgateTo: [] }));
		const v = mapView(closed, { ...none, lgates: true });
		expect(v.find((s) => s.id === 5)?.lgates).toEqual([-1]);
		expect(v.at(-1)).toMatchObject({ id: -1, known: false });
		expect(Math.hypot(v.at(-1)!.x, v.at(-1)!.y)).toBeCloseTo(555);
		expect(mapView(closed, none).some((s) => s.id === -1)).toBe(false);
	});

	it('keeps an L-Gate’s name when the unknown stars are shown too', () => {
		const v = mapView(g, { whole: false, stars: true, lgates: true });
		expect(v.find((s) => s.id === 5)?.name).toBe('S5');
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
