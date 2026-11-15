import { describe, expect, it } from 'vitest';
import { byKey, byKind, hasAscensionPath } from './gamedata.ts';
import { parseTrigger } from '#lib/triggers.ts';

describe('byKind', () => {
	it('groups rows by key and kind, also for the ship size named `constructor`', () => {
		expect(
			byKind([
				{ key: 'constructor', kind: 'cost', resource: 'alloys', amount: 60 },
				{ key: 'constructor', kind: 'upkeep', resource: 'energy', amount: 1 },
				{ key: 'mining_station', kind: 'cost', resource: 'minerals', amount: 100 }
			])
		).toEqual({
			constructor: { cost: { alloys: 60 }, upkeep: { energy: 1 }, produces: {} },
			mining_station: { cost: { minerals: 100 }, upkeep: {}, produces: {} }
		});
	});
});

describe('byKey', () => {
	it('groups rows by key, also for a key named like an Object property', () => {
		expect(
			byKey([
				{ key: 'district_mining', name: 'miner', amount: 200 },
				{ key: 'constructor', name: 'x', amount: 1 }
			])
		).toEqual({ district_mining: { miner: 200 }, constructor: { x: 1 } });
	});
});

describe('perkTrees', () => {
	it("reads the perks a tree's adoption asks for", async () => {
		const { perkTrees } = await import('./gamedata.ts');
		expect(
			perkTrees([
				{
					category_key: 'tradition_cybernetics',
					possible_json:
						'{"op":"or","args":[{"leaf":"has_ascension_perk","value":"ap_the_flesh_is_weak"},{"leaf":"has_ascension_perk","value":"ap_organo"}]}'
				},
				{ category_key: 'tradition_x', possible_json: null }
			])
		).toEqual({
			ap_the_flesh_is_weak: ['tradition_cybernetics'],
			ap_organo: ['tradition_cybernetics']
		});
	});
});

describe('hasAscensionPath', () => {
	it('finds ascension gates in nested tree availability triggers', () => {
		expect(
			hasAscensionPath(
				parseTrigger(
					'{"op":"and","args":[{"leaf":"is_hive_empire","value":"yes"},{"leaf":"has_genetic_ascension","value":"yes"}]}'
				)
			)
		).toBe(true);
		expect(hasAscensionPath(parseTrigger('{"leaf":"is_hive_empire","value":"yes"}'))).toBe(false);
		expect(hasAscensionPath(null)).toBe(false);
	});
});
