import { describe, expect, it } from 'vitest';
import type { StarbasePart } from './starbasePlanner.ts';
import type { Facts, Trigger } from './triggers.ts';
import type { GalaxySystem } from './types.ts';
import {
	atWaystation,
	bestModules,
	chainTo,
	collectionPoint,
	modulePicks,
	neighbours,
	networks,
	siteDeposits,
	tierOf,
	touches,
	trouble,
	unlicensed,
	waystationModules
} from './waylines.ts';

const facts = (techs: string[] = []): Facts => ({
	countryType: 'default',
	government: [],
	origin: null,
	governmentType: null,
	dlcs: null,
	policyFlags: [],
	countryFlags: [],
	traditions: [],
	perks: [],
	techs,
	atWar: false,
	situations: 1,
	nomadic: true
});
const leaf = (l: string, value = 'yes'): Trigger => ({ leaf: l, value });
const and = (...args: Trigger[]): Trigger => ({ op: 'and', args });

// as the data DB holds them (4.5.4 00_waystation_modules.txt), modifiers shortened
const part = (
	key: string,
	potential: Trigger | null,
	modifiers: StarbasePart['modifiers'] = []
): StarbasePart => ({
	key,
	kind: 'module',
	name: key.replace('waystation_', ''),
	category: 'sm_economy_cat',
	potential,
	possible: null,
	modifiers
});
const PARTS: Record<string, StarbasePart> = {
	waystation_energy_module: part(
		'waystation_energy_module',
		and(leaf('exists', 'owner'), leaf('is_waystation_starbase'))
	),
	waystation_mining_module: part(
		'waystation_mining_module',
		and(leaf('exists', 'owner'), leaf('is_waystation_starbase'))
	),
	waystation_refinery_module: part(
		'waystation_refinery_module',
		and(leaf('has_technology', 'tech_nomads_mechanized_mining'), leaf('is_waystation_starbase'))
	),
	waystation_hydroponics_module: part(
		'waystation_hydroponics_module',
		and(leaf('is_waystation_starbase'), leaf('has_technology', 'tech_hydroponics')),
		[{ scope: 'station', key: 'starbase_collected_system_food_add', value: 10, when: null }]
	),
	waystation_resource_silo: part('waystation_resource_silo', leaf('is_waystation_starbase'), [
		{ scope: 'waystation_network_country', key: 'country_resource_max_add', value: 500, when: null }
	]),
	starport_shipyard: { ...part('shipyard', leaf('is_normal_starbase')), key: 'shipyard' }
};
const worth = (r: string) => ({ minerals: 1, energy: 1, rare_crystals: 10 })[r] ?? 1;

const sys = (id: number, lanes: number[], extra: Partial<GalaxySystem> = {}): GalaxySystem => ({
	id,
	name: `S${id}`,
	x: 0,
	y: 0,
	star: 'sc_g',
	lanes,
	visited: true,
	owned: false,
	ownerId: null,
	bodies: [],
	megastructures: [],
	...extra
});

describe('atWaystation', () => {
	it('answers the starbase leaves for a waystation', () => {
		expect(atWaystation(leaf('is_waystation_starbase'))).toEqual(leaf('always'));
		expect(atWaystation(leaf('is_normal_starbase'))).toEqual(leaf('always', 'no'));
		expect(atWaystation(leaf('has_technology', 'x'))).toEqual(leaf('has_technology', 'x'));
	});
});

describe('waystationModules', () => {
	it('keeps waystation modules the empire may build, drops the rest', () => {
		const keys = waystationModules(PARTS, facts()).map((m) => m.part.key);
		expect(keys).toContain('waystation_energy_module');
		expect(keys).not.toContain('waystation_refinery_module'); // tech missing
		expect(keys).not.toContain('shipyard');
		expect(
			waystationModules(PARTS, facts(['tech_nomads_mechanized_mining'])).map((m) => m.part.key)
		).toContain('waystation_refinery_module');
	});
});

describe('siteDeposits', () => {
	it('sums surveyed, uncolonised orbital deposits only', () => {
		const s = sys(1, [], {
			bodies: [
				{ id: 1, deposits: ['d_min', 'd_land'], surveyed: true, colonized: false },
				{ id: 2, deposits: ['d_min'], surveyed: false, colonized: false },
				{ id: 3, deposits: ['d_min'], surveyed: true, colonized: true }
			].map((b) => ({
				...b,
				name: '',
				class: 'pc_barren',
				size: 10,
				star: false,
				moonOf: null,
				ownerId: null,
				anomaly: null,
				dist: 0
			}))
		});
		const out = siteDeposits(s, {
			depositCategory: { d_min: 'orbital_mining_deposits', d_land: 'deposit_cat_rare' },
			produces: (d): Record<string, number> => (d === 'd_min' ? { minerals: 3 } : { energy: 9 })
		});
		expect(out).toEqual({ minerals: 3 });
	});
});

