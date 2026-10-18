import type { PlanetDetailsData } from './districtCaps.ts';
import type { ExpansionPlanet } from './types.ts';

// Which surveyed planets the Expansion panel lists. By default those of a colonizable class
// inside the borders; terraforming candidates (Mars; toxic worlds, which need the right perk,
// origin or civic) and the rest (barren, molten, frozen, …) each behind a toggle, and how far
// beyond the borders (`beyond`, jumps from the nearest own system; null = any distance).

export type ExpansionRow = ExpansionPlanet & {
	className: string;
	colonizable: boolean;
	details: PlanetDetailsData | null;
};
export type ExpansionView = { candidates: boolean; all: boolean; beyond: number | null };
export const DEFAULT_EXPANSION_VIEW: ExpansionView = { candidates: false, all: false, beyond: 0 };

/** A stored view in the current shape. */
export function parseExpansionView(v: unknown): ExpansionView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<ExpansionView>;
	return {
		candidates: o.candidates === true,
		all: o.all === true,
		beyond:
			o.beyond === null
				? null
				: Number.isInteger(o.beyond) && o.beyond! >= 0
					? o.beyond!
					: DEFAULT_EXPANSION_VIEW.beyond
	};
}

// a planet whose distance is unknown (unreachable, or an older snapshot) shows with "any" only
const inRange = (p: ExpansionRow, beyond: number | null) =>
	beyond === null || (p.beyond != null && p.beyond <= beyond);

export const visible = (p: ExpansionRow, view: ExpansionView) =>
	inRange(p, view.beyond) &&
	(p.colonizable || view.all || (view.candidates && p.candidate !== null));

/** The range choices: +0 up to the farthest known planet. */
export const rangeChoices = (rows: ExpansionRow[]) => [
	...Array(Math.max(0, ...rows.map((p) => p.beyond ?? 0)) + 1).keys()
];

export function expansionCounts(rows: ExpansionRow[]) {
	return {
		candidates: rows.filter((p) => !p.colonizable && p.candidate !== null).length,
		rest: rows.filter((p) => !p.colonizable && p.candidate === null).length
	};
}
