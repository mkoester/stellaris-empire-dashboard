import { describe, expect, it } from 'vitest';
import { empireSizeEstimate, sizeModifiers, speciesSizeMult } from './empireSize.ts';

const mod = (key: string, value: number) => ({ key, value, label: null, positiveIsGood: false });

describe('empireSizeEstimate', () => {
	// Yorphia 2203.10.01: one colony, 5086 pops — the save says 50, the floor
	const parts = {
		colonies: [{ districts: 10, pops: 5086, tier: 0, governorSkill: 0 }],
		systems: 6,
		pops: [{ pops: 5086, mult: 0 }]
	};

	it('weighs the parts as the defines do', () => {
		expect(empireSizeEstimate(parts, {}, {})).toBeCloseTo(20 + 6 + 5 + 25.43);
	});

	it('scales each part by its modifier and the total by empire_size_mult', () => {
		const mods = { empire_size_colonies_mult: -0.25, empire_size_mult: 0.1 };
		expect(empireSizeEstimate(parts, mods, {})).toBeCloseTo((15 + 6 + 5 + 25.43) * 1.1);
	});

	it('adds a species’ own pops modifier to the empire’s', () => {
		const p = {
			...parts,
			colonies: [{ ...parts.colonies[0], pops: 1000 }],
			pops: [{ pops: 1000, mult: -0.5 }]
		};
		expect(empireSizeEstimate(p, { empire_size_pops_mult: -0.1 }, {})).toBeCloseTo(
			31 + 1000 * 0.005 * 0.4
		);
	});

	it('shrinks a colony’s share by its ascension tier and governor, as the game’s tooltip', () => {
		// Peshnab 2203.02.01: the arkship alone, tier 1 with Ascensionists, governor skill 2, nomadic;
		// the game: districts 7.5, colony 36.0, pops 24.8 (shown as 69)
		const peshnab = {
			colonies: [{ districts: 8, pops: 5514, tier: 1, governorSkill: 2 }],
			systems: 0,
			pops: [{ pops: 5514, mult: 0 }]
		};
		const mods = {
			empire_size_colonies_mult: 1,
			empire_size_districts_mult: 1,
			planetary_ascension_effect_mult: 0.25
		};
		expect(empireSizeEstimate(peshnab, mods, {})).toBeCloseTo(7.5 + 36 + 24.8136);
	});
});

describe('sizeModifiers', () => {
	it('keeps the size modifiers, not the penalty one', () => {
		expect(
			sizeModifiers([
				mod('empire_size_mult', -0.1),
				mod('empire_size_mult', 0.05),
				mod('empire_size_penalty_mult', -0.25),
				mod('planet_stability_add', 5),
				mod('planetary_ascension_effect_mult', 0.25)
			])
		).toEqual({
			empire_size_mult: expect.closeTo(-0.05),
			planetary_ascension_effect_mult: 0.25
		});
	});

	it('reads a trait’s pops modifier under either key', () => {
		expect(
			speciesSizeMult([mod('empire_size_pops_mult', -0.1), mod('species_empire_size_mult', -0.05)])
		).toBeCloseTo(-0.15);
	});
});