describe('modulePicks', () => {
	const mods = waystationModules(
		PARTS,
		facts(['tech_nomads_mechanized_mining', 'tech_hydroponics'])
	);
	it('ranks collectors by what the deposits are worth, at the tier factor', () => {
		const picks = modulePicks(
			{ minerals: 8, rare_crystals: 2, energy: 4 },
			mods,
			facts(),
			worth,
			1
		);
		expect(picks.map((p) => p.key).slice(0, 4)).toEqual([
			'waystation_refinery_module', // 2 crystals × 0.75 × 10 = 15
			'waystation_hydroponics_module', // 10 food × 0.75 = 7.5
			'waystation_mining_module', // 8 minerals × 0.75 = 6
			'waystation_energy_module' // 4 energy × 0.75 = 3
		]);
		expect(picks.find((p) => p.key === 'waystation_mining_module')?.collects).toEqual({
			minerals: 6
		});
	});
	it('skips a collector with nothing to collect here', () => {
		const picks = modulePicks({ minerals: 8 }, mods, facts(), worth, 3);
		expect(picks.map((p) => p.key)).not.toContain('waystation_energy_module');
		expect(picks.find((p) => p.key === 'waystation_mining_module')?.collects).toEqual({
			minerals: 10
		});
	});
	it('values a wayline module once per wayline', () => {
		const has = (onLine?: Set<string>) =>
			modulePicks({ minerals: 8 }, mods, facts(), worth, 1, [], onLine).some(
				(p) => p.key === 'waystation_resource_silo'
			);
		expect(has()).toBe(true);
		expect(has(new Set(['waystation_resource_silo']))).toBe(false);
	});
	it('fills the free slots, built modules left out', () => {
		const picks = modulePicks({ minerals: 8, energy: 4 }, mods, facts(), worth, 1, [
			'waystation_mining_module'
		]);
		expect(bestModules(picks, 1).map((p) => p.key)).toEqual(['waystation_hydroponics_module']);
	});
});

describe('networks', () => {
	// 1 - 2 - 3 - 4 - 5, and 3 - 6
	const next = neighbours([sys(1, [2]), sys(2, [3]), sys(3, [4, 6]), sys(4, [5]), sys(5, [])]);
	it('joins neighbouring waystations into one wayline', () => {
		expect(networks(next, [1, 2, 3])).toEqual([[1, 2, 3]]);
	});
	it('splits at a gap', () => {
		expect(networks(next, [1, 2, 4, 5])).toEqual([
			[1, 2],
			[4, 5]
		]);
	});
	it('tells which waylines a new waystation would join', () => {
		const lines = networks(next, [1, 2, 4, 5]);
		expect(touches(next, lines, 3)).toEqual([0, 1]); // links both
		expect(touches(next, lines, 6)).toEqual([]);
	});
	it('plans the chain to a system from the nearest wayline', () => {
		expect(chainTo(next, [1], 5)).toEqual([2, 3, 4]);
		expect(chainTo(next, [1, 4], 6)).toEqual([3]);
		expect(chainTo(next, [1], 1)).toEqual([]);
		expect(chainTo(next, [], 5)).toBeNull();
		expect(chainTo(next, [1], 5, new Set([3]))).toBeNull(); // the only way is taken
	});
	it('collects where the others are fewest jumps away', () => {
		expect(collectionPoint(next, [1, 2, 3, 4, 5])).toBe(3);
		expect(collectionPoint(next, [])).toBeNull();
	});
});

describe('trouble', () => {
	const me = 0;
	it('flags another empire’s space without a pact', () => {
		expect(trouble(sys(1, [], { ownerId: 7 }), me, new Set())).toEqual({
			kind: 'unlicensed',
			ownerId: 7
		});
		expect(trouble(sys(1, [], { ownerId: 7 }), me, new Set([7])).kind).toBe('pact');
		expect(trouble(sys(1, []), me, new Set()).kind).toBe('none');
	});
	it('names a waystation someone else holds', () => {
		expect(trouble(sys(1, [], { waystation: 9 }), me, new Set())).toEqual({
			kind: 'taken',
			ownerId: 9
		});
		expect(trouble(sys(1, [], { waystation: me }), me, new Set()).kind).toBe('none');
	});
	it('counts the opinion per empire, down to the floor', () => {
		const systems = Array.from({ length: 25 }, (_, i) => sys(i, [], { ownerId: 7 }));
		const ids = systems.map((s) => s.id);
		expect(unlicensed(systems, ids.slice(0, 3), me, new Set()).get(7)).toEqual({
			count: 3,
			opinion: -30
		});
		expect(unlicensed(systems, ids, me, new Set()).get(7)?.opinion).toBe(-200);
		expect(unlicensed(systems, ids, me, new Set([7])).size).toBe(0);
	});
});

describe('tierOf', () => {
	it('reads the tier from the level', () => {
		expect(tierOf('waystation_1')).toBe(1);
		expect(tierOf('starbase_level_waystation_3')).toBe(3);
		expect(tierOf('outpost')).toBe(1);
	});
});
