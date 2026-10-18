import { describe, expect, it } from 'vitest';
import { candidates, scoreFill } from './megastructures.ts';
import type { Body, GalaxySystem, GameData } from './types.ts';

const body = (id: number, cls: string, b: Partial<Body> = {}): Body => ({
	id,
	name: `B${id}`,
	class: cls,
	size: 10,
	star: /_star$|black_hole|pulsar/.test(cls),
	moonOf: null,
	ownerId: null,
	colonized: false,
	deposits: [],
	anomaly: null,
	dist: 0,
	...b
});
const sys = (id: number, x: number, y: number, s: Partial<GalaxySystem> = {}): GalaxySystem => ({
	id,
	name: `S${id}`,
	x,
	y,
	star: 'sc_g',
	lanes: [],
	visited: true,
	owned: true,
	ownerId: 0,
	bodies: [],
	megastructures: [],
	...s
});
const data: Pick<GameData, 'planetClasses' | 'depositCategories'> = {
	planetClasses: {
		pc_continental: {
			name: 'Continental',
			colonizable: true,
			ideal: false,
			standard: true,
			climate: 'wet'
		},
		pc_molten: { name: 'Molten', colonizable: false, ideal: false, standard: false, climate: null },
		pc_barren: { name: 'Barren', colonizable: false, ideal: false, standard: false, climate: null }
	},
	depositCategories: {
		d_energy_5: 'orbital_mining_deposits',
		d_minerals_3: 'orbital_mining_deposits',
		d_physics_2: 'orbital_research_deposits'
	}
};
const none = new Map<number, number>();

describe('quantum catapult', () => {
	it('ranks pulsars and neutron stars by the farthest system on the map', () => {
		// a pulsar at the centre and a neutron star at the edge; the G star does not qualify
		const galaxy = [
			sys(1, 0, 0, { star: 'sc_pulsar' }),
			sys(2, 400, 0, { star: 'sc_neutron_star' }),
			sys(3, -100, 0)
		];
		const rows = candidates('quantum_catapult', galaxy, none, data);
		expect(rows.map((r) => [r.systemId, r.ok, r.score])).toEqual([
			[1, true, 400],
			[2, true, 500],
			[3, false, null]
		]);
		expect(rows[0].detail).toBe('in reach per stage: 2 / 3 / 3 of 3');
	});
});

describe('arc furnace', () => {
	it('counts bodies neither star nor colonizable without a research deposit, as the game does', () => {
		const s = sys(1, 0, 0, {
			bodies: [
				body(1, 'pc_g_star'),
				body(2, 'pc_molten'),
				body(3, 'pc_barren', { deposits: ['d_physics_2'] }),
				body(4, 'pc_barren', { deposits: ['d_minerals_3'] }),
				body(5, 'pc_continental')
			]
		});
		const [row] = candidates('arc_furnace', [s], none, data);
		expect([row.ok, row.score]).toEqual([true, 2]);
	});

	it('needs a molten planet, and is unknown where the bodies are', () => {
		const rows = candidates(
			'arc_furnace',
			[sys(1, 0, 0, { bodies: [body(1, 'pc_barren')] }), sys(2, 0, 0, { bodies: null })],
			none,
			data
		);
		expect(rows.map((r) => r.ok)).toEqual([false, null]);
	});
});

describe('ring world', () => {
	it('sums the deposits it would remove and refuses systems with colonizable planets', () => {
		const rows = candidates(
			'ring_world',
			[
				sys(1, 0, 0, {
					bodies: [
						body(1, 'pc_g_star', { deposits: ['d_energy_5'] }),
						body(2, 'pc_barren', { deposits: ['d_minerals_3'] })
					]
				}),
				sys(2, 0, 0, { bodies: [body(3, 'pc_g_star'), body(4, 'pc_continental')] })
			],
			none,
			data
		);
		expect(rows.map((r) => [r.ok, r.score])).toEqual([
			[true, 3],
			[false, null]
		]);
	});
});

describe('sentry array', () => {
	it('counts the systems not ours by hyperlane jumps, not by distance on the map', () => {
		// a chain 1–2–…–25 of systems 30 units apart: on the map none lies within 20 units of
		// system 1, by jumps 2…21 do; system 1 is ours and has a barren planet to build on
		const galaxy = Array.from({ length: 25 }, (_, i) =>
			sys(i + 1, i * 30, 0, {
				lanes: i < 24 ? [i + 2] : [],
				owned: i === 0,
				bodies: i === 0 ? [body(1, 'pc_g_star'), body(2, 'pc_barren')] : []
			})
		);
		const [row] = candidates('sentry_array', galaxy, none, data);
		expect(row.score).toBe(20);
		expect(row.detail).toBe('not ours within 20 / 40 / 60 jumps: 20 / 24 / 24 of 24');
	});
});

describe('scoreFill', () => {
	it('gives the best fitting system the darkest colour', () => {
		// the pulsar nearer the middle reaches the far end sooner
		const galaxy = [
			sys(1, 0, 0, { star: 'sc_pulsar' }),
			sys(2, 300, 0, { star: 'sc_pulsar' }),
			sys(3, 600, 0)
		];
		const fill = scoreFill(candidates('quantum_catapult', galaxy, none, data), true);
		expect(fill[2]).toBe('#08519c');
		expect(fill[1]).toBe('#c6dbef');
		expect(fill[3]).toBeUndefined();
	});
});
