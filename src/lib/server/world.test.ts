import { describe, expect, it } from 'vitest';
import {
	body,
	claims,
	digSites,
	relations,
	stationsSeen,
	storms,
	eventChains,
	surveyedPlanets,
	wormholeLinks
} from './world.ts';

describe('stationsSeen', () => {
	// shaped like 2207.03.01: fleets in `fleet.<id>.movement_manager.coordinate.origin`, a system's
	// `starbases` (4294967295 = none), the station ship's fleet in its owner's owned_fleets
	const raw = {
		countryId: 0,
		country: { fleets_manager: { owned_fleets: [{ fleet: 1 }, { fleet: 2 }, { fleet: 3 }] } },
		fleets: {
			'1': { movement_manager: { coordinate: { origin: 380 } } }, // Sol, ours
			'2': { movement_manager: { coordinate: { origin: 12 } } }, // Edellimar, no station
			'3': { movement_manager: { coordinate: { origin: 77 } } } // a foreign station
		},
		systems: {
			'380': { starbases: [0] },
			'12': { starbases: [4294967295] },
			'77': { starbases: [5] }
		},
		starbases: { '0': { station: 100 }, '5': { station: 105 } },
		ships: { '100': { fleet: 50 }, '105': { fleet: 55 } },
		fleetOwner: { '50': 0, '55': 16777220 },
		countries: {
			'16777220': {
				name: 'Helvan Assembly',
				type: 'default',
				shipset: 'avian_01',
				ethics: [],
				authority: null,
				civics: [],
				governmentType: null,
				origin: null
			}
		}
	};

	it('records the shipset of other empires’ stations where our fleets are', () => {
		expect(stationsSeen(raw, new Set([380]))).toEqual([
			{ systemId: 77, ownerId: 16777220, shipset: 'avian_01' }
		]);
	});
});

describe('wormholeLinks', () => {
	// two natural wormholes linked to each other, and a gateway (not a wormhole)
	const bypasses = [
		{ id: 6, type: 'wormhole', active: true, system: 10, links: [7] },
		{ id: 7, type: 'wormhole', active: true, system: 20, links: [6] },
		{ id: 8, type: 'gateway', active: false, system: 30, links: [6] }
	];
	it('links both ends of every wormhole pair, gateways left out', () => {
		expect([...wormholeLinks(bypasses)]).toEqual([
			[10, [20]],
			[20, [10]]
		]);
	});
});

describe('relations', () => {
	it('lists the pacts and other yes-flags of each relation as its agreements', () => {
		// 4.5.2, a throwaway game at 2200.05.01 (jomini reads `yes` as true)
		const [r] = relations({
			rivalsOfUs: [16777222],
			countries: { '16777222': { name: 'Karkato Accord' } },
			country: {
				relations_manager: {
					relation: [
						{
							owner: 0,
							country: 16777222,
							contact: true,
							defensive_pact: true,
							embassy: true,
							border_range: 396,
							trust: 50.85,
							communications: true,
							relation_current: 210
						}
					]
				}
			}
		} as never);
		expect(r).toMatchObject({
			name: 'Karkato Accord',
			opinion: 210,
			trust: 50.85,
			borderRange: 396,
			agreements: ['defensive_pact', 'embassy', 'rivals_us']
		});
	});
});

describe('claims', () => {
	// 4.5.2, the throwaway game at 2205.07.16: we claim Rasalas, an AI claims our capital system;
	// a claim between two AIs stays hidden, as in the game
	const raw = {
		countryId: 0,
		countries: { '0': { name: 'UNE' }, '7': { name: 'Blorg' }, '8': { name: 'Tzynn' } } as never,
		systems: {
			'104': {
				name: { key: 'Rasalas' },
				starbases: [5],
				claims: [{ owner: 0, date: '2205.07.01', claims: 1 }]
			},
			'1': { name: { key: 'Sol' }, claims: [{ owner: 7, date: '2205.07.01', claims: 2 }] },
			'9': { name: { key: 'Vega' }, claims: [{ owner: 8, date: '2205.07.01', claims: 1 }] }
		},
		starbases: { '5': { station: 105 } },
		ships: { '105': { fleet: 55 } },
		fleetOwner: { '55': 7 }
	};

	it('lists ours and those on our systems, with the holder and the strength', () => {
		expect(claims(raw, new Set([1]))).toEqual([
			{
				systemId: 1,
				system: 'Sol',
				holder: null,
				claimant: 'Blorg',
				ours: false,
				claims: 2,
				since: '2205.07.01'
			},
			{
				systemId: 104,
				system: 'Rasalas',
				holder: 'Blorg',
				claimant: 'UNE',
				ours: true,
				claims: 1,
				since: '2205.07.01'
			}
		]);
	});
});

