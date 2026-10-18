import type { Trait } from './colonyProfile.ts';
import type { PlanetDetailsData } from './districtCaps.ts';
import { sortBy, type SortValue } from './sort.ts';
import type { ExpansionPlanet } from './types.ts';

// Which surveyed planets the Expansion panel and tab list, and in what order. By default those of
// a colonizable class inside the borders; terraforming candidates (Mars; toxic worlds, which need
// the right perk, origin or civic) and the rest (barren, molten, frozen, …) each behind a toggle;
// how far beyond the borders (`beyond`, jumps from the nearest own system; null = any distance);
// filters by class and by a district type it allows; habitability for the species picked.

export type ExpansionRow = ExpansionPlanet & {
	className: string;
	colonizable: boolean;
	details: PlanetDetailsData | null;
	effects: { pros: Trait[]; cons: Trait[] }; // its features' and modifiers' effects
	hab: Record<string, number>; // estimated habitability per species id
};
export type SpeciesChoice = { id: string; name: string };

export type ExpansionView = {
	candidates: boolean;
	all: boolean;
	beyond: number | null;
	sort: { column: string; desc: boolean };
	cls: string; // planet class, '' = any
	district: string; // a district type it allows (after clearing blockers), '' = any
	species: string | null; // species id whose habitability shows; null = the main one
};
export const DEFAULT_EXPANSION_VIEW: ExpansionView = {
	candidates: false,
	all: false,
	beyond: 0,
	sort: { column: 'beyond', desc: false },
	cls: '',
	district: '',
	species: null
};
export const RANGE_CHOICES = [...Array(11).keys()]; // +0 … +10, then "any"

/** A stored view in the current shape. */
export function parseExpansionView(v: unknown): ExpansionView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<ExpansionView>;
	const str = (x: unknown) => (typeof x === 'string' ? x : '');
	return {
		candidates: o.candidates === true,
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
		district: str(o.district),
		species: typeof o.species === 'string' ? o.species : null
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

export const visible = (p: ExpansionRow, view: ExpansionView) =>
	inRange(p, view.beyond) &&
	(!view.cls || p.planetClass === view.cls) &&
	(!view.district || capOf(p, view.district) !== null) &&
	(p.colonizable || view.all || (view.candidates && p.candidate !== null));

export function expansionCounts(rows: ExpansionRow[]) {
	return {
		candidates: rows.filter((p) => !p.colonizable && p.candidate !== null).length,
		rest: rows.filter((p) => !p.colonizable && p.candidate === null).length
	};
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
