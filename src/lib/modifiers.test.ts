import { describe, expect, it } from 'vitest';
import { formatModifierValue, modifierColor, modifierLabel } from './modifiers.ts';

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
});
