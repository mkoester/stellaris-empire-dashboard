import type { Modifier } from './types.ts';

// Modifier display, copied from stellaris-empire-planner `src/lib/civics.ts`
// (isPercentModifier, formatModifierValue, modifierLabel, modifierColor) — keep the two in step.
// Only the colours differ: this page has a light background.

function isPercentModifier(key: string): boolean {
	if (key.includes('_mult') || key.endsWith('_perc')) return true;
	return /habitability|_happiness$|_attraction$|_tolerance$|_exp_gain$|research_speed$|survey_speed|_chance_add$|army_health$|weapon_damage$|orbital_bombardment_damage$|_cooldown$|_fee$|storm_repulsion/.test(
		key
	);
}

/** Percentage families show `value × 100`%, everything else the raw number. */
export function formatModifierValue(mod: Modifier): string {
	const sign = mod.value > 0 ? '+' : '';
	if (isPercentModifier(mod.key)) {
		const pct = mod.value * 100;
		const n = Number.isInteger(pct) ? pct : parseFloat(pct.toFixed(2));
		return `${sign}${n}%`;
	}
	const n = Number.isInteger(mod.value) ? mod.value : parseFloat(mod.value.toFixed(2));
	return `${sign}${n}`;
}

export function modifierColor(mod: Modifier): string {
	return mod.value > 0 === mod.positiveIsGood ? 'text-green-600' : 'text-red-600';
}

export function modifierLabel(mod: Modifier): string {
	const label = mod.label?.replace(/\[.*?\]/g, '').trim();
	if (label) return label;
	const key = mod.key.replace(/_(add|mult)(_uninhabitable)?$/, '');
	return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Not part of the planner copy — the dashboard's own.

/**
 * The lines a reader can tell apart: of modifiers that read the same (value, label, colour), the
 * first. The game labels some keys alike — an agenda's `shipsize_civilian_arkship_tier_1/2/3_*`
 * all read "Civilian Arkship …" — and three equal lines say nothing a single one does not.
 */
export function distinctModifiers(list: Modifier[]): Modifier[] {
	const seen = new Set<string>();
	return list.filter((m) => {
		const line = `${formatModifierValue(m)}|${modifierLabel(m)}|${modifierColor(m)}`;
		if (seen.has(line)) return false;
		seen.add(line);
		return true;
	});
}
