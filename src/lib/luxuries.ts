import type { Colony, Resources } from './types.ts';
import {
	amenities,
	happinessStability,
	stabilityOutput,
	type WellbeingRules
} from './wellbeing.ts';

// The planet decision "Distribute Luxury Goods" (`decision_planet_luxuries_boost`, 4.5.3
// common/decisions/00_resource_decisions.txt): Consumer Goods by the colony's pops, then
// `planet_luxuries_boost` (static_modifiers/08_static_modifiers_megacorp.txt) for 3600 days —
// `planet_amenities_mult` +25 %. Regular empires only, not on a Nanotech World, not while it runs.
// What it is worth follows the chain of #lib/wellbeing.ts: amenities → happiness → approval →
// stability → job output. Stability's `planet_jobs_produces_mult` raises output, not upkeep (the
// game's job tooltip, 2026-10-31: "High Stability +30 %" under Produces only, upkeep unchanged).

export const LUXURY_MODIFIER = 'planet_luxuries_boost';
export const LUXURY_MONTHS = 120; // 3600 days
const AMENITIES_MULT = 0.25;

/** Its cost in Consumer Goods: 100 per started 1000 pops, 8500–9999 → 900, at most 1000. */
export function luxuryCost(pops: number): number {
	if (pops >= 10000) return 1000;
	if (pops >= 8500) return 900;
	if (pops >= 7000) return 800;
	return 100 * (Math.floor(Math.max(pops, 0) / 1000) + 1);
}

export type LuxuryWhatIf = {
	cost: number; // Consumer Goods
	amenities: number; // added (≈: as if no other amenity multiplier)
	happiness: number; // change from amenities (0.05 = +5 points)
	approval: number; // the Pop Approval Rating after, 0–1
	stability: number; // points added before the cap
	stabilityAfter: number; // capped
	output: number; // change of the job output multiplier (0.06 = +6 %)
	monthly: Resources; // extra job output a month
	total: Resources; // over the decision's 10 years, the colony held as it is now
};

/**
 * What enacting it now would do, or null where it cannot be enacted (gestalt, Nanotech World,
 * already running) or the save lacks amenities or approval. `jobOutput`: the colony's jobs' output
 * a month per resource, at today's stability. **Approximations** (≈): +25 % of today's amenities
 * (other amenity multipliers would make it less), the citizens' happiness bonus taken for every
 * pop, today's output scaled back by stability's share alone (other output multipliers would make
 * the gain a little less), everything else held for the 10 years.
 */
export function luxuryWhatIf(
	colony: Colony,
	jobOutput: Resources,
	uncapped: number | null,
	gestalt: boolean,
	r: WellbeingRules
): LuxuryWhatIf | null {
	if (gestalt || colony.designation === 'col_nanotech_world') return null;
	if (colony.planet?.modifiers.some((m) => m.key === LUXURY_MODIFIER)) return null;
	const have = colony.amenities;
	const need = colony.amenitiesUsage;
	const approval = colony.approval ?? colony.happiness;
	if (have == null || need == null || approval == null) return null;
	const before = amenities(have, need, false, r);
	const added = have * AMENITIES_MULT;
	const after = amenities(have + added, need, false, r);
	if (!before || !after) return null;
	const happiness = after.effect - before.effect;
	const approvalAfter = Math.min(1, Math.max(0, approval + happiness));
	const mult = 1 + (colony.stabilityMult ?? 0);
	const stability = (happinessStability(approvalAfter, r) - happinessStability(approval, r)) * mult;
	const now = uncapped ?? colony.stability;
	const cap = (s: number) => Math.min(Math.max(s, r.minStability), r.maxStability);
	const outNow = stabilityOutput(cap(now), r);
	const output = stabilityOutput(cap(now + stability), r) - outNow;
	const monthly = Object.fromEntries(
		Object.entries(jobOutput)
			.filter(([, v]) => v > 0)
			.map(([k, v]) => [k, (v / (1 + outNow)) * output])
	);
	return {
		cost: luxuryCost(colony.pops),
		amenities: added,
		happiness,
		approval: approvalAfter,
		stability,
		stabilityAfter: cap(now + stability),
		output,
		monthly,
		total: Object.fromEntries(Object.entries(monthly).map(([k, v]) => [k, v * LUXURY_MONTHS]))
	};
}

/** The colony's jobs' output a month per resource: what their flows add (inputs left out). */
export function jobOutput(rows: { flows?: Resources }[]): Resources {
	const out: Resources = {};
	for (const f of rows.map((r) => r.flows ?? {}))
		for (const [k, v] of Object.entries(f)) if (v > 0) out[k] = (out[k] ?? 0) + v;
	return out;
}
