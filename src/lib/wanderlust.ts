import type { Wanderlust } from './types.ts';

// The nomads' Wanderlust ascension perk (4.5.3 `common/ascension_perks/00_ascension_perks.txt`,
// `ap_wanderlust`): eight categories of systems to visit with an arkship. A system belongs to a
// category by a star flag the galaxy's initializers set (`<flag>`); the empire's progress is the
// country variables `<key>_system_seen` / `<key>_system_count` (80 % of the flagged systems,
// rounded: `calculate_nomads_exploration_targets`), a category done the country flag
// `<key>_completed`. An arkship entering a flagged system counts it once and marks it
// `visited_by_nomad@<country>` (events/nomads_events_1.txt, nomads.4720) — any other ship does not.
// Names: the missions' (`NOMAD_EXPLORATION_<KEY>`, localisation/english). Pure.

export const WANDERLUST = [
	{ key: 'ancient_wonders', flag: 'ancient_wonders_system', name: 'Ancient Wonders' },
	{ key: 'antique_threat', flag: 'antique_threat_system', name: 'Antique Threats' },
	{ key: 'enclave', flag: 'enclave', name: 'Enclave Systems' },
	{ key: 'galactic_landmark', flag: 'galactic_landmark_system', name: 'Galactic Landmarks' },
	{ key: 'marauder', flag: 'marauder_system', name: 'Marauder Systems' },
	{ key: 'natural_spectacle', flag: 'natural_spectacle_system', name: 'Natural Spectacles' },
	{ key: 'precursor', flag: 'precursor_system', name: 'Forerunner Vestiges' },
	{ key: 'space_ecology', flag: 'space_ecology_system', name: 'Space Ecology' }
] as const;

export const wanderlustName = (key: string) => WANDERLUST.find((c) => c.key === key)?.name ?? key;

/** The categories a system's star flags put it in. */
export const wanderlustCategories = (flags: string[]): string[] =>
	WANDERLUST.filter((c) => flags.includes(c.flag)).map((c) => c.key);

/** Whether the arkship has counted a system, by the snapshot's visits; null when unknown. */
export function counted(w: Wanderlust | null, systemId: number): string | null {
	return w?.visits.find((v) => v.systemId === systemId)?.date ?? null;
}
