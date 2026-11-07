import type { Colony, GameData, Snapshot } from './types.ts';

// Who lives on a colony: pops per species with their citizenship. 4.x has no slave stratum —
// enslaved pops work as workers or specialists (`slave_unemployment` only when jobless) — so a
// slave is a pop of a species whose citizenship enslaves (data DB `species_right.is_slavery`:
// `citizenship_slavery`, `citizenship_exploited_drone`). Pure.

type Rights = GameData['speciesRights'];

export type ColonySpecies = {
	id: string;
	name: string;
	pops: number;
	citizenship: string | null; // the right's name; null when the save names none
	slavery: string | null; // the slavery type's name, for slaves
	enslaved: boolean;
	habitability: number | null; // 0–1
};

/** The citizenship keys that enslave. */
export const slaveryKeys = (rights: Rights): Set<string> =>
	new Set(rights.flatMap((k) => k.options.filter((o) => o.isSlavery).map((o) => o.key)));

/** Pops of enslaved species on the colony; null before READER 51 or without species rights. */
export function enslavedPops(
	c: Pick<Colony, 'speciesPops'>,
	s: Pick<Snapshot, 'speciesRights'>,
	slavery: Set<string>
): number | null {
	if (!c.speciesPops || !s.speciesRights) return null;
	return Object.entries(c.speciesPops)
		.filter(([sp]) => slavery.has(s.speciesRights![sp]?.citizenship ?? ''))
		.reduce((n, [, pops]) => n + pops, 0);
}

/** The colony's species, most pops first. */
export function colonySpecies(
	c: Pick<Colony, 'speciesPops' | 'speciesHabitability'>,
	s: Pick<Snapshot, 'species' | 'speciesRights'>,
	rights: Rights
): ColonySpecies[] {
	const name = (key: string | undefined) =>
		key === undefined
			? null
			: (rights.flatMap((k) => k.options).find((o) => o.key === key)?.name ?? key);
	const slavery = slaveryKeys(rights);
	return Object.entries(c.speciesPops ?? {})
		.filter(([, pops]) => pops > 0)
		.map(([id, pops]) => {
			const r = s.speciesRights?.[id] ?? {};
			const enslaved = slavery.has(r.citizenship ?? '');
			return {
				id,
				name: s.species?.find((x) => x.id === id)?.name ?? `species ${id}`,
				pops,
				citizenship: name(r.citizenship),
				slavery: enslaved ? name(r.slavery) : null,
				enslaved,
				habitability: c.speciesHabitability[id] ?? null
			};
		})
		.sort((a, b) => b.pops - a.pops);
}
