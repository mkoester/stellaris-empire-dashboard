import { describe, expect, it } from 'vitest';
import { body, claims, relations, stationsSeen, wormholeLinks } from './world.ts';

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
});
