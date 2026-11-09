import { describe, expect, it } from 'vitest';
import { designLabel, designStats, designStatus, type ShipParts } from './designStats.ts';
import type { ShipDesign } from './types.ts';

// UNE 6 2208.01.01's Cheetah corvette with the 4.5.3 data DB's values, shortened
const parts: ShipParts = {
	sizes: {
		corvette: {
			name: 'Corvette',
			hitpoints: 200,
			speed: 160,
			modifiers: { ship_evasion_add: 60 },
			resources: { upkeep: { energy: 1, alloys: 0.5 } }
		}
	},
	sections: {
		CORVETTE_MID_S2PD1: { modifiers: {}, resources: { cost: { alloys: 40 } } }
	},
	components: {
		SMALL_MASS_DRIVER_1: {
			name: 'Small Mass Driver',
			kind: 'weapon',
			size: 'small',
			power: -5,
			modifiers: {},
			weapon: {
				min_damage: 5,
				max_damage: 16,
				cooldown: 20,
				range: 50,
				accuracy: 0.75,
				tracking: 0.5
			},
			resources: { cost: { alloys: 10 } }
		},
		SMALL_ARMOR_1: {
			name: 'Small Nanocomposite Armor',
			kind: 'utility',
			size: 'small',
			power: 0,
			modifiers: { ship_armor_add: 100 },
			weapon: null,
			resources: { cost: { alloys: 5 } }
		},
		CORVETTE_FISSION_REACTOR: {
			name: 'Fission Reactor',
			kind: 'utility',
			size: 'small',
			power: 75,
			modifiers: {},
			weapon: null,
			resources: { cost: { alloys: 10 } }
		},
		SHIP_THRUSTER_1: {
			name: 'Chemical Thrusters',
			kind: 'utility',
			size: 'small',
			power: -5,
			modifiers: { ship_speed_mult: 0.1, ship_evasion_add: 5 },
			weapon: null,
			resources: {}
		}
	}
};

const design = (over: Partial<ShipDesign> = {}): ShipDesign => ({
	id: 2451,
	name: 'Cheetah',
	size: 'corvette',
	role: 'screen',
	sections: [
		{
			template: 'CORVETTE_MID_S2PD1',
			slot: 'mid',
			components: [
				{ slot: 'SMALL_GUN_02', template: 'SMALL_MASS_DRIVER_1' },
				{ slot: 'SMALL_GUN_03', template: 'SMALL_MASS_DRIVER_1' },
				{ slot: 'SMALL_UTILITY_1', template: 'SMALL_ARMOR_1' }
			]
		}
	],
	required: ['CORVETTE_FISSION_REACTOR', 'SHIP_THRUSTER_1'],
	saved: true,
	autoGen: true,
	ships: 10,
	upgradeTo: null,
	...over
});

describe('designStats', () => {
	const s = designStats(design(), parts);
	it('adds the parts up', () => {
		expect(s.missing).toEqual([]);
		expect(s.hull).toBe(200);
		expect(s.armor).toBe(100);
		expect(s.evasion).toBe(65);
		expect(s.speed).toBeCloseTo(176);
		expect(s.powerMax).toBe(75);
		expect(s.powerUsed).toBe(15);
		expect(s.cost).toEqual({ alloys: 75 });
		expect(s.upkeep).toEqual({ energy: 1, alloys: 0.5 });
	});
	it('groups weapons and compares them per cooldown', () => {
		expect(s.weapons).toHaveLength(1);
		expect(s.weapons[0]).toMatchObject({ name: 'Small Mass Driver', count: 2 });
		expect(s.damagePerCooldown).toBeCloseTo((2 * 10.5) / 20);
	});
	it('raises the reactor output by a booster', () => {
		const boosted = designStats(design({ required: ['CORVETTE_FISSION_REACTOR', 'BOOSTER'] }), {
			...parts,
			components: {
				...parts.components,
				BOOSTER: {
					name: 'Reactor Booster',
					kind: 'utility',
					size: 'aux',
					power: 0,
					modifiers: { ship_reactor_power_mult: 0.2 },
					weapon: null,
					resources: {}
				}
			}
		});
		expect(boosted.powerMax).toBe(90);
		expect(boosted.other).toEqual({});
	});
	it('lists unknown parts and leaves them out', () => {
		const m = designStats(design({ required: ['MODDED_REACTOR'] }), parts);
		expect(m.missing).toEqual(['MODDED_REACTOR']);
		expect(m.powerMax).toBe(0);
	});
});

describe('designLabel and designStatus', () => {
	it('puts the size before a bare suffix', () => {
		expect(designLabel({ name: 'III', size: 'mining_station' }, 'Mining Station')).toBe(
			'Mining Station III'
		);
		expect(designLabel({ name: '', size: 'x' }, 'Medium Military Station')).toBe(
			'Medium Military Station'
		);
		expect(designLabel({ name: 'Cheetah', size: 'corvette' }, 'Corvette')).toBe('Cheetah');
	});
	it('tells saved, unused and unofficial apart', () => {
		expect(designStatus({ saved: true, ships: 3 })).toBe('saved');
		expect(designStatus({ saved: true, ships: 0 })).toBe('unused');
		expect(designStatus({ saved: false, ships: 3 })).toBe('unofficial');
	});
});
