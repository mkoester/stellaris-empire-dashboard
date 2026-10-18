import { describe, expect, it } from 'vitest';
import { estimate, habitabilityTier, livesOnPlanets } from './habitability.ts';

const data = {
	planetClasses: {
		pc_continental: {
			name: 'Continental',
			colonizable: true,
			ideal: false,
			standard: true,
			climate: 'wet'
		},
		pc_gaia: { name: 'Gaia', colonizable: true, ideal: true, standard: false, climate: null },
		pc_hive: { name: 'Hive', colonizable: true, ideal: true, standard: false, climate: null }
	},
	habitability: {
		traits: {
			trait_pc_continental_preference: {
				pc_continental_habitability: 0.8,
				pc_ocean_habitability: 0.6,
				pc_desert_habitability: 0.2
			},
			trait_adaptive: { pop_environment_tolerance: 0.1 },
			trait_hivemind: { pc_hive_habitability: 1 },
			trait_robust: { habitability_floor_add: 0.5 }
		},
		planet: { 'modifier:unstable_tectonics': -0.1 }
	}
};
const humans = ['trait_pc_continental_preference', 'trait_adaptive'];
const planet = (modifiers: string[]) => ({
	deposits: [],
	modifiers: modifiers.map((key) => ({ key, until: null }))
});

describe('estimate', () => {
	it('adds the climate preference and tolerance (Alpha Centauri: 90%)', () => {
		expect(estimate('pc_continental', humans, null, data)).toBeCloseTo(0.9);
		expect(estimate('pc_ocean', humans, null, data)).toBeCloseTo(0.7);
		expect(estimate('pc_desert', humans, planet(['unstable_tectonics']), data)).toBeCloseTo(0.2);
	});
	it('gives ideal classes 100% unless a trait sets the class itself', () => {
		expect(estimate('pc_gaia', humans, null, data)).toBe(1);
		expect(estimate('pc_hive', ['trait_hivemind'], null, data)).toBe(1);
		expect(estimate('pc_barren', humans, null, data)).toBe(0); // Mars: tolerance does not lift 0
	});
	it('respects the floor and stays within 0–100%', () => {
		expect(estimate('pc_barren', ['trait_robust'], null, data)).toBe(0.5);
		expect(estimate('pc_barren', [], planet(['unstable_tectonics']), data)).toBe(0);
	});
});

describe('tiers and who it applies to', () => {
	const defines = { HABITABILITY_WRONG_PLANET: 0.7, HABITABILITY_OPPOSITE_PLANET: 0.4 };
	it('colours as the game does', () => {
		expect([0.9, 0.7, 0.6, 0.4, 0.2].map((v) => habitabilityTier(v, defines))).toEqual([
			'good',
			'good',
			'wrong',
			'wrong',
			'opposite'
		]);
	});
	it('knows which species have a habitability', () => {
		expect(livesOnPlanets(humans, data)).toBe(true);
		expect(livesOnPlanets(['trait_adaptive'], data)).toBe(false);
	});
});
