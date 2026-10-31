import { describe, expect, it } from 'vitest';
import type { GalaxySystem, GameData } from '#lib/types.ts';
import { systemInfo } from './systemInfo.ts';

const body = (id: number, extra = {}) => ({
	id,
	name: `B${id}`,
	class: 'pc_barren',
	size: 10,
	star: false,
	moonOf: null,
	ownerId: null,
	colonized: false,
	deposits: [] as string[],
	anomaly: null,
	dist: 1,
	surveyed: true,
	...extra
});
const sys = (bodies: ReturnType<typeof body>[] | null): GalaxySystem => ({
	id: 1,
	name: 'Sol',
	x: 0,
	y: 0,
	star: 'sc_g',
	lanes: [],
	visited: true,
	owned: false,
	ownerId: null,
	bodies,
	megastructures: []
});
const data = {
	costs: {
		deposit: {
			d_energy_3: { cost: {}, upkeep: {}, produces: { energy: 3 } },
			d_motes_1: { cost: {}, upkeep: {}, produces: { volatile_motes: 1 } }
		}
	},
	depositCategories: {
		d_energy_3: 'orbital_mining_deposits',
		d_motes_1: 'orbital_mining_deposits'
	},
	planetClasses: { pc_arid: { name: 'Arid', colonizable: true } },
	resourceInfo: { energy: { name: 'Energy' } }
} as unknown as GameData;

describe('systemInfo', () => {
	it('lists what a waystation would collect, by module, and a pre-FTL civilisation to study', () => {
		const e = systemInfo(
			sys([
				body(1, { deposits: ['d_energy_3'] }),
				body(2, { deposits: ['d_motes_1'], class: 'pc_arid', ownerId: 7 })
			]),
			'waystation',
			data,
			[{ id: 7, name: 'Primitives', type: 'primitive' } as never]
		);
		expect(e.facts).toEqual([
			'Energy +3/month (energy module) — B1',
			'volatile motes +1/month (refinery module) — B2',
			'Pre-FTL civilisation on B2 (Primitives): a research module can study it',
			'2 bodies'
		]);
	});

	it('hides the deposits of unsurveyed bodies, as the game does, but for the spoiler', () => {
		const s = sys([body(1, { deposits: ['d_energy_3'], surveyed: false })]);
		expect(systemInfo(s, 'outpost', data, []).facts[0]).toBe('No station deposits.');
		expect(systemInfo(s, 'outpost', data, [], true).facts[0]).toBe('Energy +3/month — B1');
	});

	it('says so when the system was not visited', () => {
		expect(systemInfo(sys(null), 'outpost', data, []).description).toMatch(/Not visited/);
	});
});
