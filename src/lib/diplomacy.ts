import { agreementName, kindOf, parseKinds, type ContactKind } from './contacts.ts';
import { ethicDistance, federationPenalty, profile } from './ethics.ts';
import type { CountryInfo, DiploCountry, EthicAxis, Relation, WarSides } from './types.ts';

// The diplomacy tab: what we know of every empire and of the relations between them, as our intel
// shows them — or everything, with the `diplomacyAll` cheat. Pure.
//
// Intel (0–100 per country, `intel_manager`) gives a level per category, 4.5.2
// `common/intel_levels/00_intel_levels.txt`; what each level reveals is
// `common/intel_categories/*` — re-check both on game updates:
// - government 1 (intel 10, communications give that): ethics, civics, authority, capital, ruler
// - diplomacy 1 (intel 20): rivalries, federation name, GalCom votes, relative power
// - diplomacy 2 (intel 50): opinion breakdown, diplomatic pacts
// A pact between A and B shows through either side. Subjects and wars count as public (assumed:
// the map draws subjects, the war screen lists wars; not checked in game yet).

/** The tab's filters and graph layout, in the profile. */
export type DiplomacyView = {
	communicationsOnly: boolean;
	kinds: ContactKind[];
	layout: 'map' | 'circle';
	hiddenEdges: string[]; // edge kinds not drawn
	cluster: ClusterMode; // the circle's grouping
	threshold: number; // opinion clusters: the mutual opinion a group needs
	ethicsDistance: number; // ethics clusters: the mean steps apart a group may have
	cohesionFloor: number; // federation clusters: the least cohesion its ethics may cost
};
export const DEFAULT_DIPLOMACY_VIEW: DiplomacyView = {
	communicationsOnly: true,
	kinds: ['empires'],
	layout: 'circle',
	hiddenEdges: ['embassy', 'closed_borders'],
	cluster: 'blocs',
	threshold: 100,
	ethicsDistance: 3,
	cohesionFloor: -0.3 // two ethics more than three, nothing opposed
};
const num = (v: unknown, fallback: number) =>
	typeof v === 'number' && Number.isFinite(v) ? v : fallback;
export function parseDiplomacyView(v: unknown): DiplomacyView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<DiplomacyView>;
	return {
		communicationsOnly: o.communicationsOnly !== false,
		kinds: parseKinds(o.kinds),
		layout: o.layout === 'map' ? 'map' : 'circle',
		hiddenEdges: Array.isArray(o.hiddenEdges)
			? EDGE_KINDS.filter((k) => (o.hiddenEdges as unknown[]).includes(k))
			: DEFAULT_DIPLOMACY_VIEW.hiddenEdges,
		cluster: CLUSTER_MODES.includes(o.cluster as ClusterMode)
			? (o.cluster as ClusterMode)
			: 'blocs',
		threshold: num(o.threshold, DEFAULT_DIPLOMACY_VIEW.threshold),
		ethicsDistance: num(o.ethicsDistance, DEFAULT_DIPLOMACY_VIEW.ethicsDistance),
		cohesionFloor: num(o.cohesionFloor, DEFAULT_DIPLOMACY_VIEW.cohesionFloor)
	};
}

/**
 * How the circle groups empires: `blocs` — federations, and overlords with their subjects;
 * `opinion` — empires whose known opinions of each other average at least the threshold;
 * `pacts` — empires tied by pacts (`PACT_SCORE`), rivalries and wars pushing apart;
 * `ethics` — empires whose known ethics are on average at most `ethicsDistance` steps apart
 * (`ethicDistance()`); `federation` — groups whose ethics would cost a federation at most
 * `cohesionFloor` cohesion (`federationPenalty()`). Unknown ethics stay alone in both.
 */
export const CLUSTER_MODES = ['blocs', 'opinion', 'pacts', 'ethics', 'federation'] as const;
export type ClusterMode = (typeof CLUSTER_MODES)[number];

