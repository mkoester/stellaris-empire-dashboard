import { evaluate, type Facts } from './triggers.ts';
import type { GameData } from './types.ts';

// A species' rights as the game's species rights panel lists them: per kind, the options the
// species can have (potential not false), the one set, and which may not be picked now (allow).

export const RIGHT_LABELS: Record<string, string> = {
	citizenship: 'Citizenship',
	subspecies_integration: 'Sub-Species Integration',
	living_standard: 'Living Standards',
	military_service: 'Military Service',
	colonization_control: 'Colonization Rights',
	population_control: 'Population Controls',
	migration_control: 'Migration Controls',
	slavery: 'Slavery Type',
	purge: 'Purge Type'
};

export type RightRow = {
	kind: string;
	label: string;
	selected: string | null;
	options: { key: string; name: string; selected: boolean; allowed: boolean | null }[];
};

/** `f` with the species' traits (`traits`): the triggers read the species, the country as `from`. */
export function rightRows(
	kinds: GameData['speciesRights'],
	set: Record<string, string>,
	f: Facts,
	all = false
): RightRow[] {
	return kinds.map((k) => ({
		kind: k.kind,
		label: RIGHT_LABELS[k.kind] ?? k.kind,
		selected: set[k.kind] ?? null,
		options: k.options
			.filter((o) => all || o.key === set[k.kind] || evaluate(o.potential, f) !== false)
			.map((o) => ({
				key: o.key,
				name: o.name,
				selected: o.key === set[k.kind],
				allowed: evaluate(o.allow, f)
			}))
	}));
}
