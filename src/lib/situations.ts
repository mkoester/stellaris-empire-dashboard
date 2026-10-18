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

/**
 * The galaxy as the empire knows its bodies: those of visited or own systems, anomalies only on
 * planets it surveyed — or, with `all` (the surveyAll spoiler), every body as if surveyed.
 */
export function surveyView(galaxy: GalaxySystem[], all: boolean): GalaxySystem[] {
	if (all) return galaxy;
	return galaxy.map((s) => ({
		...s,
		bodies:
			s.visited || s.owned
				? (s.bodies?.map((b) => (b.surveyed === false ? { ...b, anomaly: null } : b)) ?? null)
				: null
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
 * with `wormholes`, where explored wormholes lead (drawn as arcs). Explored: both ends visited —
 * the save marks no wormhole as explored, and exploring one (a fleet's jump through it) visits
 * the far end; visiting one end is not enough. With `wormholePairs` (a spoiler) every pair,
 * both ends shown. With `lgates` (a spoiler) every L-Gate system and, once the gates are open and
 * the L-Cluster exists, its systems, lanes and the gates' links (`lgates`), named; without it a
 * gate's link shows once both ends are visited.
 */
export function mapView(
	galaxy: GalaxySystem[],
	reveal: Reveal & { wormholes?: boolean; wormholePairs?: boolean; lgates?: boolean },
	also: number[] = []
) {
	const known = knownIds(galaxy, also);
	const byId = new Map(galaxy.map((s) => [s.id, s]));
	const visited = (id: number) => byId.get(id)?.visited === true || byId.get(id)?.owned === true;
	const worm = (s: GalaxySystem) =>
		(s.wormholes ?? []).filter(
			(to) => reveal.wormholePairs || (reveal.wormholes && visited(s.id) && visited(to))
		);
	const revealed = (s: GalaxySystem | undefined) =>
		reveal.lgates === true && (s?.lgate === true || s?.lcluster === true);
	const lgates = (s: GalaxySystem) =>
		(s.lgateTo ?? []).filter((to) => reveal.lgates || (visited(s.id) && visited(to)));
	const lit = (id: number) =>
		known.has(id) ||
		byId.get(id)?.lanesKnown === true ||
		(revealed(byId.get(id)) && byId.get(id)?.lcluster === true);
	const lane = (a: number, b: number) => lit(a) || lit(b);
	// a lane is listed at its lower end, so both ends are looked at
	const near = new Set<number>();
	for (const s of galaxy) {
		for (const to of s.lanes)
			if (lane(s.id, to)) for (const id of [s.id, to]) if (!known.has(id)) near.add(id);
		for (const to of [...worm(s), ...lgates(s)])
			for (const id of [s.id, to]) if (!known.has(id)) near.add(id);
		if (revealed(s) && !known.has(s.id)) near.add(s.id);
	}
	const base = discovered(galaxy, reveal, also);
	const ids = new Set(base.map((s) => s.id));
	const frontier = galaxy
		.filter((s) => near.has(s.id) && !ids.has(s.id))
		.map((s) => (revealed(s) ? s : { ...s, name: 'Unknown' }));
	const lanes = (id: number) => {
		const all = byId.get(id)?.lanes ?? [];
		return reveal.whole ? all : all.filter((to) => lane(id, to));
	};
	const shown = [...base, ...frontier].map((g) => ({
		id: g.id,
		// a star the unknownStars switch named 'Unknown' keeps its name when the L-Gate spoiler shows it
		name: revealed(byId.get(g.id)) ? (byId.get(g.id)?.name ?? g.name) : g.name,
		x: g.x,
		y: g.y,
		lanes: lanes(g.id),
		owned: g.owned,
		known: reveal.whole || known.has(g.id),
		wormholes: worm(byId.get(g.id) ?? g),
		lgates: lgates(byId.get(g.id) ?? g)
	}));
	// before the gates open the L-Cluster does not exist: with the spoiler, every gate links to
	// where it will spawn (predicted, see PREDICTED_LCLUSTER)
	const gates = shown.filter((s) => byId.get(s.id)?.lgate);
	if (!reveal.lgates || !gates.length || galaxy.some((s) => s.lcluster)) return shown;
	const hub = {
		...PREDICTED_LCLUSTER,
		lanes: [],
		owned: false,
		known: false,
		wormholes: [],
		lgates: []
	};
	return [...shown.map((s) => (gates.includes(s) ? { ...s, lgates: [hub.id] } : s)), hub];
}

/**
 * Where the L-Cluster will spawn when the gates open: 4.5.2 events/distant_stars_events_3.txt
 * `distar.11000` puts its entrance 550–560 from the galactic core (the save's 0,0) at 44–46°. The
 * angle is read in the standard maths sense (from +x towards +y) — unverified: no save with the
 * cluster open has been seen, so it may sit on another diagonal (AGENTS.md "Open").
 */
export const PREDICTED_LCLUSTER = {
	id: -1,
	name: 'L-Cluster (predicted — spawns when the gates open)',
	x: 555 * Math.cos(Math.PI / 4),
	y: 555 * Math.sin(Math.PI / 4)
};
