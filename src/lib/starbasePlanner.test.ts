import { describe, expect, it } from 'vitest';
import {
	atStarbase,
	partAvailable,
	partInSystem,
	planStarbases,
	type PlannerSystem,
	type StarbasePart
} from './starbasePlanner.ts';
import type { Facts, Trigger } from './triggers.ts';

const facts = (techs: string[] = [], perks: string[] = []): Facts => ({
	countryType: 'default',
	government: [],
	origin: 'origin_default',
	governmentType: null,
	dlcs: null,
	policyFlags: [],
	countryFlags: [],
	traditions: [],
	perks,
	techs,
	atWar: false,
	situations: 0,
	nomadic: false,
	// as the data DB's scripted_trigger holds it (4.5.3)
	scripted: { is_wilderness_empire: { leaf: 'has_origin', value: 'origin_wilderness' } }
});
const slots = {
	outpost: { modules: 0, buildings: 0 },
	starport: { modules: 2, buildings: 1 },
	starhold: { modules: 4, buildings: 2 }
};
const and = (...args: Trigger[]): Trigger => ({ op: 'and', args });
const or = (...args: Trigger[]): Trigger => ({ op: 'or', args });
const leaf = (l: string, value = 'yes', cmp?: string): Trigger =>
	cmp ? { leaf: l, value, cmp } : { leaf: l, value };

// transit_hub (4.5.3 00_starbase_buildings.txt) as the data DB holds it, its possible shortened
const transitHub: StarbasePart = {
	key: 'transit_hub',
	kind: 'building',
	name: 'Transit Hub',
	category: 'sm_colony_cat',
	potential: and(
		leaf('exists', 'owner'),
		and(leaf('has_technology', 'tech_hyper_drive_2'), leaf('is_wilderness_empire', 'no')),
		or(leaf('is_normal_starbase'), leaf('is_orbital_ring'))
	),
	possible: or(leaf('has_starbase_size', 'starbase_starport', '>='), leaf('is_orbital_ring')),
	modifiers: [{ scope: 'system', key: 'planet_resettlement_unemployed_mult', value: 2, when: null }]
};
// astromining_bay, two triggered variants by Archaeo-Engineers
const astromining: StarbasePart = {
	key: 'astromining_bay',
	kind: 'module',
	name: 'Astromining Bay',
	category: null,
	potential: leaf('is_normal_starbase'),
	possible: null,
	modifiers: [
		{
			scope: 'system',
			key: 'station_gatherers_produces_mult',
			value: 1,
			when: { op: 'not', args: [leaf('has_ascension_perk', 'ap_archaeoengineers')] }
		},
		{
			scope: 'system',
			key: 'station_gatherers_produces_mult',
			value: 1.5,
			when: leaf('has_ascension_perk', 'ap_archaeoengineers')
		}
	]
};
const ringOnly: StarbasePart = {
	key: 'ring_thing',
	kind: 'building',
	name: 'Ring Thing',
	category: null,
	potential: leaf('is_orbital_ring'),
	possible: null,
	modifiers: [{ scope: 'system', key: 'planet_stability_add', value: 5, when: null }]
};

const system = (over: Partial<PlannerSystem>): PlannerSystem => ({
	id: 1,
	name: 'Sol',
	jumps: 0,
	station: { level: 'starport', modules: ['shipyard'], buildings: [] },
	colonies: [],
	deposits: { gatherers: {}, researchers: {} },
	deposited: { total: 0, worked: 0 },
	...over
});

describe('atStarbase', () => {
	it('answers the starbase leaves and compares the level', () => {
		expect(atStarbase(transitHub.possible, 'outpost')).toEqual(
			or(leaf('always', 'no'), leaf('always', 'no'))
		);
		expect(atStarbase(transitHub.possible, 'starhold')).toEqual(
			or(leaf('always', 'yes'), leaf('always', 'no'))
		);
	});
});

describe('partAvailable', () => {
	it('follows the empire’s techs, unwrapped from owner = { … }', () => {
		expect(partAvailable(transitHub, facts())).toBe(false);
		expect(partAvailable(transitHub, facts(['tech_hyper_drive_2']))).toBe(true);
	});
	it('drops orbital-ring-only parts', () => {
		expect(partAvailable(ringOnly, facts())).toBe(false);
	});
});

describe('partInSystem', () => {
	const f = facts(['tech_hyper_drive_2']);
	const earth = { name: 'Earth', pops: 4000, civilians: 300, growth: 12, stability: 70 };
	const mars = { name: 'Mars', pops: 800, civilians: 0, growth: 4, stability: 45 };

	it('ranks the Transit Hub by the pops a system can push out', () => {
		const s = partInSystem(transitHub, system({ colonies: [earth, mars] }), f, slots)!;
		expect(s.score).toBe(316);
		expect(s.reasons[0]).toContain('300 civilians');
		expect(s.reasons[0]).toContain('most: Earth +12');
		expect(s.needs).toEqual([]);
	});
	it('needs a colony to do anything', () => {
		expect(partInSystem(transitHub, system({}), f, slots)).toBeNull();
	});
	it('names what has to happen first', () => {
		const out = partInSystem(transitHub, system({ station: null, colonies: [earth] }), f, slots)!;
		expect(out.needs).toEqual(['an outpost', 'upgrade to starport']);
		const full = partInSystem(
			transitHub,
			system({
				colonies: [earth],
				station: { level: 'starport', modules: [], buildings: ['crew_quarters'] }
			}),
			f,
			slots
		)!;
		expect(full.needs).toEqual(['a free building slot']);
	});
	it('skips a part already built there', () => {
		const s = system({
			colonies: [earth],
			station: { level: 'starport', modules: [], buildings: ['transit_hub'] }
		});
		expect(partInSystem(transitHub, s, f, slots)).toBeNull();
	});
	it('multiplies the orbital deposits by the variant the empire has', () => {
		const s = system({
			deposits: { gatherers: { minerals: 6, energy: 4 }, researchers: { physics_research: 3 } },
			deposited: { total: 3, worked: 2 }
		});
		const plain = partInSystem(astromining, s, f, slots)!;
		expect(plain.score).toBe(10);
		expect(plain.reasons[0]).toContain('stations on 2 of 3 deposits');
		const ae = partInSystem(astromining, s, facts([], ['ap_archaeoengineers']), slots)!;
		expect(ae.score).toBe(15);
	});
});

describe('planStarbases', () => {
	it('ranks systems per part and leaves out what the empire cannot have', () => {
		const plan = planStarbases(
			{ transit_hub: transitHub, ring_thing: ringOnly },
			[
				system({
					id: 1,
					colonies: [{ name: 'A', pops: 100, civilians: 5, growth: 1, stability: 60 }]
				}),
				system({
					id: 2,
					colonies: [{ name: 'B', pops: 100, civilians: 50, growth: 3, stability: 60 }]
				})
			],
			facts(['tech_hyper_drive_2']),
			slots
		);
		expect(plan.map((p) => p.part.key)).toEqual(['transit_hub']);
		expect(plan[0].best.map((s) => s.systemId)).toEqual([2, 1]);
	});
});
