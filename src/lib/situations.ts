import { distances, graph } from './galaxyGraph.ts';
import { CATEGORICAL, OTHER } from './migration.ts';
import { pretty } from './format.ts';
import { gameYear } from './series.ts';
import type {
	CountryInfo,
	FirstContact,
	GalaxySystem,
	Relation,
	SituationInfo,
	GameData,
	Snapshot
} from './types.ts';

// The frontier tab: first contacts (table and map), situations, anomalies, special projects and
// dig sites, from one save and the campaign's galaxy. Pure.

/**
 * What the branch's earlier saves had and `latest` no longer has — finished, or lost: the save
 * cannot tell (an anomaly researched, a dig site's last chapter, a project done or failed, a
 * situation ended). The user's ask 2026-11-16: "some decisions come after I officially finished
 * something like anomalies … keep them in the overview, at the bottom and greyed out". Each with
 * its last reading and that save's date, newest first. Saves without the list (`pick` null) are
 * skipped, and so is everything after `latest`.
 */
export function gone<T>(
	saves: Snapshot[],
	latest: Snapshot | undefined,
	pick: (s: Snapshot) => T[] | null,
	key: (t: T) => string | number
): (T & { lastSeen: string })[] {
	if (!latest) return [];
	const seen = new Map<string | number, T & { lastSeen: string }>();
	for (const s of saves) {
		const list = pick(s);
		if (list) for (const t of list) seen.set(key(t), { ...t, lastSeen: s.date });
		if (s === latest) break;
	}
	for (const t of pick(latest) ?? []) seen.delete(key(t));
	return [...seen.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

/**
 * Each situation's change per month as the saves show it, where the save's own
 * `last_month_progress` says nothing (0 or absent): a situation whose progress script effects move,
 * not its `monthly_progress`, keeps 0 there — 4.5.4 Operational Reserves
 * (`situation_nomad_economy`) read 0 three months running while its progress fell
 * 20839 → 20609 → 20379. Taken from the last earlier save that had the same situation, per
 * 30-day month (`monthlyObserved`); kept as the save says it otherwise.
 */
export function observedMonthly<S extends SituationInfo>(
	list: S[],
	date: string,
	earlier: { date: string; situations: SituationInfo[] | null }[]
): (S & { monthlyObserved: boolean })[] {
	return list.map((x) => {
		const before = earlier
			.filter((e) => e.date < date && e.situations)
			.findLast((e) => e.situations!.some((y) => y.id === x.id));
		const prev = before?.situations!.find((y) => y.id === x.id);
		const months = before ? (gameYear(date) - gameYear(before.date)) * 12 : 0;
		return x.monthly || !prev || months <= 0 || prev.progress === x.progress
			? { ...x, monthlyObserved: false }
			: { ...x, monthly: (x.progress - prev.progress) / months, monthlyObserved: true };
	});
}

/**
 * Whether the empire can have explored a natural wormhole: exploring one takes a science ship and
 * Wormhole Stabilization (4.5.4 common/bypass/00_bypasses.txt `wormhole`: `requires_exploration`,
 * `prerequisites = { tech_wormhole_stabilization }`; events exploration.220.hint). Both ends
 * visited without it drew a link the game does not show (Roaming Cyber Gang 2226.08.01).
 */
export const canExploreWormholes = (snaps: Pick<Snapshot, 'progress'>[]) =>
	snaps
		.findLast((s) => s.progress)
		?.progress?.researched.includes('tech_wormhole_stabilization') === true;

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
	const talks = (id: number) => relations.find((r) => r.countryId === id)?.communications ?? false;
	return contacts.map((c) => ({
		...c,
		system: byId.get(c.systemId)?.name ?? String(c.systemId),
		months: monthsBetween(c.date, date),
		jumps: jumps.get(c.systemId) ?? null,
		communications: talks(c.countryId),
		stations: galaxy.filter((s) => s.ownerId === c.countryId).length,
		// what it is only once we talk: the page has no business with it before (the user's ask
		// 2026-11-17: no first contact spoiled)
		country: talks(c.countryId) ? (countries.find((x) => x.id === c.countryId) ?? null) : null
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
			name: relations.find((r) => r.countryId === id)?.name ?? c?.name ?? 'unknown empire',
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
	end: number | null; // where its last stage ends: the most progress there is (100 for most)
	ladder: Rung[]; // each stage from where it starts, with two or more stages; else empty
	next: NextStage | null;
	category: string | null;
	approachName: string | null;
	stageName: string | null;
	monthlyObserved?: boolean; // ±/mo taken from the saves (`observedMonthly()`)
};

/** The stage a situation reaches next at its monthly change, and in how many months: the end of
 * its stage going up, the start going down (`ends`: where each stage ends). Null when it stands
 * still, or the save has no stage. */
export type NextStage = { months: number; to: string };
export function nextStage(
	s: Pick<SituationInfo, 'progress' | 'monthly' | 'stage' | 'ends'>,
	names: readonly string[]
): NextStage | null {
	const ends = s.ends ?? [];
	if (s.stage === null || !s.monthly || s.stage >= ends.length) return null;
	const name = (i: number) => names[i] ?? `stage ${i + 1}`;
	if (s.monthly > 0) {
		const left = ends[s.stage] - s.progress;
		if (left <= 0) return null;
		const last = s.stage === ends.length - 1;
		return { months: left / s.monthly, to: last ? 'its end' : name(s.stage + 1) };
	}
	const floor = s.stage > 0 ? ends[s.stage - 1] : 0;
	if (s.progress <= floor) return null;
	return {
		months: (s.progress - floor) / -s.monthly,
		to: s.stage > 0 ? name(s.stage - 1) : '0'
	};
}

/** A stage and the progress it starts at: the stage before ends there (the first starts at 0). */
export type Rung = { name: string; from: number; to: number; current: boolean };
/** A situation's stages as thresholds — Operational Reserves: Empty 0, Low 1300, Medium 6500, High
 * 19500, to 26000 — with two or more stages; one stage is just its end. */
export function stageLadder(
	s: Pick<SituationInfo, 'stage' | 'ends'>,
	names: readonly string[]
): Rung[] {
	const ends = s.ends ?? [];
	if (ends.length < 2) return [];
	return ends.map((to, i) => ({
		name: names[i] ?? `stage ${i + 1}`,
		from: i ? ends[i - 1] : 0,
		to,
		current: s.stage === i
	}));
}

/** A situation's name where the data has none — its text is a scripted loc the game fills in
 * (Alarm Clock, Workshop 3790105183: `[This.GetAlarmLabel]`, picked by an `alarm_for_<what>`
 * flag): the flag's words, else the type's. */
export function fallbackName(s: Pick<SituationInfo, 'type' | 'flags'>): string {
	const alarm = s.flags?.find((f) => f.startsWith('alarm_for_') && f !== 'alarm_for_');
	if (alarm) {
		// the mod's label is the flag's words: `alarm_for_mod_celebrate_diversity` → "Celebrate
		// Diversity" (`mod_`: the cooldown modifier's; also `_cooldown`, `_flag`)
		const what = alarm
			.slice('alarm_for_'.length)
			.replace(/^mod_/, '')
			.replace(/_(cooldown|flag)$/, '')
			.split('_')
			.map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`)
			.join(' ');
		return `Reminder: ${what}`;
	}
	const words = pretty(s.type.replace(/^situation_/, ''));
	return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export function situationRows<S extends SituationInfo>(
	situations: S[],
	types: GameData['situationTypes']
): (S & SituationRow)[] {
	return situations.map((s) => ({
		...s,
		name: types[s.type]?.name || fallbackName(s),
		end: s.ends?.at(-1) ?? null,
		ladder: stageLadder(s, types[s.type]?.stages ?? []),
		next: nextStage(s, types[s.type]?.stages ?? []),
		category: types[s.type]?.category ?? null,
		approachName: s.approach ? (types[s.type]?.approaches[s.approach] ?? s.approach) : null,
		stageName: s.stage === null ? null : (types[s.type]?.stages[s.stage] ?? `stage ${s.stage + 1}`)
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
	reveal: Reveal & {
		wormholes?: boolean;
		wormholePairs?: boolean;
		lgates?: boolean;
		wanderlust?: boolean;
	},
	also: number[] = []
) {
	const known = knownIds(galaxy, also);
	const byId = new Map(galaxy.map((s) => [s.id, s]));
	const visited = (id: number) => byId.get(id)?.visited === true || byId.get(id)?.owned === true;
	const worm = (s: GalaxySystem) =>
		(s.wormholes ?? []).filter(
			(to) => reveal.wormholePairs || (reveal.wormholes && visited(s.id) && visited(to))
		);
	// a spoiler's systems, named: the L-Gates and the L-Cluster's; Wanderlust's targets
	const revealed = (s: GalaxySystem | undefined) =>
		(reveal.lgates === true && (s?.lgate === true || s?.lcluster === true)) ||
		(reveal.wanderlust === true && (s?.wanderlust?.length ?? 0) > 0);
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
		star: g.star, // the game shows every star's class, discovered or not
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
		star: '', // not spawned yet: no star class
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
 * `distar.11000` puts its entrance 550–560 from the galactic core (the save's 0,0) at 44–46°,
 * measured from −x towards −y in save coordinates: a throwaway game (2026-10-19, console event)
 * put `lcluster1` at (−395, −396), 559 out — the upper right of the map, x being drawn flipped.
 */
export const PREDICTED_LCLUSTER = {
	id: -1,
	name: 'L-Cluster (predicted — spawns when the gates open)',
	x: -555 * Math.cos(Math.PI / 4),
	y: -555 * Math.sin(Math.PI / 4)
};
