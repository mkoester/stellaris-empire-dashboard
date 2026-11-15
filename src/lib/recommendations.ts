import type { WhatIf } from './whatIf.ts';

export type RecommendationKind = 'edict' | 'policy' | 'designation' | 'decision';
export type Recommendation = {
	kind: RecommendationKind;
	label: string;
	target: string | null;
	planetId: number | null;
	possible: boolean | null;
	what: WhatIf;
};

/** Options with a positive trade or stability estimate, ordered by estimated trade value. */
export function worthwhile(rows: Recommendation[]): Recommendation[] {
	return rows.filter((r) => (r.what.net ?? 0) > 0 || (r.what.stability ?? 0) > 0).sort(rank);
}

/** Every estimated option for the panel's user-judged view, best trade estimate first. */
export function ranked(rows: Recommendation[]): Recommendation[] {
	return [...rows].sort(rank);
}

function rank(a: Recommendation, b: Recommendation): number {
	const netA = a.what.net ?? Number.NEGATIVE_INFINITY;
	const netB = b.what.net ?? Number.NEGATIVE_INFINITY;
	return (
		netB - netA ||
		(b.what.stability ?? Number.NEGATIVE_INFINITY) -
			(a.what.stability ?? Number.NEGATIVE_INFINITY) ||
		a.label.localeCompare(b.label)
	);
}
