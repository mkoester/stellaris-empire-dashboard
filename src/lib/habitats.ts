import { sortBy, type SortValue } from './sort.ts';
import type { HabitatSite } from './types.ts';

// What a habitat would get in a system, after 4.5.2's script: its district limit is
// `max_habitat_districts_value` (common/script_values) = 6 + ¼ per major body (stars and
// planets), once more each with Habitats II and III, + ¼ per minor body (moons, asteroids) for
// Void Dwellers, + the empire's `habitat_max_districts_add` (not counted), rounded down — the game
// calls 10 a poor site, 16 a good one; its mining, energy and science districts are capped by the
// orbital deposits' `habitat_modifier` (data DB `deposit_habitat_modifier`).

export type HabitatRow = HabitatSite & { limit: number; caps: Record<string, number> };

export function habitatRow(
	site: HabitatSite,
	empire: { researched: string[]; voidDweller: boolean },
	effects: Record<string, Record<string, number>> // deposit → habitat modifiers
): HabitatRow {
	const techs = ['tech_habitat_2', 'tech_habitat_3'].filter((t) =>
		empire.researched.includes(t)
	).length;
	const limit = Math.floor(
		6 + 0.25 * site.major * (1 + techs) + (empire.voidDweller ? 0.25 * site.minor : 0) + 1e-9
	);
	const caps: Record<string, number> = {};
	for (const d of site.deposits)
		for (const [key, value] of Object.entries(effects[d] ?? {})) {
			const m = /^(district_hab_\w+)_max_add$/.exec(key);
			if (m) caps[m[1]] = (caps[m[1]] ?? 0) + value;
		}
	return { ...site, limit, caps };
}

export const HABITAT_DISTRICTS = [
	'district_hab_mining',
	'district_hab_energy',
	'district_hab_science'
];

export type HabitatSort = { column: string; desc: boolean };

/** In range (the expansion view's `beyond`) and at least `minSize` districts. */
export const habitatVisible = (r: HabitatRow, beyond: number | null, minSize: number) =>
	(beyond === null || (r.beyond !== null && r.beyond <= beyond)) && r.limit >= minSize;

export function sortHabitats(rows: HabitatRow[], s: HabitatSort): HabitatRow[] {
	const value = (r: HabitatRow): SortValue => {
		if (s.column.startsWith('cap:')) return r.caps[s.column.slice(4)] ?? 0;
		return (
			(
				{
					system: r.system,
					capital: r.jumps,
					shipyard: r.shipyard,
					beyond: r.beyond,
					limit: r.limit,
					major: r.major,
					minor: r.minor
				} as Record<string, SortValue>
			)[s.column] ?? null
		);
	};
	return sortBy(rows, value, s.desc);
}
