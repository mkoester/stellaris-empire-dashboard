import type { PlanetDetailsData } from './districtCaps.ts';
import type { ExpansionPlanet } from './types.ts';

// Which surveyed planets the Expansion panel lists. By default those of a colonizable class;
// terraforming candidates (Mars; toxic worlds, which need the right perk, origin or civic) and
// the rest (barren, molten, frozen, …) each behind a toggle.

export type ExpansionRow = ExpansionPlanet & {
	className: string;
	colonizable: boolean;
	details: PlanetDetailsData | null;
};
export type ExpansionView = { candidates: boolean; all: boolean };

export const visible = (p: ExpansionRow, view: ExpansionView) =>
	p.colonizable || view.all || (view.candidates && p.candidate !== null);

export function expansionCounts(rows: ExpansionRow[]) {
	return {
		candidates: rows.filter((p) => !p.colonizable && p.candidate !== null).length,
		rest: rows.filter((p) => !p.colonizable && p.candidate === null).length
	};
}
