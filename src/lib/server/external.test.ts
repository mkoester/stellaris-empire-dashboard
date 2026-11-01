import { describe, expect, it } from 'vitest';
import { externalBuildings } from './save.ts';

// shaped like the Planetforgers' 2214.02.01 save (`colony.<id>.externally_owned_buildings`):
// we (0) are a MegaCorp with an office on empire 7's planet 20, empire 9 has one on ours
const raw = (authority: string) =>
	({
		countryId: 0,
		country: { capital: 1, government: { authority } },
		countries: {
			'0': { name: 'Us', type: 'default' },
			'7': { name: 'Seven', type: 'default' },
			'9': { name: 'Nine', type: 'default' },
			'5': { name: 'Pre-FTL', type: 'primitive' }
		},
		colonies: {
			'1': { carrier: { type: 'planet', reference: 10 }, produces: { trade: 30 } },
			'2': {
				carrier: { type: 'planet', reference: 20 },
				produces: { trade: 112.24 },
				externally_owned_buildings: [
					{ building_owner: 0, owner_type: 'corporate', buildings: [317] }
				]
			},
			'3': {
				carrier: { type: 'planet', reference: 11 },
				externally_owned_buildings: [{ building_owner: 9, owner_type: 'corporate', buildings: [] }]
			},
			'4': { carrier: { type: 'planet', reference: 30 }, produces: { trade: 50 } },
			'5': { carrier: { type: 'planet', reference: 40 }, produces: { trade: 5 } }
		},
		planets: {
			'10': { colony: 1, owner: 0, name: { key: 'Home' }, coordinate: { origin: 100 } },
			'11': { colony: 3, owner: 0, name: { key: 'Moon' }, coordinate: { origin: 100 } },
			'20': { colony: 2, owner: 7, name: { key: 'Far' }, coordinate: { origin: 102 } },
			'30': { colony: 4, owner: 7, name: { key: 'Near' }, coordinate: { origin: 101 } },
			'40': { colony: 5, owner: 5, name: { key: 'Cave' }, coordinate: { origin: 101 } }
		},
		ships: {},
		fleets: {},
		fleetOwner: {},
		buildings: { '317': { type: 'building_corporate_clinics' } },
		systems: {
			'100': { hyperlane: [{ to: 101 }] },
			'101': { hyperlane: [{ to: 100 }, { to: 102 }] },
			'102': { hyperlane: [{ to: 101 }] }
		}
	}) as unknown as Parameters<typeof externalBuildings>[0];

describe('externalBuildings', () => {
	it('lists the offices we hold and those on our colonies', () => {
		const { external } = externalBuildings(raw('auth_corporate'));
		expect(external!.map((e) => [e.colonyId, e.holder, e.owner, e.buildings])).toEqual([
			[2, 'Us', 'Seven', ['building_corporate_clinics']],
			[3, 'Nine', 'Us', []]
		]);
		expect(external![0].trade).toBe(112.24);
	});

	it('a MegaCorp gets every other regular empire’s colony with trade as a site', () => {
		const { branchSites } = externalBuildings(raw('auth_corporate'));
		expect(branchSites!.map((s) => [s.colonyId, s.jumps, s.office])).toEqual([
			[2, 2, 'Us'],
			[4, 1, null]
		]);
	});

	it('others get no sites', () => {
		expect(externalBuildings(raw('auth_democratic')).branchSites).toBeNull();
	});
});
