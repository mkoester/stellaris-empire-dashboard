import { describe, expect, it } from 'vitest';
import {
	decisionCost,
	decisionModifiers,
	decisionPossible,
	planetTrigger,
	type PlanetDecision,
	type PlanetFacts
} from './planetDecisions.ts';
import type { Facts } from './triggers.ts';

const facts = { government: [], countryType: 'default' } as unknown as Facts;
const planet: PlanetFacts = {
	modifiers: ['bleak_planet'],
	designation: 'col_mining',
	planetClass: 'pc_desert',
	pops: 4200,
	capital: false
};
const tier = (lo: number, hi: number, cg: number) => ({
	when: {
		op: 'and' as const,
		args: [
			{ leaf: 'pop_amount', cmp: '>=', value: String(lo) },
			{ leaf: 'pop_amount', cmp: '<', value: String(hi) }
		]
	},
	cost: { consumer_goods: cg }
});
const luxuries: PlanetDecision = {
	key: 'decision_planet_luxuries_boost',
	name: 'Distribute Luxury Goods',
	costs: [tier(3000, 4000, 400), tier(4000, 5000, 500)],
	potential: { op: 'not', args: [{ leaf: 'has_designation', value: 'col_nanotech_world' }] },
	allow: { op: 'not', args: [{ leaf: 'has_modifier', value: 'planet_luxuries_boost' }] },
	adds: [{ modifier: 'planet_luxuries_boost', days: 3600 }],
	removes: []
};

describe('planetTrigger', () => {
	it('answers the planet’s own leaves and leaves the rest', () => {
		expect(planetTrigger({ leaf: 'has_modifier', value: 'bleak_planet' }, planet)).toEqual({
			leaf: 'always',
			value: 'yes'
		});
		expect(planetTrigger({ leaf: 'is_capital', value: 'no' }, planet)).toEqual({
			leaf: 'always',
			value: 'yes'
		});
		expect(planetTrigger({ leaf: 'free_housing', cmp: '>', value: '0' }, planet)).toEqual({
			leaf: 'free_housing',
			cmp: '>',
			value: '0'
		});
	});
});

describe('decisions on a colony', () => {
	it('picks the cost tier by pops', () => {
		expect(decisionCost(luxuries, planet, facts)).toEqual({ consumer_goods: 500 });
	});
	it('is not possible while its modifier runs', () => {
		expect(decisionPossible(luxuries, planet, facts)).toBe(true);
		expect(
			decisionPossible(luxuries, { ...planet, modifiers: ['planet_luxuries_boost'] }, facts)
		).toBe(false);
	});
	it('adds the static modifier’s modifiers, takes off a removed one the planet has', () => {
		const bleak = { ...luxuries, adds: [], removes: ['bleak_planet', 'not_here'] };
		const table: Record<string, Record<string, number>> = {
			planet_luxuries_boost: { planet_amenities_mult: 0.25 },
			bleak_planet: { pop_happiness: -0.1 }
		};
		const of = (k: string) => table[k] ?? {};
		expect(decisionModifiers(luxuries, planet, of)).toEqual({ planet_amenities_mult: 0.25 });
		expect(decisionModifiers(bleak, planet, of)).toEqual({ pop_happiness: 0.1 });
	});
});
