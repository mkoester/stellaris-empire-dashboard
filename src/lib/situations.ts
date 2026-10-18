import { distances, graph } from './galaxyGraph.ts';
import { CATEGORICAL, OTHER } from './migration.ts';
import { gameYear } from './series.ts';
import type {
	CountryInfo,
	FirstContact,
	GalaxySystem,
	Relation,
	SituationInfo,
	GameData
} from './types.ts';

// The situations tab: first contacts (table and map), situations, anomalies, special projects and
// dig sites, from one save and the campaign's galaxy. Pure.

/** Whole months from `from` to `to` (game dates, 30-day months). */
export const monthsBetween = (from: string, to: string) =>
	Math.max(0, Math.floor((gameYear(to) - gameYear(from)) * 12 + 1e-9));

/** Jumps along hyperlanes from the nearest owned system (bypasses not counted). */
export function jumpsFromBorder(galaxy: GalaxySystem[]): Map<number, number> {
	const g = graph(
		galaxy.flatMap((s) => s.lanes.map((to): [number, number] => [s.id, to])),
		[]
	);
	return distances(
		g,
		galaxy.filter((s) => s.owned).map((s) => s.id)
	).jumps;
}

export type ContactRow = FirstContact & {
	system: string;
	months: number; // since discovery
	jumps: number | null; // from our border
	communications: boolean;
	stations: number; // visited systems whose station is theirs
	country: CountryInfo | null;
};

export function contactRows(
	contacts: FirstContact[],
	galaxy: GalaxySystem[],
	relations: Relation[],
	countries: CountryInfo[],
	date: string
): ContactRow[] {
	const byId = new Map(galaxy.map((s) => [s.id, s]));
	const jumps = jumpsFromBorder(galaxy);
	return contacts.map((c) => ({
		...c,
		system: byId.get(c.systemId)?.name ?? String(c.systemId),
		months: monthsBetween(c.date, date),
		jumps: jumps.get(c.systemId) ?? null,
		communications: relations.find((r) => r.countryId === c.countryId)?.communications ?? false,
		stations: galaxy.filter((s) => s.ownerId === c.countryId).length,
		country: countries.find((x) => x.id === c.countryId) ?? null
	}));
}

export type StationOwner = {
	countryId: number;
	name: string; // as we know them: the pre-communications name until we talk
	type: string | null;
	shipset: string | null;
	color: string;
	systems: number[];
	contact: number | null; // the first contact with them, if any
};

/** Other empires' stations in visited systems, by owner, each with a colour for the map. */
export function stationOwners(
	galaxy: GalaxySystem[],
	ownId: number | null,
	relations: Relation[],
	countries: CountryInfo[],
	contacts: FirstContact[]
): StationOwner[] {
	const owners = [
		...new Set(
			galaxy.flatMap((s) => (s.ownerId === null || s.ownerId === ownId ? [] : [s.ownerId]))
		)
	];
	return owners.map((id, i) => {
		const c = countries.find((x) => x.id === id);
		return {
			countryId: id,
			name: relations.find((r) => r.countryId === id)?.name ?? c?.name ?? String(id),
			type: c?.type ?? null,
			shipset: c?.shipset ?? null,
			color: CATEGORICAL[(i + 1) % CATEGORICAL.length] ?? OTHER,
			systems: galaxy.filter((s) => s.ownerId === id).map((s) => s.id),
			contact: contacts.find((f) => f.countryId === id)?.id ?? null
		};
	});
}

export type SituationRow = SituationInfo & {
	name: string;
	category: string | null;
	approachName: string | null;
};

export function situationRows(
	situations: SituationInfo[],
	types: GameData['situationTypes']
): SituationRow[] {
	return situations.map((s) => ({
		...s,
		name: types[s.type]?.name ?? s.type,
		category: types[s.type]?.category ?? null,
		approachName: s.approach ? (types[s.type]?.approaches[s.approach] ?? s.approach) : null
	}));
}

/** Which systems a map shows: discovered only, every star (lanes still only the known), all. */
export type Reveal = { whole: boolean; stars: boolean };

/** The ids the empire has discovered: visited or own (the save's `terra_incognita.systems` is the
 * same list) and `also` (first contact sites, which the game shows). */
export const knownIds = (galaxy: GalaxySystem[], also: number[] = []) =>
	new Set([...galaxy.filter((s) => s.visited || s.owned).map((s) => s.id), ...also]);

