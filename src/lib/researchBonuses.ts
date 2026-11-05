// Research bonuses by how they stack — pure. Three piles, each summed within, multiplied across
// (the usual rule for modifiers; the game files name the modifiers, the engine combines them):
// - output: research points a month — `planet_jobs_<area>_research_produces_mult` (jobs) and
//   `country_<area>_research_produces_mult`; the budget books the result exactly.
// - speed: progress per point — `all_technology_research_speed`, `country_<area>_tech_research_speed`,
//   `category_<field>_research_speed_mult` (the tech's field), `rare_tech_research_speed_mult`;
//   the result is measured (#lib/researchSpeed.ts), which checks the sum.
// - cost: `<area>_tech_cost_mult`, besides the galaxy slider, difficulty and empire size.
// Within a pile each bonus adds to the others, so one more is worth bonus ÷ (1 + pile): +10 % on top
// of +48 % speed is +6.8 % real. Only the sources the dashboard can read count (`empireHeld`,
// the council at its level): leader traits off the council, planet-local and triggered ones not.

import type { Modifier } from './types.ts';

export const AREAS = ['physics', 'society', 'engineering'] as const;
export type Pile = 'output' | 'speed' | 'cost';
export type Scope =
	| { kind: 'all' }
	| { kind: 'area'; area: string }
	| { kind: 'category'; category: string }
	| { kind: 'rare' }
	| { kind: 'jobs'; area: string }; // output of jobs only (stations not)

/** Which pile and scope a modifier key belongs to; null: not about research. */
export function classify(key: string): { pile: Pile; scope: Scope } | null {
	let m: RegExpExecArray | null;
	if (key === 'all_technology_research_speed') return { pile: 'speed', scope: { kind: 'all' } };
	if (key === 'rare_tech_research_speed_mult') return { pile: 'speed', scope: { kind: 'rare' } };
	if ((m = /^country_(physics|society|engineering)_tech_research_speed$/.exec(key)))
		return { pile: 'speed', scope: { kind: 'area', area: m[1] } };
	if ((m = /^category_(\w+)_research_speed_mult$/.exec(key)))
		return { pile: 'speed', scope: { kind: 'category', category: m[1] } };
	if ((m = /^(physics|society|engineering)_tech_cost_mult$/.exec(key)))
		return { pile: 'cost', scope: { kind: 'area', area: m[1] } };
	if ((m = /^country_(physics|society|engineering)_research_produces_mult$/.exec(key)))
		return { pile: 'output', scope: { kind: 'area', area: m[1] } };
	if ((m = /^planet_jobs_(physics|society|engineering)_research_produces_mult$/.exec(key)))
		return { pile: 'output', scope: { kind: 'jobs', area: m[1] } };
	return null;
}

export type Source = {
	ref: string;
	name: string;
	modifiers: Pick<Modifier, 'key' | 'value' | 'when'>[];
	count?: number;
};
export type Line = { ref: string; name: string; pile: Pile; scope: Scope; value: number };

/** Every research modifier of the sources that hold, one line each (× how many hold). */
export function researchLines(sources: Source[]): Line[] {
	return sources.flatMap((s) =>
		s.modifiers.flatMap((m) => {
			const c = classify(m.key);
			return c && m.value !== 0 && !m.when
				? [{ ref: s.ref, name: s.name, ...c, value: m.value * (s.count ?? 1) }]
				: [];
		})
	);
}

/** Whether a line applies to a tech (its area, field, rarity) or, without a tech, to an area. */
export function appliesTo(
	scope: Scope,
	area: string,
	tech?: { category?: string | null; rare?: boolean }
): boolean {
	switch (scope.kind) {
		case 'all':
			return true;
		case 'area':
		case 'jobs':
			return scope.area === area;
		case 'category':
			return tech?.category === scope.category;
		case 'rare':
			return tech?.rare === true;
	}
}

/** A pile's sum for an area (and a tech in it). */
export const pileSum = (
	lines: Line[],
	pile: Pile,
	area: string,
	tech?: { category?: string | null; rare?: boolean }
) =>
	lines
		.filter((l) => l.pile === pile && appliesTo(l.scope, area, tech))
		.reduce((t, l) => t + l.value, 0);

/** What one more bonus is really worth in a pile that already sums to `sum`. */
export const realGain = (bonus: number, sum: number) => bonus / (1 + sum);

export function scopeLabel(s: Scope): string {
	switch (s.kind) {
		case 'all':
			return 'all research';
		case 'area':
			return s.area;
		case 'jobs':
			return `${s.area} jobs`;
		case 'category':
			return s.category.replaceAll('_', ' ');
		case 'rare':
			return 'rare techs';
	}
}
