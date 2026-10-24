import { GROWTH_CAP, type GrowthRow } from './growth.ts';

// Pop growth projected month by month — pure. Two kinds, kept apart because they follow different
// rules (4.5.2 defines, concepts "Biological Pops" grow, "Mechanical Pops" are assembled):
// - biological: logistic, LOGISTIC_POP_GROWTH_R × pops × (1 − pops / capacity), the factor never
//   under LOGISTIC_POP_GROWTH_FLOOR (10 %), small colonies counted as LOGISTIC_POP_GROWTH_MIN_POPS,
//   at most the galaxy's cap (5) — times the colony's growth speed, which is **calibrated**: its
//   measured growth ÷ the formula at today's pops, so every modifier (habitability, traits, edicts,
//   buildings) counts without being listed. Without a capacity it stays at the measured rate.
// - mechanical: assembly at the measured monthly mean.
// Both stop once the pops' housing need reaches OVERCROWDING_NO_GROWTH_THRESHOLD (and _ASSEMBLY_)
// × housing — housing need per pop as today. Housing, capacity and every modifier are held at
// today's values: no new districts, buildings, colonies, migration or techs.

export type Defines = Record<string, number>;
export type Projection = { pops: number[]; bio: number[]; mech: number[]; stopsAt: number | null };

const d = (defines: Defines, key: string, fallback: number) => defines[key] ?? fallback;

/** The logistic formula's growth at `pops` (speed 1, before the cap). */
export function logisticGrowth(pops: number, capacity: number, defines: Defines = {}): number {
	const r = d(defines, 'LOGISTIC_POP_GROWTH_R', 0.0025);
	const floor = d(defines, 'LOGISTIC_POP_GROWTH_FLOOR', 0.1);
	const min = d(defines, 'LOGISTIC_POP_GROWTH_MIN_POPS', 10);
	return r * Math.max(pops, min) * Math.max(1 - pops / capacity, floor);
}

/** The pops at which a colony stops growing: overcrowded past the threshold; null if unknown. */
export function growthLimit(
	row: Pick<GrowthRow, 'pops' | 'housing' | 'housingUsed'>,
	threshold: number
): number | null {
	if (!row.housing || !row.housingUsed || row.pops <= 0) return null;
	return (threshold * row.housing) / (row.housingUsed / row.pops);
}

/**
 * One colony over `months`: pops at each month start (index 0 = today) and the pops added so far
 * by growth (`bio`) and assembly (`mech`); `stopsAt` the month it hits its limit, if it does.
 */
export function projectColony(
	row: Pick<GrowthRow, 'pops' | 'growth' | 'assembly' | 'capacity' | 'housing' | 'housingUsed'>,
	months: number,
	defines: Defines = {}
): Projection {
	const cap = d(defines, 'LOGISTIC_CEILING_DEFAULT', GROWTH_CAP);
	const bioLimit = growthLimit(row, d(defines, 'OVERCROWDING_NO_GROWTH_THRESHOLD', 1.15));
	const mechLimit = growthLimit(row, d(defines, 'OVERCROWDING_NO_ASSEMBLY_THRESHOLD', 1.15));
	const measured = Math.max(row.growth ?? 0, 0);
	const model = row.capacity ? logisticGrowth(row.pops, row.capacity, defines) : 0;
	const speed = model > 0 ? measured / model : 0;
	const bioAt = (p: number) =>
		bioLimit !== null && p >= bioLimit
			? 0
			: speed > 0
				? Math.min(cap, speed * logisticGrowth(p, row.capacity!, defines))
				: measured;
	const assembly = Math.max(row.assembly ?? 0, 0);
	const out: Projection = { pops: [row.pops], bio: [0], mech: [0], stopsAt: null };
	let p = row.pops;
	for (let m = 1; m <= months; m++) {
		const bio = bioAt(p);
		const mech = mechLimit !== null && p >= mechLimit ? 0 : assembly;
		// a colony that grows today and no longer does: it reached its limit
		if (bio + mech <= 0 && out.stopsAt === null && measured + assembly > 0) out.stopsAt = m - 1;
		p += bio + mech;
		out.pops.push(p);
		out.bio.push(out.bio[m - 1] + bio);
		out.mech.push(out.mech[m - 1] + mech);
	}
	return out;
}

/** The colonies' projections summed: the empire's pops, grown and assembled. */
export function sumProjections(ps: Projection[], months: number): Omit<Projection, 'stopsAt'> {
	const at = (k: 'pops' | 'bio' | 'mech', m: number) => ps.reduce((n, p) => n + p[k][m], 0);
	const range = [...Array(months + 1).keys()];
	return {
		pops: range.map((m) => at('pops', m)),
		bio: range.map((m) => at('bio', m)),
		mech: range.map((m) => at('mech', m))
	};
}
