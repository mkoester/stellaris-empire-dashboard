import { describe, expect, it } from 'vitest';
import { contactRows, discovered, monthsBetween, stationOwners } from './situations.ts';
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
		expect(discovered(g, false, [4]).map((s) => [s.id, s.lanes])).toEqual([
			[1, [3]],
			[3, [4]],
			[4, []]
		]);
		expect(discovered(g, true)).toHaveLength(4);
	});
});
