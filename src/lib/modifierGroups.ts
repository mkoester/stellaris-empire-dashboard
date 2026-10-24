// Modifiers grouped by what they act on, for long effect lists (the Galactic Community's active
// effects). By key pattern, first match wins — ordered so that e.g. a researcher's output counts as
// research, not production, and ship upkeep as fleet, not upkeep. Patterns from the modifier keys
// 4.5.2's resolutions use (data DB `static_modifier_modifier`); anything else is `other`. Pure.

const GROUPS = [
	{
		id: 'diplomacy',
		label: 'Diplomacy',
		match: /^diplo_weight|^monthly_loyalty|enclave_capacity|^subject_|^country_galactic_standard/
	},
	{
		id: 'fleet',
		label: 'Fleet and starbases',
		match: /^ships?_|ship_|^starbase|naval_cap|^damage_vs_/
	},
	{ id: 'army', label: 'Armies', match: /^arm(y|ies)_/ },
	{ id: 'war', label: 'War', match: /war_exhaustion/ },
	{ id: 'research', label: 'Research', match: /research|^station_researchers/ },
	{ id: 'production', label: 'Production', match: /_produces_|^country_resource_max/ },
	{
		id: 'pops',
		label: 'Pops',
		match: /^pop_|_pop_happiness|^planet_pops?_|^logistic_growth|^refugee|^biological_|^lithoid_/
	},
	{ id: 'upkeep', label: 'Upkeep', match: /_upkeep_/ },
	{ id: 'planets', label: 'Planets', match: /^planet_|^terraforming/ },
	{ id: 'empire', label: 'Empire', match: /^empire_size|^edicts_|^leaders_/ }
] as const;

export type ModifierGroup = (typeof GROUPS)[number]['id'] | 'other';
export const GROUP_ORDER: ModifierGroup[] = [...GROUPS.map((g) => g.id), 'other'];
export const groupLabel = (g: ModifierGroup) => GROUPS.find((x) => x.id === g)?.label ?? 'Other';

export function groupOf(key: string): ModifierGroup {
	return GROUPS.find((g) => g.match.test(key))?.id ?? 'other';
}

/** Items in group order, each group's items in their given order; empty groups left out. */
export function grouped<T>(items: T[], key: (t: T) => string) {
	return GROUP_ORDER.map((group) => ({
		group,
		label: groupLabel(group),
		items: items.filter((t) => groupOf(key(t)) === group)
	})).filter((g) => g.items.length);
}
