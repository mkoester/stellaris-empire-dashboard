import { evaluate, type Facts } from './triggers.ts';
import type { GameData } from './types.ts';

// A species' rights as the game's species rights panel lists them: per kind, the options the
// species can have (potential not false), the one set, and which may not be picked now (allow).
// Slavery and purge types only where the citizenship enslaves or purges (`is_slavery`,
// `is_purge` — 4.5.2 citizenship_types; slavery_normal's allow: "triggers covered in
// citizenship_slavery"): the save keeps a default type for every species.

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
	const citizenship = kinds
		.find((k) => k.kind === 'citizenship')
		?.options.find((o) => o.key === set.citizenship);
	const applies = (kind: string) =>
		all ||
		(kind === 'slavery'
			? !!citizenship?.isSlavery
			: kind === 'purge'
				? !!citizenship?.isPurge
				: true);
	return kinds
		.filter((k) => applies(k.kind))
		.map((k) => ({
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
