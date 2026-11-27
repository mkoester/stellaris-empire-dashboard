import { describe, expect, it } from 'vitest';
import { forEmpire, resolveCosts, type CostVariant } from './costs.ts';
import type { Trigger } from './triggers.ts';
import type { GameData, Snapshot } from './types.ts';
import { upgrade } from './upgrade.ts';

const nomadic: Trigger = { leaf: 'is_nomadic', value: 'yes' };
const settled: Trigger = { leaf: 'is_nomadic', value: 'no' };
// 4.6 building_augmentation_center (data DB resource_variant)
const AUGMENTATION: CostVariant[] = [
	{ kind: 'cost', block: 0, resource: 'minerals', amount: 800, when: settled },
	{ kind: 'cost', block: 1, resource: 'rare_crystals', amount: 80, when: nomadic }
];
const BASE = { cost: { minerals: 800 }, upkeep: { energy: 8 }, produces: {} };

describe('resolveCosts', () => {
	it('takes the blocks whose condition holds', () => {
		const nomad = (t: Trigger | null) => (t === nomadic ? true : t === settled ? false : true);
		expect(resolveCosts(BASE, AUGMENTATION, nomad)).toEqual({
			cost: { rare_crystals: 80 },
			upkeep: { energy: 8 },
			produces: {}
		});
	});
	it('sums an untriggered block and a surcharge that applies', () => {
		const megacorp: Trigger = { leaf: 'is_megacorp', value: 'yes' };
		const list: CostVariant[] = [
			{ kind: 'cost', block: 0, resource: 'minerals', amount: 100, when: null },
			{ kind: 'cost', block: 1, resource: 'energy', amount: 50, when: megacorp },
			{ kind: 'cost', block: 1, resource: 'minerals', amount: 10, when: megacorp }
		];
		expect(
			resolveCosts({ cost: { minerals: 100 }, upkeep: {}, produces: {} }, list, () => true).cost
		).toEqual({
			minerals: 110,
			energy: 50
		});
	});
	it('keeps the regular row when a condition cannot be told', () => {
		expect(resolveCosts(BASE, AUGMENTATION, () => null)).toEqual(BASE);
	});
});

describe('forEmpire', () => {
	const data = {
		costs: {
			district: {},
			ship: {},
			building: { building_augmentation_center: BASE, building_other: BASE },
			deposit: {},
			module: {},
			starbaseBuilding: {}
		},
		costVariants: { building: { building_augmentation_center: AUGMENTATION } },
		scriptedTriggers: {},
		shipKinds: {}
	} as unknown as GameData;
	const save = (situations: Snapshot['situations']) =>
		upgrade({ kind: 'save', campaign: 'c', date: '2250.01.01', situations } as Partial<Snapshot> &
			Pick<Snapshot, 'kind' | 'campaign' | 'date'>);

	it('gives a nomad the nomad cost, a settled empire the regular one', () => {
		const nomad = forEmpire(data, save([{ type: 'situation_nomad_economy' } as never]));
		expect(nomad.costs.building.building_augmentation_center.cost).toEqual({ rare_crystals: 80 });
		expect(nomad.costs.building.building_other).toBe(BASE);
		const regular = forEmpire(data, save([]));
		expect(regular.costs.building.building_augmentation_center.cost).toEqual({ minerals: 800 });
	});
	it('is the same data without a snapshot or without variants (an older data DB)', () => {
		expect(forEmpire(data, null)).toBe(data);
		const old = { ...data, costVariants: undefined };
		expect(forEmpire(old, save([]))).toBe(old);
	});
	it('reuses one result per answer pattern', () => {
		expect(forEmpire(data, save([]))).toBe(forEmpire(data, save([])));
	});
});
