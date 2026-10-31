import { describe, expect, it } from 'vitest';
import { mapMarkers, parseMapFilter } from './mapLayers.ts';
import type { GalaxySystem } from './types.ts';

const sys = (id: number, s: Partial<GalaxySystem> = {}): GalaxySystem => ({
	id,
	name: `S${id}`,
	x: 0,
	y: 0,
	star: 'sc_g',
	lanes: [],
	visited: true,
	owned: false,
	ownerId: null,
	bodies: [],
	megastructures: [],
	bypasses: [],
	...s
});
const none = {
	contacts: [],
	anomalies: [],
	digSites: [],
	projects: [],
	anomalyNames: {},
	seen: []
};

describe('mapMarkers', () => {
	it('sorts structures into gateways, megastructures and ruins', () => {
		// 2207.03.10: Durabbius has a ruined gateway, listed both as megastructure and bypass
		const galaxy = [
			sys(1, { megastructures: ['gateway_ruined'], bypasses: ['gateway'] }),
			sys(2, { megastructures: ['dyson_sphere_permanently_ruined', 'think_tank_4'] }),
			sys(3, { bypasses: ['wormhole'] })
		];
		expect(mapMarkers({ ...none, galaxy }).map((m) => [m.layer, m.systemId, m.label])).toEqual([
			['gateways', 1, 'gateway (ruined)'],
			['ruins', 2, 'dyson sphere (beyond repair)'],
			['megastructures', 2, 'think tank 4'],
			['wormholes', 3, 'wormhole']
		]);
	});

	it("marks Wanderlust's targets where we have been, or every one with the spoiler", () => {
		const progress = {
			categories: [{ key: 'enclave', seen: 1, count: 13, done: false }],
			visits: [{ systemId: 1, system: 'S1', date: '2205.02.11', categories: ['enclave'] }],
			complete: false
		};
		const galaxy = [
			sys(1, { wanderlust: ['enclave'] }),
			sys(2, { wanderlust: ['marauder', 'space_ecology'] }),
			sys(3, { wanderlust: ['precursor'], visited: false }), // not been there: a spoiler
			sys(4)
		];
		const marks = (all: boolean) =>
			mapMarkers({ ...none, galaxy, wanderlust: { progress, all } }).map((m) => [
				m.systemId,
				m.label,
				m.progress
			]);
		expect(marks(false)).toEqual([
			[1, 'Enclave Systems', 'counted 2205.02.11'],
			[2, 'Marauder Systems, Space Ecology', 'not yet by an arkship']
		]);
		expect(marks(true).map(([id]) => id)).toEqual([1, 2, 3]);
		expect(mapMarkers({ ...none, galaxy, wanderlust: null })).toEqual([]); // without the perk
	});

	it('leaves out what lies outside the systems shown', () => {
		const anomalies = [{ planetId: 1, planet: 'P', systemId: 9, category: 'x' }];
		expect(mapMarkers({ ...none, galaxy: [sys(1)], anomalies })).toEqual([]);
	});

	it('tells whether a contact or dig site is worked on, and how far it is', () => {
		const contacts = [
			{
				id: 1,
				countryId: 7,
				name: 'Helvan Assembly',
				systemId: 1,
				leaderId: 4,
				leaderName: 'Envoy',
				date: '2207.01.01',
				daysLeft: 41.5,
				difficulty: 4,
				clues: 3,
				stage: 'first_contact_stage_2',
				status: 'in_progress'
			}
		];
		const [m] = mapMarkers({ ...none, galaxy: [sys(1)], contacts });
		expect([m.ongoing, m.progress]).toEqual([true, 'first contact stage 2, 3 clues, 42 days left']);
	});
});

describe('parseMapFilter', () => {
	it('keeps known layers only', () => {
		expect(parseMapFilter({ hidden: ['ruins', 'nonsense'] })).toEqual({ hidden: ['ruins'] });
	});
});
