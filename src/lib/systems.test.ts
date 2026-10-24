import { describe, expect, it } from 'vitest';
import {
	allocate,
	breakEven,
	jumps,
	ledger,
	outpostInfluence,
	outpostMults,
	saveHistory,
	systemHistory,
	systemSpending,
	type SystemData
} from './systems.ts';
import type { KnownSystem, Snapshot } from './types.ts';

const c = (cost = {}, upkeep = {}, produces = {}) => ({ cost, upkeep, produces });
const data: SystemData = {
	costs: {
		ship: {
			starbase_outpost: c({ alloys: 100 }, { energy: 1 }),
			starbase_starport: c({ alloys: 250 }, { energy: 2 }),
			mining_station: c({ minerals: 100 }, { energy: 1 })
		},
		module: { solar_panel_network: c({ alloys: 50 }, {}, { energy: 6 }) },
		starbaseBuilding: { crew_quarters: c({ alloys: 50 }, { energy: 1 }) },
		deposit: { d_minerals_2: c({}, {}, { minerals: 2 }), d_minerals_4: c({}, {}, { minerals: 4 }) }
	},
	depositCategory: {
		d_minerals_2: 'orbital_mining_deposits',
		d_minerals_4: 'orbital_mining_deposits'
	},
	defines: { EXPANSION_COST_BASE: 75, EXPANSION_COST_DISTANCE: 75, EXPANSION_COST_MAX: 1000 }
};

// Sol (1, capital) – Alpha (2) – Barnard (3) in a row
const known = (owned: number[]): KnownSystem[] =>
	[1, 2, 3].map((id) => ({
		id,
		name: `S${id}`,
		x: 0,
		y: 0,
		owned: owned.includes(id),
		capital: id === 1,
		lanes: id < 3 ? [id + 1] : []
	}));

const station = (
	systemId: number,
	level: string,
	modules: string[] = [],
	buildings: string[] = []
) => ({
	id: systemId * 10,
	system: `S${systemId}`,
	systemId,
	level,
	modules,
	buildings,
	queue: [],
	slots: 1,
	shipyard: null,
	arkship: false
});

const snap = (date: string, fields: Partial<Snapshot>) =>
	({
		kind: 'save',
		date,
		colonies: [],
		budget: null,
		construction: null,
		orbitalStations: null,
		stations: [],
		knownSystems: known([1]),
		...fields
	}) as unknown as Snapshot;

describe('jumps and the outpost estimate', () => {
	it('counts hyperlane jumps from the nearest owned system', () => {
		expect(jumps(known([1]), new Set([1]), 3)).toBe(2);
		expect(jumps(known([1]), new Set([2]), 3)).toBe(1);
	});
	it('charges the base for a neighbour, one step per further jump, capped', () => {
		expect(outpostInfluence(1, data.defines)).toBe(75);
		expect(outpostInfluence(3, data.defines)).toBe(225);
		expect(outpostInfluence(40, data.defines)).toBe(1000);
	});
	it('applies the empire’s cost modifiers (game, Planetforgers 2212.03.05: 67 … 337, 90 alloys)', () => {
		const s = {
			traditions: ['tr_expansion_adopt', 'tr_expansion_reach_for_the_stars'],
			ascensionPerks: [],
			policies: { diplomatic_stance: 'diplo_stance_expansionist' }
		} as unknown as Snapshot;
		const mult = outpostMults(s);
		expect(mult.alloys).toBeCloseTo(0.9);
		expect([1, 2, 3, 4, 5].map((j) => outpostInfluence(j, data.defines, mult.influence))).toEqual([
			67, 135, 202, 270, 337
		]);
		expect(
			outpostMults({
				traditions: null,
				ascensionPerks: null,
				policies: null
			} as unknown as Snapshot)
		).toEqual({
			influence: 1,
			alloys: 1
		});
	});
});

describe('allocate', () => {
	it('splits a booked total by base share, keeps the base without a budget', () => {
		const parts = [
			{ systemId: 1, source: 'starbases', side: 'upkeep' as const, base: { energy: 2 } },
			{ systemId: 2, source: 'starbases', side: 'upkeep' as const, base: { energy: 1 } }
		];
		const booked = allocate(parts, [{ source: 'starbases', income: {}, expenses: { energy: 6 } }]);
		expect(booked.get(1)?.upkeep).toEqual({ energy: 4 });
		expect(booked.get(2)?.upkeep).toEqual({ energy: 2 });
		expect(allocate(parts, null).get(1)?.upkeep).toEqual({ energy: 2 });
	});
});

describe('ledger', () => {
	it('books stations to their system, scaled to the budget', () => {
		const s = snap('2210.01.01', {
			knownSystems: known([1, 2]),
			stations: [station(1, 'starport', ['solar_panel_network']), station(2, 'outpost')],
			orbitalStations: [
				{ systemId: 2, planetId: 20, deposits: ['d_minerals_2'] },
				{ systemId: 2, planetId: 21, deposits: ['d_minerals_4'] }
			],
			budget: [
				{ source: 'orbital_mining_deposits', income: { minerals: 9 }, expenses: {} },
				{ source: 'starbase_modules', income: { energy: 6 }, expenses: {} }
			]
		});
		const l = ledger(s, data, null);
		expect(l.get(2)?.income).toEqual({ minerals: 9 });
		expect(l.get(1)?.income).toEqual({ energy: 6 });
		// no `starbases` source booked: the base upkeep stands
		expect(l.get(1)?.upkeep.energy).toBe(2);
	});
	it('adds colonies on request', () => {
		const s = snap('2210.01.01', {
			colonies: [{ planetId: 5, produces: { food: 10 }, upkeep: { energy: 3 } }] as never
		});
		expect(ledger(s, data, new Map([[5, 1]])).get(1)).toEqual({
			income: { food: 10 },
			upkeep: { energy: 3 }
		});
	});
});