// how much a relation pulls two empires together (pacts mode); ours, not the game's
const PACT_SCORE: Record<string, number> = {
	defensive_pact: 3,
	subject: 2,
	guarantee: 2,
	research_agreement: 1,
	commercial_pact: 1,
	migration_access: 1,
	non_aggression_pledge: 1,
	waystation_pact: 1,
	embassy: 0.5,
	closed_borders: -1,
	is_rival: -3,
	war: -5
};

/**
 * A group of empires on the circle: a name where it has one (federation, overlord); in the
 * ethics modes the ethics all its members hold (`shared`) and what they cost a federation.
 */
export type Cluster = { label: string | null; ids: number[]; shared?: string[]; penalty?: number };

/**
 * Average-linkage grouping: start with each empire alone, merge the two groups that like each
 * other most while that is at least `min`. `affinity` is null where nothing is known — such pairs
 * do not count towards the average.
 */
export function agglomerate(
	ids: number[],
	affinity: (a: number, b: number) => number | null,
	min: number
): number[][] {
	let groups = ids.map((id) => [id]);
	for (;;) {
		let best: { i: number; j: number; v: number } | null = null;
		for (let i = 0; i < groups.length; i++)
			for (let j = i + 1; j < groups.length; j++) {
				const vs = groups[i].flatMap((a) =>
					groups[j].flatMap((b) => {
						const v = affinity(a, b);
						return v === null ? [] : [v];
					})
				);
				if (!vs.length) continue;
				const v = vs.reduce((x, y) => x + y, 0) / vs.length;
				if (v >= min && (!best || v > best.v)) best = { i, j, v };
			}
		if (!best) return groups;
		const { i, j } = best;
		groups = [...groups.filter((_, k) => k !== i && k !== j), [...groups[i], ...groups[j]]];
	}
}

/**
 * The same, scoring a would-be group as a whole: merge the two groups whose union scores best
 * while that is at least `min`.
 */
export function agglomerateGroups(
	ids: number[],
	score: (group: number[]) => number,
	min: number
): number[][] {
	let groups = ids.map((id) => [id]);
	for (;;) {
		let best: { i: number; j: number; v: number } | null = null;
		for (let i = 0; i < groups.length; i++)
			for (let j = i + 1; j < groups.length; j++) {
				const v = score([...groups[i], ...groups[j]]);
				if (v >= min && (!best || v > best.v)) best = { i, j, v };
			}
		if (!best) return groups;
		const { i, j } = best;
		groups = [...groups.filter((_, k) => k !== i && k !== j), [...groups[i], ...groups[j]]];
	}
}

export type EthicsData = { axes: Record<string, EthicAxis>; defines: Record<string, number> };

