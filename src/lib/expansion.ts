import type { Climate } from './climate.ts';
import type { Trait } from './colonyProfile.ts';
import type { PlanetDetailsData } from './districtCaps.ts';
import { sortBy, type SortValue } from './sort.ts';
import type { ExpansionPlanet } from './types.ts';

// Which surveyed planets the Expansion panel and tab list, and in what order. By default those of
// a colonizable class inside the borders; behind toggles terraforming candidates (Mars), toxic
// worlds — part of the candidates once the empire can detox them (`canDetox`) — and the rest
// (barren, molten, frozen, …); how far beyond the borders (`beyond`, jumps from the nearest own
// system; null = any distance); filters by class and by district types it allows (all of those
// picked); habitability for the species picked.

export type ExpansionRow = ExpansionPlanet & {
	className: string;
	colonizable: boolean;
	details: PlanetDetailsData | null;
	effects: { pros: Trait[]; cons: Trait[] }; // its features' and modifiers' effects
	hab: Record<string, number>; // estimated habitability per species id
	climate: Climate; // for the class's colour
};
export type SpeciesChoice = { id: string; name: string };

export type ExpansionView = {
	candidates: boolean;
	toxic: boolean; // toxic worlds, while the empire cannot detox them
	all: boolean;
	beyond: number | null;
	sort: { column: string; desc: boolean };
	cls: string; // planet class, '' = any
	districts: string[]; // district types it must allow (after clearing blockers); none = any
	species: string | null; // species id whose habitability shows; null = the main one
	habitatMin: number; // habitat sites: at least this many districts
	habitatSort: { column: string; desc: boolean };
};
export const DEFAULT_EXPANSION_VIEW: ExpansionView = {
	candidates: false,
	toxic: false,
	all: false,
	beyond: 0,
	sort: { column: 'beyond', desc: false },
	cls: '',
	districts: [],
	species: null,
	habitatMin: 10, // the game calls 10 a poor site
	habitatSort: { column: 'limit', desc: true }
};
export const RANGE_CHOICES = [...Array(11).keys()]; // +0 … +10, then "any"

/** A stored view in the current shape. */
export function parseExpansionView(v: unknown): ExpansionView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<ExpansionView> & {
		district?: unknown;
	};
	const str = (x: unknown) => (typeof x === 'string' ? x : '');
	return {
		candidates: o.candidates === true,
		toxic: o.toxic === true,
		all: o.all === true,
		beyond:
			o.beyond === null
				? null
				: Number.isInteger(o.beyond) && o.beyond! >= 0
					? o.beyond!
					: DEFAULT_EXPANSION_VIEW.beyond,
		sort:
			o.sort && typeof o.sort.column === 'string'
				? { column: o.sort.column, desc: !!o.sort.desc }
				: DEFAULT_EXPANSION_VIEW.sort,
		cls: str(o.cls),
		// a single `district` before several could be picked
		districts: Array.isArray(o.districts)
			? o.districts.filter((d): d is string => typeof d === 'string')
			: str(o.district)
				? [str(o.district)]
				: [],
		species: typeof o.species === 'string' ? o.species : null,
		habitatMin:
			Number.isInteger(o.habitatMin) && o.habitatMin! >= 0
				? o.habitatMin!
				: DEFAULT_EXPANSION_VIEW.habitatMin,
		habitatSort:
			o.habitatSort && typeof o.habitatSort.column === 'string'
				? { column: o.habitatSort.column, desc: !!o.habitatSort.desc }
				: DEFAULT_EXPANSION_VIEW.habitatSort
	};
}

/** A district type's cap once the blockers are cleared, and now. */
export const capOf = (p: ExpansionRow, district: string) => {
	const t = p.details?.caps.types.find((x) => x.district === district);
	return t?.cap ? { after: t.cap, now: t.cap - t.blocked } : null;
};
export const blockersOf = (p: ExpansionRow) =>
	p.planet?.deposits.filter((d) => p.details?.blockers.includes(d.key)).length ?? 0;

// a planet whose distance is unknown (unreachable, or an older snapshot) shows with "any" only
const inRange = (p: ExpansionRow, beyond: number | null) =>
	beyond === null || (p.beyond != null && p.beyond <= beyond);

// which toggle a planet the empire cannot colonize as it is falls under
const kind = (p: ExpansionRow, canDetox: boolean) =>
	p.candidate === null
		? 'rest'
		: p.candidate.startsWith('toxic') && !canDetox
			? 'toxic'
			: 'candidates';

export const visible = (p: ExpansionRow, view: ExpansionView, canDetox = false) =>
	inRange(p, view.beyond) &&
	(!view.cls || p.planetClass === view.cls) &&
	view.districts.every((d) => capOf(p, d) !== null) &&
	(p.colonizable ||
		{ candidates: view.candidates, toxic: view.toxic, rest: view.all }[kind(p, canDetox)]);

export function expansionCounts(rows: ExpansionRow[], canDetox = false) {
	const n = (k: string) => rows.filter((p) => !p.colonizable && kind(p, canDetox) === k).length;
	return { candidates: n('candidates'), toxic: n('toxic'), rest: n('rest') };
}

/** The capped district types among `rows`, in a stable order, for columns and the filter. */
export const districtTypes = (rows: ExpansionRow[]) =>
	[
		...new Set(
			rows.flatMap((p) => (p.details?.caps.types ?? []).filter((t) => t.cap).map((t) => t.district))
		)
	].sort();

/** Sort keys per column; `cap:<district>` sorts by that type's cap once blockers are cleared. */
export function sortValue(p: ExpansionRow, column: string, species: string): SortValue {
	if (column.startsWith('cap:')) return capOf(p, column.slice(4))?.after ?? null;
	switch (column) {
		case 'name':
			return p.name;
		case 'class':
		case 'hab':
			return p.hab[species] ?? null;
		case 'size':
			return p.size;
		case 'system':
			return p.system;
		case 'capital':
			return p.jumps;
		case 'shipyard':
			return p.shipyard ?? null;
		case 'beyond':
			return p.beyond ?? null;
		case 'districts':
			return p.details?.caps.limitCleared ?? null;
		case 'blockers':
			return blockersOf(p);
		case 'pros':
			return p.effects.pros.length;
		case 'cons':
			return p.effects.cons.length;
		default:
			return null;
	}
}

/** Sorted copy by the view's column. */
export const sortRows = (rows: ExpansionRow[], sort: ExpansionView['sort'], species: string) =>
	sortBy(rows, (r) => sortValue(r, sort.column, species), sort.desc);
