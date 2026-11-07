import { describe, expect, it } from 'vitest';
import { modName, modTechs, scriptedVariables, withModContent } from './modContent.ts';
import type { GameData } from './types.ts';

describe('scriptedVariables', () => {
	it('reads `@name = value` lines', () => {
		expect(scriptedVariables('@tier1cost1 = 1000\n  @tier2cost2 = 2500 # c\nfoo = 3')).toEqual({
			tier1cost1: 1000,
			tier2cost2: 2500
		});
	});
});

describe('modTechs', () => {
	// the Ancient Highway's two techs as jomini reads its common/technology/ahw_tech.txt
	const defs = {
		ahw_tech_gate_theory: {
			icon: 'tech_gateway_activation',
			cost: '@tier2cost2',
			area: 'physics',
			tier: 1,
			category: ['particles'],
			is_rare: true
		},
		ahw_tech_gate_construction: {
			cost: { factor: 1200 },
			area: 'engineering',
			tier: 1,
			category: 'voidcraft'
		},
		ahw_not_a_tech: 5
	};
	it('takes area, tier, field, rarity, the cost with variables resolved, the name from the texts', () => {
		expect(
			modTechs(defs, { tier2cost2: 2500 }, { ahw_tech_gate_theory: 'Highway Gate Theory' })
		).toEqual({
			ahw_tech_gate_theory: {
				name: 'Highway Gate Theory',
				cost: 2500,
				area: 'physics',
				tier: 1,
				category: 'particles',
				rare: true
			},
			ahw_tech_gate_construction: {
				name: 'ahw_tech_gate_construction',
				cost: 1200,
				area: 'engineering',
				tier: 1,
				category: 'voidcraft',
				rare: false
			}
		});
	});
	it('an unknown variable leaves the cost unknown', () => {
		expect(modTechs(defs, {}, {}).ahw_tech_gate_theory.cost).toBeNull();
	});
});

describe('withModContent', () => {
	it('adds the mods’ techs and texts; the data DB’s entries win', () => {
		const data = {
			techs: { tech_a: { name: 'A', cost: 1, area: 'physics', tier: 1 } }
		} as unknown as GameData;
		const out = withModContent(data, {
			text: { x: 'X' },
			techs: {
				tech_a: { name: 'mod A', cost: 9, area: 'physics', tier: 1 },
				ahw_t: { name: 'T', cost: 2, area: 'engineering', tier: 1 }
			}
		});
		expect(out.techs.tech_a.name).toBe('A');
		expect(out.techs.ahw_t.name).toBe('T');
		expect(modName(out, 'x')).toBe('X');
		expect(modName(out, 'x', 'from the DB')).toBe('from the DB');
		expect(modName(out, 'y')).toBe('y');
	});
});
