import { describe, expect, it } from 'vitest';
import { empireSizeEstimate, sizeModifiers, speciesSizeMult } from './empireSize.ts';

const mod = (key: string, value: number) => ({ key, value, label: null, positiveIsGood: false });

describe('empireSizeEstimate', () => {
	// Yorphia 2203.10.01: one colony, 5086 pops — the save says 50, the floor
	const parts = { colonies: 1, systems: 6, districts: 10, pops: [{ pops: 5086, mult: 0 }] };

	it('weighs the parts as the defines do', () => {
		expect(empireSizeEstimate(parts, {}, {})).toBeCloseTo(20 + 6 + 5 + 25.43);
	});

	it('scales each part by its modifier and the total by empire_size_mult', () => {
		const mods = { empire_size_colonies_mult: -0.25, empire_size_mult: 0.1 };
		expect(empireSizeEstimate(parts, mods, {})).toBeCloseTo((15 + 6 + 5 + 25.43) * 1.1);
	});

	it('adds a species’ own pops modifier to the empire’s', () => {
		const p = { ...parts, pops: [{ pops: 1000, mult: -0.5 }] };
		expect(empireSizeEstimate(p, { empire_size_pops_mult: -0.1 }, {})).toBeCloseTo(
			31 + 1000 * 0.005 * 0.4
		);
	});
});

describe('sizeModifiers', () => {
	it('keeps the size modifiers, not the penalty one', () => {
		expect(
			sizeModifiers([
				mod('empire_size_mult', -0.1),
				mod('empire_size_mult', 0.05),
				mod('empire_size_penalty_mult', -0.25),
				mod('planet_stability_add', 5)
			])
		).toEqual({ empire_size_mult: expect.closeTo(-0.05) });
	});

	it('reads a trait’s pops modifier under either key', () => {
		expect(
			speciesSizeMult([mod('empire_size_pops_mult', -0.1), mod('species_empire_size_mult', -0.05)])
		).toBeCloseTo(-0.15);
	});
});
