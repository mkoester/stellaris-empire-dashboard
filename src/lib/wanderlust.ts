import type { GalaxySystem, Wanderlust } from './types.ts';

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

/**
 * The category an arkship's visit counts for: the first of its flags in `WANDERLUST`'s order —
 * nomads.4720 tests them with if / else_if, so a system flagged twice counts once, for that one.
 */
export const countsFor = (categories: string[]): string | null =>
	WANDERLUST.find((c) => categories.includes(c.key))?.key ?? null;

export type WanderlustOutlook = {
	key: string;
	seen: number;
	count: number;
	done: boolean;
	found: number; // its targets we know: systems visited or owned (never a spoiler)
	open: number; // of those, not yet counted by an arkship
	need: number; // visits still missing
	finishable: boolean; // the found ones still open are enough to finish it
};

/**
 * Per category: what we found and whether it can be finished by visiting what we found. Every
 * system an arkship counted is one we entered, so the still open ones are `found − seen` — this
 * needs no `visited_by_nomad` flag (whose spelling is still assumed). Pure.
 */
export function outlook(
	w: Wanderlust,
	galaxy: Pick<GalaxySystem, 'visited' | 'owned' | 'wanderlust'>[]
): WanderlustOutlook[] {
	const found = new Map<string, number>();
	for (const s of galaxy) {
		const key = s.wanderlust && (s.visited || s.owned) ? countsFor(s.wanderlust) : null;
		if (key) found.set(key, (found.get(key) ?? 0) + 1);
	}
	return w.categories.map((c) => {
		const f = found.get(c.key) ?? 0;
		const open = Math.max(0, f - c.seen);
		const need = c.done || w.complete ? 0 : Math.max(0, c.count - c.seen);
		return { ...c, found: f, open, need, finishable: need > 0 && open >= need };
	});
}