export function clusters(
	d: Pick<Diplomacy, 'opinions'>,
	nodes: DiploNode[],
	edges: DiploEdge[],
	mode: ClusterMode,
	limits: Pick<DiplomacyView, 'threshold' | 'ethicsDistance' | 'cohesionFloor'>,
	ethics: EthicsData = { axes: {}, defines: {} }
): Cluster[] {
	const { threshold } = limits;
	const ids = nodes.map((n) => n.id);
	const byId = new Map(nodes.map((n) => [n.id, n]));
	let groups: number[][];
	if (mode === 'blocs') {
		// overlord with subjects, then federation members together
		const root = (id: number): number => {
			const o = byId.get(id)?.overlord;
			return o !== null && o !== undefined && byId.has(o) ? root(o) : id;
		};
		const key = (id: number) => byId.get(root(id))?.federation?.value ?? `root:${root(id)}`;
		const m = new Map<string, number[]>();
		for (const id of ids) m.set(key(id), [...(m.get(key(id)) ?? []), id]);
		groups = [...m.values()];
	} else if (mode === 'opinion') {
		const op = (a: number, b: number) => d.opinions[`${a}:${b}`]?.value;
		groups = agglomerate(
			ids,
			(a, b) => {
				const vs = [op(a, b), op(b, a)].filter((v) => v !== undefined);
				return vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : null;
			},
			threshold
		);
	} else if (mode === 'ethics' || mode === 'federation') {
		const known = ids.filter((id) => byId.get(id)?.government);
		const ethicsOf = (id: number) => byId.get(id)?.government?.value.ethics ?? [];
		const unknown = ids.filter((id) => !byId.get(id)?.government).map((id) => [id]);
		if (mode === 'ethics') {
			const prof = new Map(known.map((id) => [id, profile(ethicsOf(id), ethics.axes)]));
			groups = agglomerate(
				known,
				(a, b) => -(ethicDistance(prof.get(a)!, prof.get(b)!) ?? Infinity),
				-limits.ethicsDistance
			);
		} else
			groups = agglomerateGroups(
				known,
				(g) => federationPenalty(g.map(ethicsOf), ethics.axes, ethics.defines),
				limits.cohesionFloor
			);
		groups = [...groups, ...unknown];
	} else {
		const score = new Map<string, number>();
		const pair = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;
		for (const e of edges)
			score.set(
				pair(e.from, e.to),
				(score.get(pair(e.from, e.to)) ?? 0) + (PACT_SCORE[e.kind] ?? 0)
			);
		// no relation counts as 0: a group holds together by its pacts, on average one per pair
		groups = agglomerate(ids, (a, b) => score.get(pair(a, b)) ?? 0, 1);
	}
	const label = (g: number[]): string | null => {
		if (g.length < 2) return null;
		if (mode !== 'blocs') return null;
		const n = byId.get(g[0]);
		return (
			n?.federation?.value ??
			byId.get(g.find((id) => byId.get(id)?.overlord === null) ?? g[0])?.name ??
			null
		);
	};
	const ethicsOf = (id: number) => byId.get(id)?.government?.value.ethics ?? [];
	const byEthics = mode === 'ethics' || mode === 'federation';
	return groups
		.map((g): Cluster => {
			if (!byEthics || g.length < 2) return { label: label(g), ids: g };
			const shared = ethicsOf(g[0]).filter((e) => g.every((id) => ethicsOf(id).includes(e)));
			const penalty = federationPenalty(g.map(ethicsOf), ethics.axes, ethics.defines);
			return { label: null, ids: g, shared, penalty };
		})
		.sort((a, b) => b.ids.length - a.ids.length);
}

/** How each kind of relation is drawn: its matrix abbreviation, colour and line width. */
export const EDGE_STYLES: Record<string, { short: string; color: string; width: number }> = {
	war: { short: 'W', color: '#dc2626', width: 3 },
	subject: { short: 'S', color: '#9333ea', width: 2.5 },
	is_rival: { short: 'R', color: '#f97316', width: 1.5 },
	defensive_pact: { short: 'DP', color: '#16a34a', width: 2 },
	guarantee: { short: 'G', color: '#6366f1', width: 1.5 },
	non_aggression_pledge: { short: 'NAP', color: '#84cc16', width: 1.5 },
	commercial_pact: { short: 'CP', color: '#d97706', width: 1.5 },
	research_agreement: { short: 'RA', color: '#2563eb', width: 1.5 },
	migration_access: { short: 'MT', color: '#0d9488', width: 1.5 },
	waystation_pact: { short: 'WP', color: '#0891b2', width: 1.5 },
	embassy: { short: 'E', color: '#9ca3af', width: 1 },
	closed_borders: { short: 'CB', color: '#6b7280', width: 1 }
};
export const EDGE_KINDS = Object.keys(EDGE_STYLES);
export const edgeLabel = (kind: string) =>
	kind === 'war' ? 'at war' : kind === 'subject' ? 'overlord → subject' : agreementName(kind);
export const edgeStyle = (kind: string) =>
	EDGE_STYLES[kind] ?? { short: kind, color: '#9ca3af', width: 1 };

/** Each edge's place among those of its pair: −½…+½ steps apart, so parallel lines do not overlap. */
export function pairOffsets(edges: { from: number; to: number }[]): number[] {
	const pair = (e: { from: number; to: number }) =>
		`${Math.min(e.from, e.to)}:${Math.max(e.from, e.to)}`;
	const count = new Map<string, number>();
	for (const e of edges) count.set(pair(e), (count.get(pair(e)) ?? 0) + 1);
	const seen = new Map<string, number>();
	return edges.map((e) => {
		const i = seen.get(pair(e)) ?? 0;
		seen.set(pair(e), i + 1);
		return i - ((count.get(pair(e)) ?? 1) - 1) / 2;
	});
}

