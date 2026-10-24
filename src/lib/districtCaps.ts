import type { CapEffect, Explanation, PlanetState } from './types.ts';

// How many districts a planet allows, from what the save shows on it. The game computes this
// from modifiers (4.5.2): per type, the sum of `district_<type>_max_add` (× 1 + `…_max_mult`);
// overall, planet size (`NUM_DISTRICTS_FROM_PLANET_SIZE` = 1) plus `planet_max_districts_add`
// (× 1 + `…_mult`), also as `planet_non_artificial_…` and `pc_<class>_…`. The sources: deposits —
// a blocker's hidden feature included, as the game counts it (Earth 2207.03.10: farming 5 +
// Pacific Algae Tracts 3 = the game's 8) —, the planet's static modifiers and its buildings, and
// the empire's civics, origin, traditions and perks (`empire`; Embron 2212.06.01, the game's
// tooltip: 20 size + 3 Planet Forgers (`pc_volcanic_…`) + 1 Expansion finished + 1 Adaptive
// Ecology = 25). Not counted: techs and triggered ones, e.g. capital buildings' +1 with
// Virtuality.

export type CapSource = { from: string; key: string; value: number; blocked: boolean };
export type DistrictCap = {
	district: string;
	built: number;
	cap: number | null; // null: no cap of its own (city districts), only the planet's limit
	blocked: number; // of the cap, what the features behind blockers add: usable once cleared
	sources: CapSource[];
};
export type PlanetCaps = {
	built: number;
	limit: number | null; // null for habitats: theirs depends on capital tier and the system
	limitCleared: number | null; // the limit once every blocker is cleared
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
	planet: PlanetState & {
		size: number;
		habitat: boolean;
		planetClass?: string;
		buildings: string[];
	},
	built: Record<string, number>,
	effects: Record<string, CapEffect[]>,
	blockers: string[] = [], // deposit keys that are blockers
	empire: string[] = [] // the empire's owners: `civic:…`, `origin:…`, `tradition:…` (perks too)
): PlanetCaps {
	const owners: [string, boolean][] = [
		...planet.deposits.flatMap((d): [string, boolean][] => [
			[`deposit:${d.key}`, false],
			...(d.swap ? [[`deposit:${d.swap}`, true] as [string, boolean]] : [])
		]),
		...planet.modifiers.map((m): [string, boolean] => [`modifier:${m.key}`, false]),
		...planet.buildings.map((b): [string, boolean] => [`building:${b}`, false]),
		...empire.map((o): [string, boolean] => [o, false])
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
			return {
				district,
				built: built[district] ?? 0,
				cap: s ? capped(s) : null,
				blocked: s ? capped(s) - capped(s.filter((x) => !x.blocked)) : 0,
				sources: s ?? []
			};
		});

	const limitKeys = [
		'planet_max_districts_',
		'planet_non_artificial_max_districts_',
		...(planet.planetClass ? [`${planet.planetClass}_max_districts_`] : [])
	];
	const limitSources = sources.filter((s) => limitKeys.some((k) => s.key.startsWith(k)));
	const limitOf = (s: CapSource[]) =>
		planet.habitat
			? null
			: Math.max(0, Math.floor((planet.size + sum(s, '_add')) * (1 + sum(s, '_mult')) + 1e-9));
	const blockerRefs = new Set(blockers.map((b) => `deposit:${b}`));
	return {
		built: Object.values(built).reduce((a, n) => a + n, 0),
		limit: limitOf(limitSources),
		limitCleared: limitOf(limitSources.filter((s) => !blockerRefs.has(s.from))),
		limitSources,
		types
	};
}
