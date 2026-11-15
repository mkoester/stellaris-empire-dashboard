import { describe, expect, it } from 'vitest';
import {
	distinctModifiers,
	formatModifierValue,
	modifierColor,
	modifierLabel
} from './modifiers.ts';

const mod = (key: string, value: number, positiveIsGood = true, label: string | null = null) => ({
	key,
	value,
	positiveIsGood,
	label
});

describe('modifiers', () => {
	it('formats percentage families as percent, others raw', () => {
		expect(formatModifierValue(mod('starbase_upgrade_speed_mult', 0.5))).toBe('+50%');
		expect(formatModifierValue(mod('country_starbase_capacity_add', 2))).toBe('+2');
		expect(formatModifierValue(mod('planet_crime_add', -25))).toBe('-25');
	});

	it('colours by whether the direction is good', () => {
		expect(modifierColor(mod('planet_crime_add', -25, false))).toBe('text-green-600');
		expect(modifierColor(mod('planet_stability_add', -1))).toBe('text-red-600');
	});

	it('uses the label, minus loc commands, or a readable key', () => {
		expect(modifierLabel(mod('x_add', 1, true, 'Stability [icon]'))).toBe('Stability');
		expect(modifierLabel(mod('planet_crime_add', 1))).toBe('Planet Crime');
	});
});

describe('traitCost', async () => {
	const { traitCost } = await import('./server/explain.ts');
	it('says costs or gives', () => {
		expect(traitCost(2)).toBe('costs 2 trait points');
		expect(traitCost(-1)).toBe('gives 1 trait point');
	});

	it('lists modifiers that read alike once (the arkship tiers of a nomad agenda)', () => {
		const tier = (n: number, value = 0.05) =>
			mod(
				`shipsize_civilian_arkship_tier_${n}_science_survey_speed`,
				value,
				true,
				'Civilian Arkship Survey Speed'
			);
		const list = [tier(1), tier(2), tier(3), tier(1, 0.1)];
		expect(distinctModifiers(list).map((m) => [m.key, m.value])).toEqual([
			['shipsize_civilian_arkship_tier_1_science_survey_speed', 0.05],
			['shipsize_civilian_arkship_tier_1_science_survey_speed', 0.1]
		]);
	});
});