/** The empires tied to `id` by any of `edges`, `id` included. */
export function neighbours(edges: { from: number; to: number }[], id: number): Set<number> {
	return new Set([
		id,
		...edges.flatMap((e) => (e.from === id ? [e.to] : e.to === id ? [e.from] : []))
	]);
}

/** The first intel of each level and its government and diplomacy levels (00_intel_levels.txt). */
const INTEL_LEVELS: { from: number; government: number; diplomacy: number }[] = [
	{ from: 0, government: 0, diplomacy: 0 },
	{ from: 10, government: 1, diplomacy: 0 },
	{ from: 20, government: 1, diplomacy: 1 },
	{ from: 30, government: 1, diplomacy: 1 },
	{ from: 40, government: 2, diplomacy: 1 },
	{ from: 50, government: 2, diplomacy: 2 },
	{ from: 60, government: 2, diplomacy: 2 },
	{ from: 70, government: 3, diplomacy: 2 },
	{ from: 80, government: 3, diplomacy: 3 },
	{ from: 90, government: 3, diplomacy: 3 },
	{ from: 99, government: 4, diplomacy: 4 }
];
export type IntelCategory = 'government' | 'diplomacy';

export function levelOf(intel: number, category: IntelCategory): number {
	return INTEL_LEVELS.findLast((l) => intel >= l.from)?.[category] ?? 0;
}

// what a fact needs: [category, level]
const NEEDS = {
	gov: ['government', 1],
	capital: ['government', 1],
	federation: ['diplomacy', 1],
	is_rival: ['diplomacy', 1],
	opinion: ['diplomacy', 2],
	pact: ['diplomacy', 2]
} as const satisfies Record<string, [IntelCategory, number]>;
type FactKind = keyof typeof NEEDS;

/** A fact as last seen: `stale` when our intel no longer shows it (seen last at `asOf`). */
export type Known<T> = { value: T; asOf: string; stale: boolean };

export type Government = {
	ethics: string[];
	authority: string | null;
	governmentType: string | null;
	civics: string[];
};

export type DiploNode = {
	id: number;
	name: string;
	type: string;
	kind: ContactKind;
	color: string | null; // its galaxy-map colour
	us: boolean;
	nomadic: boolean;
	communications: boolean;
	intel: number | null; // null: us
	government: Known<Government> | null;
	capital: Known<number> | null; // system
	federation: Known<string> | null;
	overlord: number | null;
	unmet: number; // relations shown with countries we have not met
};

export type EdgeKind = 'subject' | 'war' | 'is_rival' | string; // or a pact flag
/** A relation between two nodes; `subject` and `is_rival` point from overlord and rival. */
export type DiploEdge = {
	kind: EdgeKind;
	from: number;
	to: number;
	asOf: string;
	stale: boolean;
};

export type Diplomacy = {
	date: string;
	nodes: DiploNode[];
	edges: DiploEdge[];
	opinions: Record<string, Known<number>>; // `${from}:${to}`: from's opinion of to
	wars: WarSides[];
};

/** The saves the tab reads: those with the galaxy's diplomacy (READER 14 on). */
export type DiploSnap = {
	date: string;
	countryId: number | null;
	intel: { countryId: number; intel: number }[] | null;
	diplomacy: DiploCountry[] | null;
	allWars: WarSides[] | null;
	relations: Relation[] | null;
	countries: CountryInfo[] | null;
};

type Fact = { kind: FactKind; flag?: string; a: number; b?: number; value: unknown };
const keyOf = (f: Omit<Fact, 'value'>) => [f.kind, f.flag ?? '', f.a, f.b ?? ''].join('|');

