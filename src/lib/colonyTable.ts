import type { Profile } from './colonyProfile.ts';
import { CATEGORICAL } from './migration.ts';
import type { QueueItem, Resources } from './types.ts';

// The colonies tab: one row per colony, sortable by any column, filtered, shown as one table or
// one per sector. Pure — the page and the `all` tab's panel render it.

export type ColonyRow = {
	planetId: number;
	name: string;
	sector: string | null;
	designation: string;
	colonizing: boolean;
	planetClass: string; // display name
	size: number;
	pops: number;
	growth: number | null; // last month, net
	stability: number;
	happiness: number | null;
	habitability: number | null;
	freeHousing: number;
	freeAmenities: number;
	civilians: number;
	openJobs: number;
	net: Resources; // monthly output minus upkeep
	districts: { type: string; built: number; cap: number | null }[];
	room: number | null; // districts left under the planet's limit; null = unknown (habitats)
	blockers: number;
	queue: QueueItem[];
	automation: string; // summary, 'off' when off
	profile: Profile;
	problems: string[];
};

/** What needs attention on a colony; empty when nothing does. */
export function problems(
	c: Pick<
		ColonyRow,
		'stability' | 'freeHousing' | 'freeAmenities' | 'habitability' | 'civilians' | 'pops'
	>
): string[] {
	return [
		c.stability < 50 ? `stability ${Math.round(c.stability)} (below 50)` : null,
		c.freeHousing < 0 ? `housing short by ${Math.round(-c.freeHousing)}` : null,
		c.freeAmenities < 0 ? `amenities short by ${Math.round(-c.freeAmenities)}` : null,
		c.habitability !== null && c.habitability < 0.7
			? `habitability ${Math.round(c.habitability * 100)}%`
			: null,
		// civilians are normal in 4.x; a quarter of the pops without a job is a lot
		c.pops > 0 && c.civilians / c.pops > 0.25
			? `${Math.round((100 * c.civilians) / c.pops)}% of pops without a job`
			: null
	].filter((p) => p !== null);
}

const NONE = '(no sector)';
export const sectorName = (r: Pick<ColonyRow, 'sector'>) => r.sector ?? NONE;

/** A colour per sector, in order of first appearance (the capital's sector comes first). */
export function sectorColors(rows: Pick<ColonyRow, 'sector'>[]): Record<string, string> {
	const names = [...new Set(rows.map(sectorName))];
	return Object.fromEntries(names.map((n, i) => [n, CATEGORICAL[i % CATEGORICAL.length]]));
}

/** Rows grouped by sector, sectors in order of first appearance. */
export function bySector(rows: ColonyRow[]): { sector: string; rows: ColonyRow[] }[] {
	const out = new Map<string, ColonyRow[]>();
	for (const r of rows) out.set(sectorName(r), [...(out.get(sectorName(r)) ?? []), r]);
	return [...out].map(([sector, rows]) => ({ sector, rows }));
}

/** Sums of a group of rows, for a sector's header line (as the game's sector row). */
export function totals(rows: ColonyRow[]): { pops: number; net: Resources } {
	const net: Resources = {};
	for (const r of rows) for (const [k, v] of Object.entries(r.net)) net[k] = (net[k] ?? 0) + v;
	return { pops: rows.reduce((n, r) => n + r.pops, 0), net };
}

export type Filters = {
	text: string;
	sector: string; // '' = any
	designation: string; // '' = any
	suits: string; // resource, '' = any
	attention: boolean; // only colonies with problems
	freeDistricts: boolean;
	blockers: boolean;
};
export const NO_FILTERS: Filters = {
	text: '',
	sector: '',
	designation: '',
	suits: '',
	attention: false,
	freeDistricts: false,
	blockers: false
};

export function filterRows(rows: ColonyRow[], f: Filters): ColonyRow[] {
	const text = f.text.trim().toLowerCase();
	return rows.filter(
		(r) =>
			(!text || r.name.toLowerCase().includes(text)) &&
			(!f.sector || sectorName(r) === f.sector) &&
			(!f.designation || r.designation === f.designation) &&
			// among the two it suits best, as the column shows
			(!f.suits || r.profile.suits.slice(0, 2).some((s) => s.resource === f.suits)) &&
			(!f.attention || r.problems.length > 0 || r.profile.mismatch !== null) &&
			(!f.freeDistricts || (r.room ?? 0) > 0) &&
			(!f.blockers || r.blockers > 0)
	);
}

export type Sort = { column: string; desc: boolean };
type Value = number | string | null;