describe('body', () => {
	it('marks a station on a deposit (shaped like 2207.04.02: Mars mined, planet 109 not)', () => {
		const raw = {
			countryId: 0,
			deposits: { '17': { type: 'd_minerals_3' }, '172': { type: 'd_energy_2' } },
			planets: {
				'4': {
					name: { key: 'NAME_Mars' },
					planet_class: 'pc_barren',
					deposits: [17],
					surveyed_by: [0],
					shipclass_orbital_station: 251
				},
				'109': {
					name: { key: 'NAME_X' },
					planet_class: 'pc_barren',
					deposits: [172],
					surveyed_by: 0
				}
			}
		};
		expect(body(raw, 4)).toMatchObject({
			deposits: ['d_minerals_3'],
			surveyed: true,
			station: true
		});
		expect(body(raw, 109)).toMatchObject({
			deposits: ['d_energy_2'],
			surveyed: true,
			station: false
		});
	});
	it('counts the home system surveyed: listed in surveyed_deposit_holders, not in surveyed_by', () => {
		const raw = {
			countryId: 0,
			deposits: { '2': { type: 'd_minerals_2' } },
			planets: { '2': { name: { key: 'NAME_Dutchen' }, planet_class: 'pc_broken', deposits: [2] } },
			country: {
				surveyed_deposit_holders: [
					{ type: 0, id: 2 },
					{ type: 2, id: 7 }
				]
			}
		};
		expect(body(raw, 2)?.surveyed).toBe(false);
		expect(body(raw, 2, surveyedPlanets(raw))?.surveyed).toBe(true);
		expect([...surveyedPlanets(raw)]).toEqual([2]);
	});
});

describe('digSites', () => {
	// shaped like 2226.08.01: 4294967295 = no excavator; another empire's fleet digs at a site we see
	const site = (fleet: number) => ({
		type: 'omnirelic_site',
		location: { type: 'planet', id: 7 },
		clues: 1,
		difficulty: 4,
		days_left: 51.5,
		index: 0,
		excavator_fleet: fleet
	});
	const raw = {
		countryId: 0,
		archSites: { 1: site(4), 2: site(42), 3: site(4294967295) },
		planets: { 7: { coordinate: { origin: 5 } } },
		fleetOwner: { 4: 0, 42: 16777227 }
	};
	it('marks a site excavated only by a fleet of ours', () => {
		expect(digSites(raw as never, new Set([5])).map((d) => [d.id, d.excavating])).toEqual([
			[1, true],
			[2, false],
			[3, false]
		]);
	});
});

describe('storms', () => {
	it('reads a storm, its name, the systems it covers and the path ahead', () => {
		// Roaming Cybergang 2226.08.01, trimmed; `2=none` is a storm gone
		const raw = {
			countryId: 16777234,
			storms: {
				'1': {
					type: 'magnetic_storm',
					storm_current_path_index: 2,
					speed: 0.02,
					storm_days_till_next_system: 2438,
					cluster: { objects: [27, 598, 800] },
					name: { key: 'HUM1_CHR_Shibbala' },
					prefix: { key: 'STORM_PREFIX_7' },
					path: [534, 609, 800, 598, 196],
					affected_country_ids: [16777234, 36]
				},
				'2': 'none'
			}
		};
		expect(storms(raw)).toEqual([
			{
				id: 1,
				type: 'magnetic_storm',
				name: 'Hurricane Shibbala',
				systems: [27, 598, 800],
				path: [598, 196],
				daysToNext: 2438,
				speed: 0.02,
				affectsUs: true
			}
		]);
		expect(storms({ ...raw, countryId: 0 })[0].affectsUs).toBe(false);
	});
});

describe('eventChains', () => {
	it('reads running chains with their counters and the completed ones', () => {
		// Roaming Cybergang 2226.08.01 (l_cluster_chain without a counter: 0 clues), another
		// empire's shrouded chain (counter 1)
		const country = {
			event_chain: [
				{ event_chain: 'l_cluster_chain', scope: { type: 'country', id: 0 } },
				{ event_chain: 'cybrex_chain', counter: { cybrex_artifacts: 3 } }
			],
			completed_event_chain: [
				'nomad_checklist_chain',
				'contract_colony_startup_chain',
				'contract_colony_startup_chain'
			]
		};
		expect(eventChains({ country })).toEqual({
			active: [
				{ key: 'l_cluster_chain', counters: {} },
				{ key: 'cybrex_chain', counters: { cybrex_artifacts: 3 } }
			],
			completed: ['nomad_checklist_chain', 'contract_colony_startup_chain']
		});
		expect(eventChains({ country: {} })).toEqual({ active: [], completed: [] });
	});
});