describe('systemSpending', () => {
	const history = [
		snap('2205.01.01', { stations: [station(1, 'starport')] }),
		snap('2205.02.01', {
			knownSystems: known([1, 2]),
			stations: [station(1, 'starport'), station(2, 'outpost')]
		}),
		snap('2205.03.01', {
			knownSystems: known([1, 2]),
			stations: [station(1, 'starport'), station(2, 'starport', ['solar_panel_network'])],
			orbitalStations: [{ systemId: 2, planetId: 20, deposits: ['d_minerals_2'] }]
		})
	];
	it('prices outposts, upgrades, modules and stations; the capital’s start is free', () => {
		const spends = systemSpending(history, data, false);
		expect(spends.map((x) => [x.date, x.systemId, x.label])).toEqual([
			['2205.02.01', 2, 'outpost'],
			// the save before lists no stations: it borrows the later listing
			['2205.02.01', 2, 'mining_station'],
			['2205.03.01', 2, 'starport'],
			['2205.03.01', 2, 'solar_panel_network']
		]);
		expect(spends[0].cost).toEqual({ alloys: 100, influence: 75 });
	});
	it('lets the outpost cost modifier cover the starport upgrade (game: 225 of 250)', () => {
		const stance = { policies: { diplomatic_stance: 'diplo_stance_expansionist' } };
		const withStance = history.map((s) => ({ ...s, ...stance }) as Snapshot);
		const starport = systemSpending(withStance, data, false).find((x) => x.label === 'starport');
		expect(starport?.cost.alloys).toBeCloseTo(225);
	});
	it('takes exact construction items when both saves list them', () => {
		const exact = [
			snap('2205.01.01', { knownSystems: known([1, 2]), construction: [] }),
			snap('2205.02.01', {
				knownSystems: known([1, 2]),
				construction: [
					{
						id: 1,
						kind: 'starbase_module',
						name: 'solar_panel_network',
						where: 'S2',
						systemId: 2,
						cost: { alloys: 40 }
					},
					{ id: 2, kind: 'ship', name: 'corvette', where: 'S2', systemId: 2, cost: { alloys: 30 } },
					{
						id: 3,
						kind: 'district',
						name: 'district_city',
						where: 'P',
						systemId: 2,
						cost: { minerals: 500 }
					}
				]
			})
		];
		const later = systemSpending(exact, data, true).filter((x) => x.date === '2205.02.01');
		expect(later.map((x) => [x.label, x.cost, x.colony])).toEqual([
			['solar_panel_network', { alloys: 40 }, false],
			['district_city (P)', { minerals: 500 }, true]
		]);
		expect(systemSpending(exact, data, false).filter((x) => x.colony)).toEqual([]);
	});
});

describe('saveHistory', () => {
	it('fills a save without a station list from the nearest one, to the systems it owned', () => {
		const listing = [
			{ systemId: 1, planetId: 10, deposits: ['d_minerals_2'] },
			{ systemId: 2, planetId: 20, deposits: ['d_minerals_2'] }
		];
		const h = saveHistory([
			snap('2205.01.01', {}),
			snap('2205.02.01', { knownSystems: known([1, 2]), orbitalStations: listing }),
			snap('2205.03.01', { knownSystems: known([1, 2]) })
		]);
		expect(h.map((s) => s.orbitalStations?.map((o) => o.planetId))).toEqual([
			[10],
			[10, 20],
			[10, 20]
		]);
		// no station counted twice across the gaps
		expect(
			systemSpending(h, data, false)
				.filter((x) => x.label.startsWith('mining'))
				.map((x) => [x.date, x.label])
		).toEqual([
			['2205.01.01', 'mining_station (before history)'],
			['2205.02.01', 'mining_station']
		]);
	});
});

describe('systemHistory and breakEven', () => {
	it('accumulates one-offs, upkeep and output month by month', () => {
		const h = [
			snap('2205.01.01', {}),
			snap('2205.02.01', { knownSystems: known([1, 2]), stations: [station(2, 'outpost')] }),
			snap('2205.04.01', {
				knownSystems: known([1, 2]),
				stations: [station(2, 'outpost')],
				orbitalStations: [{ systemId: 2, planetId: 20, deposits: ['d_minerals_4'] }]
			})
		];
		const p = systemHistory(h, data, null).get(2)!;
		expect(p.map((x) => x.date)).toEqual(['2205.02.01', '2205.04.01']);
		// the station borrowed back to the outpost's save: both paid then, then three months of
		// both upkeeps and the station's output
		expect(p[0].invested).toEqual({ alloys: 100, influence: 75, minerals: 100, energy: 2 });
		expect(p[1].invested).toEqual({ alloys: 100, influence: 75, minerals: 100, energy: 6 });
		expect(p[1].earned).toEqual({ minerals: 12 });
	});
	it('says when earnings catch up', () => {
		expect(breakEven(100, 40, 20)).toBe(3);
		expect(breakEven(100, 120, 0)).toBe(0);
		expect(breakEven(100, 40, -1)).toBeNull();
	});
});