/** Sort keys per column; `net:<resource>` columns sort by that resource. */
export function sortValue(r: ColonyRow, column: string): Value {
	if (column.startsWith('net:')) return r.net[column.slice(4)] ?? 0;
	switch (column) {
		case 'name':
			return r.name;
		case 'sector':
			return sectorName(r);
		case 'designation':
			return r.designation;
		case 'class':
			return r.size;
		case 'pops':
			return r.pops;
		case 'growth':
			return r.growth;
		case 'stability':
			return r.stability;
		case 'happiness':
			return r.happiness;
		case 'habitability':
			return r.habitability;
		case 'housing':
			return r.freeHousing;
		case 'amenities':
			return r.freeAmenities;
		case 'civilians':
			return r.civilians;
		case 'jobs':
			return r.openJobs;
		case 'districts':
			return r.room;
		case 'suits':
			return r.profile.suits[0]?.score ?? null;
		case 'pros':
			return r.profile.pros.length;
		case 'cons':
			return r.profile.cons.length;
		case 'problems':
			return r.problems.length;
		case 'queue':
			return r.queue.length;
		default:
			return null;
	}
}

/** Sorted copy; unknown values (null) always last, ties keep their order. */
export function sortRows(rows: ColonyRow[], s: Sort): ColonyRow[] {
	const dir = s.desc ? -1 : 1;
	return rows
		.map((r, i) => ({ r, i, v: sortValue(r, s.column) }))
		.sort((a, b) => {
			if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
			const c =
				typeof a.v === 'string' || typeof b.v === 'string'
					? String(a.v).localeCompare(String(b.v))
					: a.v - b.v;
			return c * dir || a.i - b.i;
		})
		.map((x) => x.r);
}

/** The resources any colony makes or uses, in the game's top-bar order, for the net columns. */
export const NET_ORDER = [
	'energy',
	'minerals',
	'food',
	'alloys',
	'consumer_goods',
	'unity',
	'influence',
	'trade',
	'physics_research',
	'society_research',
	'engineering_research',
	'volatile_motes',
	'exotic_gases',
	'rare_crystals'
];
export function netResources(rows: ColonyRow[]): string[] {
	const seen = new Set(rows.flatMap((r) => Object.keys(r.net).filter((k) => r.net[k] !== 0)));
	return [
		...NET_ORDER.filter((k) => seen.has(k)),
		...[...seen].filter((k) => !NET_ORDER.includes(k)).sort()
	];
}

/** The columns the picker offers; `net` stands for all net-output columns. */
export const COLUMNS = [
	{ id: 'sector', label: 'Sector' },
	{ id: 'designation', label: 'Designation' },
	{ id: 'class', label: 'Class / size' },
	{ id: 'pops', label: 'Pops' },
	{ id: 'growth', label: '±/mo' },
	{ id: 'stability', label: 'Stability' },
	{ id: 'happiness', label: 'Happiness' },
	{ id: 'habitability', label: 'Habitability' },
	{ id: 'housing', label: 'Free housing' },
	{ id: 'amenities', label: 'Free amenities' },
	{ id: 'civilians', label: 'Civilians' },
	{ id: 'jobs', label: 'Open jobs' },
	{ id: 'net', label: 'Net output' },
	{ id: 'districts', label: 'Districts' },
	{ id: 'suits', label: 'Suits' },
	{ id: 'pros', label: '▲ pros' },
	{ id: 'cons', label: '▼ cons' },
	{ id: 'queue', label: 'Build queue' },
	{ id: 'automation', label: 'Automation' }
] as const;
export type ColumnId = (typeof COLUMNS)[number]['id'];
export const DEFAULT_COLUMNS: ColumnId[] = COLUMNS.map((c) => c.id).filter(
	(id) => !['happiness', 'housing', 'amenities', 'civilians', 'jobs', 'automation'].includes(id)
);

/** The stored view of the colonies tab (`colonyView` setting). */
export type ColonyView = {
	mode: 'all' | 'sector';
	sort: Sort;
	filters: Filters;
	columns: ColumnId[];
};
export const DEFAULT_VIEW: ColonyView = {
	mode: 'all',
	sort: { column: 'pops', desc: true },
	filters: NO_FILTERS,
	columns: DEFAULT_COLUMNS
};

/** A stored view brought to the current shape: unknown columns dropped, missing fields defaulted. */
export function parseView(v: unknown): ColonyView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<ColonyView>;
	const ids: readonly string[] = COLUMNS.map((c) => c.id);
	return {
		mode: o.mode === 'sector' ? 'sector' : 'all',
		sort:
			o.sort && typeof o.sort.column === 'string'
				? { column: o.sort.column, desc: !!o.sort.desc }
				: DEFAULT_VIEW.sort,
		filters: Object.fromEntries(
			Object.entries(NO_FILTERS).map(([k, d]) => {
				const v = (o.filters as Record<string, unknown> | undefined)?.[k];
				return [k, typeof v === typeof d ? v : d];
			})
		) as Filters,
		columns: Array.isArray(o.columns)
			? (o.columns.filter((c) => ids.includes(c)) as ColumnId[])
			: DEFAULT_COLUMNS
	};
}
