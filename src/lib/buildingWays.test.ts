import { describe, expect, it } from 'vitest';
import { buildingNeeds, ownSituations, type WayData } from './buildingWays.ts';
import { facts } from './government.ts';
import type { Trigger } from './triggers.ts';
import type { Snapshot } from './types.ts';
import { upgrade } from './upgrade.ts';

// 4.6 building_augmentation_center's potential (data DB building.potential_json)
const CENTER: Trigger = {
	op: 'or',
	args: [
		{ leaf: 'has_country_flag', value: 'augmentation_center_available' },
		{ leaf: 'has_active_tradition', value: 'tr_cybernetics_augmentation_centers' },
		{ leaf: 'has_active_tradition', value: 'tr_cybernetics_assimilator_augmentation_centers' }
	]
};
const machineAge: Trigger = { leaf: 'host_has_dlc', value: 'The Machine Age' };
const DATA: WayData = {
	techs: {},
	perks: {},
	traditionTrees: {
		tr_cybernetics: {
			name: 'Cybernetics',
			traditions: [
				{ key: 'tr_cybernetics_augmentation_overload', name: 'Augmentation Overload', role: '' }
			]
		},
		tr_cybernetics_assimilator: {
			name: 'Cybernetics',
			potential: { leaf: 'has_valid_civic', value: 'civic_machine_assimilator' },
			traditions: [
				{
					key: 'tr_cybernetics_assimilator_augmentation_centers',
					name: 'Augmentation Centers',
					role: ''
				}
			]
		}
	},
	traditionSwaps: {
		tr_cybernetics_augmentation_overload: [
			{
				id: 'tr_cybernetics_augmentation_overload#0',
				key: 'tr_cybernetics_augmentation_centers',
				name: 'Augmentation Centers',
				// without The Machine Age, not a hive
				trigger: { op: 'not', args: [machineAge] },
				inherit: false
			}
		]
	},
	situationTypes: {
		situation_cyberization: { name: 'Cyberization', category: null, approaches: {}, stages: [] }
	},
	stageFlags: {
		augmentation_center_available: [{ situation: 'situation_cyberization', stage: 'Stage II' }]
	}
} as unknown as WayData;

const empire = (o: Partial<Snapshot>) =>
	facts(
		upgrade({ kind: 'save', campaign: 'c', date: '2250.01.01', ...o } as Partial<Snapshot> &
			Pick<Snapshot, 'kind' | 'campaign' | 'date'>)
	);

describe('buildingNeeds', () => {
	it('with The Machine Age: the Cyberization stage, neither tradition', () => {
		const n = buildingNeeds(
			CENTER,
			DATA,
			empire({ dlcs: ['The Machine Age'], government: ['auth_democratic'] })
		);
		expect(n.now).not.toBe(true);
		expect(n.impossible).toBe(false);
		expect(n.ways).toEqual(['Cyberization, Stage II']);
	});
	it('without it: the swapped tradition too, never the assimilators’', () => {
		const n = buildingNeeds(CENTER, DATA, empire({ dlcs: [], government: ['auth_democratic'] }));
		expect(n.ways).toEqual([
			'Cyberization, Stage II',
			'the tradition Augmentation Centers (Cybernetics)'
		]);
	});
	it('a flag several situations set: the one the empire runs', () => {
		const two = {
			...DATA,
			situationTypes: {
				...DATA.situationTypes,
				situation_creed: {
					name: 'The Conclave of Fusion',
					category: null,
					approaches: {},
					stages: []
				}
			},
			stageFlags: {
				augmentation_center_available: [
					{ situation: 'situation_cyberization', stage: 'Stage II' },
					{ situation: 'situation_creed', stage: 'Stage VI' }
				]
			}
		} as WayData;
		const f = empire({ dlcs: ['The Machine Age'] });
		expect(buildingNeeds(CENTER, two, f).ways).toEqual([
			'Cyberization, Stage II or The Conclave of Fusion, Stage VI'
		]);
		expect(buildingNeeds(CENTER, two, f, ['situation_cyberization']).ways).toEqual([
			'Cyberization, Stage II'
		]);
	});
	it('nothing to say once the flag is set', () => {
		const n = buildingNeeds(
			CENTER,
			DATA,
			empire({ countryFlags: ['augmentation_center_available'] })
		);
		expect(n).toEqual({ now: true, ways: [], impossible: false });
	});
	it('impossible when every way needs what the empire lacks', () => {
		const civic: Trigger = { leaf: 'has_valid_civic', value: 'civic_x' };
		const n = buildingNeeds(civic, DATA, empire({ government: ['auth_democratic'] }));
		expect(n.impossible).toBe(true);
	});
});

describe('ownSituations', () => {
	it('running, seen, and the ascensions the empire can still start', () => {
		const d = {
			perks: {},
			traditionTrees: {
				tradition_cybernetics: {
					name: 'Cybernetics',
					traditions: [
						{ key: 'tr_cybernetics_adopt', name: 'Cybernetic Traditions', role: 'adopt' }
					]
				},
				tradition_synthetics: {
					name: 'Synthetics',
					potential: { leaf: 'is_machine_empire', value: 'yes' },
					traditions: [{ key: 'tr_synthetics_adopt', name: 'Synthetic Traditions', role: 'adopt' }]
				}
			}
		} as unknown as WayData;
		const f = empire({ government: ['auth_democratic'] });
		const got = ownSituations(
			{ situations: [{ type: 'situation_nomad_economy' }] as never },
			['x'],
			d,
			f
		);
		expect(got).toEqual([
			'situation_nomad_economy',
			'x',
			'situation_cyberization',
			'situation_cyberization_hive'
		]);
	});
});
