import { describe, expect, it } from 'vitest';
import { cardFor, cardsForEmpire, type CardVariants } from './empireCards.ts';
import type { Trigger } from './triggers.ts';
import type { Explanation, GameData, Snapshot } from './types.ts';
import { upgrade } from './upgrade.ts';

const wild: Trigger = { leaf: 'is_wilderness_empire', value: 'yes' };
const tame: Trigger = { leaf: 'is_wilderness_empire', value: 'no' };
// 4.6 tech_power_hub_2, Planetary Power Grid (data DB technology_unlock)
const GRID: Explanation & CardVariants = {
	title: 'Planetary Power Grid',
	description: null,
	modifiers: [],
	text: 'Unlocks Building: Chloroplastic Cyst\nUnlocks Building: Energy Nexus',
	facts: ['physics, tier 3'],
	lines: [
		{ line: 'Unlocks Building: Chloroplastic Cyst', when: wild },
		{ line: 'Unlocks Building: Energy Nexus', when: tame }
	]
};
const CENTER: Explanation & CardVariants = {
	title: 'Augmentation Center',
	description: null,
	modifiers: [],
	text: null,
	facts: ['costs 800 minerals', 'upkeep 8 energy per month', 'jobs: 2 Augmentor'],
	costOf: { source: 'building', key: 'building_augmentation_center' }
};

describe('cardFor', () => {
	it('leaves out the lines of other empires, keeps the unknown', () => {
		expect(cardFor(GRID, (t) => t === tame, null).text).toBe('Unlocks Building: Energy Nexus');
		expect(cardFor(GRID, () => null, null).text).toBe(GRID.text);
	});
	it('writes the cost facts from the empire’s costs', () => {
		const costs = {
			building: {
				building_augmentation_center: {
					cost: { rare_crystals: 80 },
					upkeep: { energy: 8 },
					produces: {}
				}
			}
		} as unknown as GameData['costs'];
		const c = cardFor(CENTER, () => true, costs);
		expect(c.facts).toEqual([
			'costs 80 rare crystals',
			'upkeep 8 energy per month',
			'jobs: 2 Augmentor'
		]);
		expect('costOf' in c).toBe(false);
	});
});

describe('cardsForEmpire', () => {
	const data = {
		costs: { district: {}, ship: {}, building: {}, deposit: {}, module: {}, starbaseBuilding: {} },
		scriptedTriggers: {},
		shipKinds: {}
	} as unknown as GameData;
	const all = { 'tech:tech_power_hub_2': GRID };
	const save = upgrade({
		kind: 'save',
		campaign: 'c',
		date: '2250.01.01',
		origin: 'origin_default'
	} as Partial<Snapshot> & Pick<Snapshot, 'kind' | 'campaign' | 'date'>);

	it('shows a settled empire the Energy Nexus alone', () => {
		expect(cardsForEmpire(all, data, save)['tech:tech_power_hub_2'].text).toBe(
			'Unlocks Building: Energy Nexus'
		);
	});
	it('is the card set itself without a snapshot', () => {
		expect(cardsForEmpire(all, data, null)).toBe(all);
	});
});
