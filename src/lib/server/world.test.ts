import { describe, expect, it } from 'vitest';
import { stationsSeen } from './world.ts';

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
