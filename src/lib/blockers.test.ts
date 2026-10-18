import { describe, expect, it } from 'vitest';
import { blockerHints } from './blockers.ts';

const info = {
	d_great_pacific_garbage_patch: {
		days: 120,
		cost: { energy: 300 },
		prerequisites: [],
		natural: false
	},
	d_active_volcano: {
		days: 270,
		cost: { energy: 1000 },
		prerequisites: ['tech_volcano'],
		natural: true
	},
	d_toxic_kelp: { days: 180, cost: { energy: 500 }, prerequisites: [], natural: true }
};
const effects = {
	'deposit:d_great_pacific_garbage_patch': [{ key: 'planet_max_districts_add', value: -1 }],
	'deposit:d_active_volcano': [{ key: 'planet_max_districts_add', value: -2 }],
	'deposit:d_toxic_kelp': [{ key: 'planet_max_districts_add', value: -1 }]
};
const colony = (
	name: string,
	deposits: [string, string | null][],
	room: number | null,
	more = {}
) => ({
	planetId: name.length,
	name,
	planet: { deposits: deposits.map(([key, swap]) => ({ key, swap })), modifiers: [] },
	room,
	buildings: [],
	queued: [],
	...more
});

describe('blockerHints', () => {
	it('lists each blocker with its gain and cost, colonies at their limit first', () => {
		const h = blockerHints(
			[
				colony('Mars', [['d_toxic_kelp', null]], 3),
				colony(
					'Earth',
					[
						['d_great_pacific_garbage_patch', 'd_pacific_algae_tracts'],
						['d_minerals_3', null]
					],
					0
				)
			],
			info,
			effects,
			[]
		);
		expect(h.map((x) => [x.colony, x.blocker, x.districts, x.atLimit])).toEqual([
			['Earth', 'd_great_pacific_garbage_patch', 1, true],
			['Mars', 'd_toxic_kelp', 1, false]
		]);
		expect(h[0]).toMatchObject({
			feature: 'd_pacific_algae_tracts',
			days: 120,
			cost: { energy: 300 }
		});
	});

	it('puts what cannot be cleared yet last, and what is being cleared after that', () => {
		const h = blockerHints(
			[
				colony('Venus', [['d_active_volcano', null]], 0),
				colony('Io', [['d_toxic_kelp', null]], 0, { buildings: ['building_ranger_lodge'] }),
				colony('Earth', [['d_great_pacific_garbage_patch', null]], 0, {
					queued: ['d_great_pacific_garbage_patch']
				}),
				colony('Mars', [['d_toxic_kelp', null]], 2)
			],
			info,
			effects,
			[]
		);
		expect(h.map((x) => [x.colony, x.missing, x.lodge, x.clearing])).toEqual([
			['Mars', [], false, false],
			['Venus', ['tech_volcano'], false, false],
			['Io', [], true, false],
			['Earth', [], false, true]
		]);
		expect(
			blockerHints([colony('Venus', [['d_active_volcano', null]], 0)], info, effects, [
				'tech_volcano'
			])[0].missing
		).toEqual([]);
	});
});
