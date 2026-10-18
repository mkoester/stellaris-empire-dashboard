import type { CapEffect, Explanation, PlanetState } from './types.ts';

// How many districts a planet allows, from what the save shows on it. The game computes this
// from modifiers (4.5.2): per type, the sum of `district_<type>_max_add` (× 1 + `…_max_mult`);
// overall, planet size (`NUM_DISTRICTS_FROM_PLANET_SIZE` = 1) plus `planet_max_districts_add`
// (× 1 + `…_mult`). The sources: deposits — a blocker's hidden feature included, as the game
// counts it (Earth 2207.03.10: farming 5 + Pacific Algae Tracts 3 = the game's 8) —, the
// planet's static modifiers and its buildings. Not counted: modifiers from the empire (techs,
// traditions, civics) and triggered ones, e.g. capital buildings' +1 with Virtuality.

export type CapSource = { from: string; key: string; value: number; blocked: boolean };
export type DistrictCap = {
	district: string;
	built: number;
	cap: number | null; // null: no cap of its own (city districts), only the planet's limit
	sources: CapSource[];
};
export type PlanetCaps = {
	built: number;
	limit: number | null; // null for habitats: theirs depends on capital tier and the system
	limitSources: CapSource[];
	types: DistrictCap[];
};

/** A planet with its caps and what naming and explaining them needs (`PlanetDetails.svelte`). */
export type PlanetDetailsData = {
	planet: PlanetState;
	caps: PlanetCaps;
	blockers: string[];
	names: Record<string, string>;
	colors: Record<string, string>; // districts' colours in game
	explain: Record<string, Explanation>;
};

const TYPE_CAP = /^district_(\w+)_max_(add|mult)$/;

export function districtCaps(
	planet: PlanetState & { size: number; habitat: boolean; buildings: string[] },
	built: Record<string, number>,
	effects: Record<string, CapEffect[]>
): PlanetCaps {
	const owners: [string, boolean][] = [
		...planet.deposits.flatMap((d): [string, boolean][] => [
			[`deposit:${d.key}`, false],
			...(d.swap ? [[`deposit:${d.swap}`, true] as [string, boolean]] : [])
		]),
		...planet.modifiers.map((m): [string, boolean] => [`modifier:${m.key}`, false]),
		...planet.buildings.map((b): [string, boolean] => [`building:${b}`, false])
	];
	const sources = owners.flatMap(([from, blocked]) =>
		(effects[from] ?? []).map((e) => ({ from, key: e.key, value: e.value, blocked }))
	);
	const sum = (s: CapSource[], suffix: string) =>
		s.filter((x) => x.key.endsWith(suffix)).reduce((a, x) => a + x.value, 0);
	const capped = (s: CapSource[]) =>
		Math.max(0, Math.floor(sum(s, '_add') * (1 + sum(s, '_mult')) + 1e-9));

	const byType = new Map<string, CapSource[]>();
	for (const s of sources) {
		const m = TYPE_CAP.exec(s.key);
		if (m) byType.set(`district_${m[1]}`, [...(byType.get(`district_${m[1]}`) ?? []), s]);
	}
	const types = [...new Set([...Object.keys(built).filter((k) => built[k] > 0), ...byType.keys()])]
		.sort()
		.map((district) => {
			const s = byType.get(district);
			return { district, built: built[district] ?? 0, cap: s ? capped(s) : null, sources: s ?? [] };
		});

	const limitSources = sources.filter((s) => s.key.startsWith('planet_max_districts_'));
	return {
		built: Object.values(built).reduce((a, n) => a + n, 0),
		limit: planet.habitat
			? null
			: Math.max(
					0,
					Math.floor(
						(planet.size + sum(limitSources, '_add')) * (1 + sum(limitSources, '_mult')) + 1e-9
					)
				),
		limitSources,
		types
	};
}