/** Every fact a save holds, with the countries whose intel shows it. */
function factsOf(s: DiploSnap): Fact[] {
	const info = new Map((s.countries ?? []).map((c) => [c.id, c]));
	return (s.diplomacy ?? []).flatMap((c): Fact[] => {
		const i = info.get(c.id);
		return [
			...(i
				? [
						{
							kind: 'gov' as const,
							a: c.id,
							value: {
								ethics: i.ethics,
								authority: i.authority,
								governmentType: i.governmentType,
								civics: i.civics
							}
						}
					]
				: []),
			...(c.capitalSystem === null
				? []
				: [{ kind: 'capital' as const, a: c.id, value: c.capitalSystem }]),
			...(c.federation === null
				? []
				: [{ kind: 'federation' as const, a: c.id, value: c.federation }]),
			...c.relations.flatMap((r): Fact[] => [
				...(r.opinion === null
					? []
					: [{ kind: 'opinion' as const, a: c.id, b: r.countryId, value: r.opinion }]),
				...r.agreements.map((flag) =>
					flag === 'is_rival'
						? { kind: 'is_rival' as const, a: c.id, b: r.countryId, value: true }
						: // a pact once per pair, the lower id first
							{
								kind: 'pact' as const,
								flag,
								a: Math.min(c.id, r.countryId),
								b: Math.max(c.id, r.countryId),
								value: true
							}
				)
			])
		];
	});
}

/** Our intel level on each country in a save: everything on us, and with the cheat. */
function levelsAt(s: DiploSnap, us: number, cheat: boolean) {
	const intel = new Map((s.intel ?? []).map((i) => [i.countryId, i.intel]));
	return (id: number, category: IntelCategory) =>
		cheat || id === us ? Infinity : levelOf(intel.get(id) ?? 0, category);
}

/** A change of an empire's ethics our intel saw: somewhen after `after`, by `by`. */
export type EthicsChange = { from: string[]; to: string[]; after: string; by: string };

/**
 * Every change of ethics along the saves, per country, as our intel saw them: two readings in a
 * row that differ (with saves our intel did not reach between them, the change lies somewhere in
 * that gap). With `cheat`, every save's truth.
 */
export function ethicsHistory(snaps: DiploSnap[], cheat: boolean): Record<number, EthicsChange[]> {
	const steps = snaps.filter((s) => s.diplomacy !== null && s.intel !== null);
	const us = steps.at(-1)?.countryId ?? 0;
	const seen = new Map<number, { ethics: string[]; date: string }>();
	const out: Record<number, EthicsChange[]> = {};
	const same = (a: string[], b: string[]) => a.length === b.length && a.every((e) => b.includes(e));
	for (const s of steps) {
		const level = levelsAt(s, us, cheat);
		for (const c of s.countries ?? []) {
			if (level(c.id, NEEDS.gov[0]) < NEEDS.gov[1]) continue;
			const before = seen.get(c.id);
			if (before && !same(before.ethics, c.ethics))
				(out[c.id] ??= []).push({
					from: before.ethics,
					to: c.ethics,
					after: before.date,
					by: s.date
				});
			seen.set(c.id, { ethics: c.ethics, date: s.date });
		}
	}
	return out;
}

/**
 * What we know at the latest save: each fact as last seen while our intel showed it. A fact our
 * intel shows now is current (or gone); one it no longer shows keeps its last reading, stale.
 * With `cheat`, the latest save's truth.
 */