/**
 * The systems of the galaxy's largest hyperlane network. Special systems the game shows only once
 * a trigger fires lie outside it: 2207.03.10 Kleeia (`distar_sealed_1_2`) and Ultima Vigilis
 * (`surveillance_supercomputer_system`) have no hyperlane at all; L-Cluster and crisis systems
 * join later, behind bypasses or on their own.
 */
export function mainNetwork(galaxy: GalaxySystem[]): Set<number> {
	const parent = new Map(galaxy.map((s) => [s.id, s.id]));
	const root = (id: number): number => {
		const p = parent.get(id) ?? id;
		if (p === id) return id;
		const r = root(p);
		parent.set(id, r);
		return r;
	};
	for (const s of galaxy)
		for (const to of s.lanes) if (parent.has(to)) parent.set(root(s.id), root(to));
	const size = new Map<number, number>();
	for (const s of galaxy) size.set(root(s.id), (size.get(root(s.id)) ?? 0) + 1);
	const biggest = [...size].sort((a, b) => b[1] - a[1])[0]?.[0];
	return new Set(galaxy.filter((s) => root(s.id) === biggest).map((s) => s.id));
}

/**
 * The systems a map or a site search sees: the discovered ones with the lanes among them only —
 * the game hides hyperlanes outside its known space — plus every other star with `stars` (the
 * game shows them from the start, named "Unknown"; not the special ones off the main network,
 * see `mainNetwork`), or the whole galaxy with its lanes with `whole`.
 */
export function discovered(
	galaxy: GalaxySystem[],
	reveal: Reveal,
	also: number[] = []
): GalaxySystem[] {
	if (reveal.whole) return galaxy;
	const known = knownIds(galaxy, also);
	const network = reveal.stars ? mainNetwork(galaxy) : new Set<number>();
	return galaxy
		.filter((s) => known.has(s.id) || (reveal.stars && network.has(s.id)))
		.map((s) =>
			known.has(s.id)
				? { ...s, lanes: s.lanes.filter((to) => known.has(to)) }
				: // an undiscovered star: the game names it "Unknown" and draws no lanes
					{ ...s, name: 'Unknown', lanes: [] }
		);
}

/**
 * What a map draws of the galaxy: the discovered systems and, as the game does, every hyperlane of
 * a system whose lanes we know (`lanesKnown`: visited, or within hyperlane detection range; older
 * readings: the discovered ones) with the undiscovered systems at their ends (`known` false:
 * faint, "Unknown");
 * with `wormholes`, where explored wormholes lead (`wormholes`, drawn as arcs), their far ends too.
 */
export function mapView(
	galaxy: GalaxySystem[],
	reveal: Reveal & { wormholes?: boolean },
	also: number[] = []
) {
	const known = knownIds(galaxy, also);
	const byId = new Map(galaxy.map((s) => [s.id, s]));
	const worm = (s: GalaxySystem) => (reveal.wormholes ? (s.wormholes ?? []) : []);
	const lit = (id: number) => known.has(id) || byId.get(id)?.lanesKnown === true;
	const lane = (a: number, b: number) => lit(a) || lit(b);
	// a lane is listed at its lower end, so both ends are looked at
	const near = new Set<number>();
	for (const s of galaxy) {
		for (const to of s.lanes)
			if (lane(s.id, to)) for (const id of [s.id, to]) if (!known.has(id)) near.add(id);
		if (known.has(s.id)) for (const to of worm(s)) if (!known.has(to)) near.add(to);
	}
	const base = discovered(galaxy, reveal, also);
	const ids = new Set(base.map((s) => s.id));
	const frontier = galaxy
		.filter((s) => near.has(s.id) && !ids.has(s.id))
		.map((s) => ({ ...s, name: 'Unknown' }));
	const lanes = (id: number) => {
		const all = byId.get(id)?.lanes ?? [];
		return reveal.whole ? all : all.filter((to) => lane(id, to));
	};
	return [...base, ...frontier].map((g) => ({
		id: g.id,
		name: g.name,
		x: g.x,
		y: g.y,
		lanes: lanes(g.id),
		owned: g.owned,
		known: reveal.whole || known.has(g.id),
		wormholes: known.has(g.id) || reveal.whole ? worm(byId.get(g.id) ?? g) : []
	}));
}
