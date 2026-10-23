import { agreementName, kindOf, parseKinds, type ContactKind } from './contacts.ts';
import type { CountryInfo, DiploCountry, Relation, WarSides } from './types.ts';

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
};
export const DEFAULT_DIPLOMACY_VIEW: DiplomacyView = {
	communicationsOnly: true,
	kinds: ['empires'],
	layout: 'map',
	hiddenEdges: ['embassy', 'closed_borders']
};
export function parseDiplomacyView(v: unknown): DiplomacyView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<DiplomacyView>;
	return {
		communicationsOnly: o.communicationsOnly !== false,
		kinds: parseKinds(o.kinds),
		layout: o.layout === 'circle' ? 'circle' : 'map',
		hiddenEdges: Array.isArray(o.hiddenEdges)
			? EDGE_KINDS.filter((k) => (o.hiddenEdges as unknown[]).includes(k))
			: DEFAULT_DIPLOMACY_VIEW.hiddenEdges
	};
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
	const levels = (s: DiploSnap) => {
		const intel = new Map((s.intel ?? []).map((i) => [i.countryId, i.intel]));
		return (id: number, category: IntelCategory) =>
			cheat || id === us ? Infinity : levelOf(intel.get(id) ?? 0, category);
	};
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