export function diplomacyView(
	snaps: DiploSnap[],
	flagColors: Record<string, string>,
	cheat: boolean
): Diplomacy | null {
	const steps = snaps.filter((s) => s.diplomacy !== null && s.intel !== null);
	const latest = steps.at(-1);
	if (!latest) return null;
	const us = latest.countryId ?? 0;
	const levels = (s: DiploSnap) => levelsAt(s, us, cheat);
	const canSee = (level: ReturnType<typeof levels>, f: Omit<Fact, 'value'>) => {
		// their opinion of us: the game always shows it
		if (f.kind === 'opinion' && f.b === us) return true;
		const [category, need] = NEEDS[f.kind];
		// a relation shows through its owner; a pact or rivalry through either side
		const sides = f.kind === 'opinion' || f.b === undefined ? [f.a] : [f.a, f.b];
		return sides.some((id) => level(id, category) >= need);
	};

	const memory = new Map<string, { fact: Fact; asOf: string; present: boolean }>();
	for (const s of cheat ? [latest] : steps) {
		const level = levels(s);
		const now = new Map(factsOf(s).map((f) => [keyOf(f), f]));
		for (const [k, f] of now)
			if (canSee(level, f)) memory.set(k, { fact: f, asOf: s.date, present: true });
		for (const [k, m] of memory)
			if (!now.has(k) && canSee(level, m.fact))
				memory.set(k, { ...m, asOf: s.date, present: false });
	}
	const known = [...memory.values()].filter((m) => m.present);
	const known1 = (kind: FactKind, id: number) => {
		const m = known.find((x) => x.fact.kind === kind && x.fact.a === id);
		return m ? { value: m.fact.value, asOf: m.asOf, stale: m.asOf < latest.date } : null;
	};

	// nodes: us and every country we have contact with — everything with the cheat
	const ours = new Map((latest.relations ?? []).map((r) => [r.countryId, r]));
	const info = new Map((latest.countries ?? []).map((c) => [c.id, c]));
	const intel = new Map((latest.intel ?? []).map((i) => [i.countryId, i.intel]));
	const shown = (latest.diplomacy ?? []).filter(
		(c) => cheat || c.id === us || ours.get(c.id)?.contact
	);
	const ids = new Set(shown.map((c) => c.id));
	const edges: DiploEdge[] = [
		...known
			.filter((m) => m.fact.kind === 'pact' || m.fact.kind === 'is_rival')
			.map((m) => ({
				kind: m.fact.kind === 'pact' ? m.fact.flag! : 'is_rival',
				from: m.fact.a,
				to: m.fact.b!,
				asOf: m.asOf,
				stale: m.asOf < latest.date
			})),
		// public: as of the latest save
		...shown.flatMap((c) =>
			c.overlord === null
				? []
				: [{ kind: 'subject', from: c.overlord, to: c.id, asOf: latest.date, stale: false }]
		)
	];
	const wars = (latest.allWars ?? []).filter((w) =>
		[...w.attackers, ...w.defenders].some((id) => ids.has(id))
	);
	for (const w of wars)
		for (const a of w.attackers)
			for (const d of w.defenders)
				edges.push({ kind: 'war', from: a, to: d, asOf: latest.date, stale: false });

	const nodes = shown.map((c): DiploNode => {
		const i = info.get(c.id);
		const type = i?.type ?? '';
		return {
			id: c.id,
			name: c.id === us ? 'us' : (ours.get(c.id)?.name ?? i?.name ?? String(c.id)),
			type,
			kind: kindOf(type),
			color: flagColors[i?.flagColor ?? ''] ?? null,
			us: c.id === us,
			nomadic: c.nomadic,
			communications: c.id === us || (ours.get(c.id)?.communications ?? false),
			intel: c.id === us ? null : (intel.get(c.id) ?? 0),
			government: known1('gov', c.id) as Known<Government> | null,
			capital: known1('capital', c.id) as Known<number> | null,
			federation: known1('federation', c.id) as Known<string> | null,
			overlord: c.overlord,
			unmet: new Set(
				edges.flatMap((e) =>
					e.from === c.id && !ids.has(e.to)
						? [e.to]
						: e.to === c.id && !ids.has(e.from)
							? [e.from]
							: []
				)
			).size
		};
	});
	const opinions = Object.fromEntries(
		known
			.filter((m) => m.fact.kind === 'opinion' && ids.has(m.fact.a) && ids.has(m.fact.b!))
			.map((m) => [
				`${m.fact.a}:${m.fact.b}`,
				{ value: m.fact.value as number, asOf: m.asOf, stale: m.asOf < latest.date }
			])
	);
	return {
		date: latest.date,
		nodes,
		edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
		opinions,
		wars
	};
}
