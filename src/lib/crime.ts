import type { Resources } from './types.ts';

// The two crime decisions on one colony — pure, ≈ throughout (4.5 game files). Both are valued
// by the enforcers it takes to hold the colony's crime at `CRIME_TARGET`, so crime ends at the
// same level either way and its own stability penalty (engine-side, in no script file) drops out
// of the comparison:
// - an Enforcer job (100 workforce) takes 25 crime off and adds 0.2 stability
//   (`inline_scripts/jobs/job_enforcer.txt`); the Anti-Crime Campaign takes 10 more off each and
//   costs each +2 energy (`job_enforcer_additional_modifiers.txt`, `anticrime_campaign`): 1/25 −
//   1/35 of a job fewer per crime point, workforce that can fill open jobs.
// - the Crime Lords deal (`crime_lord_deal`): +10 stability, crime +50 % (enforcers to match),
//   +200 criminal workforce and 3 more per crime point. Criminal jobs are filled before others and
//   make nothing, so they take that workforce from the unemployed first, then from other jobs.

// What the game's crime automation holds (`automate_crime_management`: +10 enforcer workforce
// above 25, −1 below 1) — under the 30 where Criminal Underworld may appear each year (crime.40).
export const CRIME_TARGET = 25;
export const ENFORCER_CRIME = 25; // crime one enforcer job takes off
export const CAMPAIGN_CRIME = 10; // more, during the campaign
export const ENFORCER_STABILITY = 0.2;
export const CRIME_LORDS_CRIMINALS = 200; // workforce (`job_criminal_add`)
// `job_criminal_per_crime = 0.03`: jobs per crime point, so 3 workforce — the wiki's "+100
// Criminal jobs per 33 Crime" (Crime page, verified for 4.5)
export const CRIMINALS_PER_CRIME = 3;
export const CRIME_LORDS_CRIME_MULT = 0.5;

export type CrimeColony = {
	crime: number; // now, after enforcers (floored at 0)
	enforcers: number; // workforce in enforcer jobs
	enforcerUpkeep: Resources; // what those enforcers use a month (their jobs' inputs)
	open: number; // open workforce in other jobs
	idle: number; // unemployed workforce (civilians)
	perWorkforce: Resources; // the colony's other jobs' net output per workforce (their inputs taken off)
};

export type CrimeEffect = {
	monthly: Resources; // output gained (+) or lost (−)
	upkeep: Resources; // upkeep added (+) or saved (−)
	stability: number; // flat points, beside the decision's own modifiers
	// enforcer workforce that holds crime at `CRIME_TARGET` without the decision and with it
	enforcersWithout: number;
	enforcersWith: number;
	// crime it settles at without the decision and with it: apart only below the target, where
	// its stability penalty is not counted
	crimeWithout: number;
	crimeWith: number;
	criminalsTaken: number; // workforce taken from other jobs
};

const scaled = (r: Resources, by: number): Resources =>
	Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v * by]));

/** Crime before enforcers: an upper bound where crime is at 0 (enforcers may be spare). */
const gross = (c: CrimeColony) => c.crime + (c.enforcers / 100) * ENFORCER_CRIME;

/** Enforcer workforce that holds `crime` (before enforcers) at `CRIME_TARGET`, at `perJob` a job. */
const toTarget = (crime: number, perJob: number) =>
	(Math.max(0, crime - CRIME_TARGET) / perJob) * 100;

/** Workforce moved into (+) or out of (−) other jobs: only into open ones, out of filled ones. */
const moved = (c: CrimeColony, workforce: number) =>
	scaled(c.perWorkforce, workforce > 0 ? Math.min(workforce, c.open) : workforce);

/** Enforcers' own upkeep, per workforce, × `workforce`. */
const enforcerUpkeep = (c: CrimeColony, workforce: number) =>
	c.enforcers > 0 ? scaled(c.enforcerUpkeep, workforce / c.enforcers) : {};

/**
 * The campaign, enforcers held at what keeps crime at the target: fewer of them, the rest working open
 * jobs; those kept pay +2 energy each. The decision's own `planet_enforcers_energy_upkeep_add`
 * prices today's enforcers, so only the change in their number is counted here.
 */
export function antiCrime(c: CrimeColony): CrimeEffect {
	const g = gross(c);
	const freed = toTarget(g, ENFORCER_CRIME) - toTarget(g, ENFORCER_CRIME + CAMPAIGN_CRIME);
	const kept = toTarget(g, ENFORCER_CRIME + CAMPAIGN_CRIME);
	const upkeep = enforcerUpkeep(c, -freed);
	// +2 energy on the kept ones, less what the decision's modifier already books on today's
	upkeep.energy = (upkeep.energy ?? 0) + ((kept - c.enforcers) / 100) * 2;
	return {
		monthly: moved(c, freed),
		upkeep,
		stability: -(freed / 100) * ENFORCER_STABILITY,
		enforcersWithout: toTarget(g, ENFORCER_CRIME),
		enforcersWith: kept,
		crimeWithout: Math.min(g, CRIME_TARGET),
		crimeWith: Math.min(g, CRIME_TARGET),
		criminalsTaken: 0
	};
}

/**
 * The deal: its criminal jobs take workforce (the unemployed's first), and its +50 % crime takes
 * that many more enforcers to hold at 0 (its +10 stability is a modifier).
 */
export function crimeLords(c: CrimeColony): CrimeEffect {
	const g = gross(c);
	const more =
		toTarget(g * (1 + CRIME_LORDS_CRIME_MULT), ENFORCER_CRIME) - toTarget(g, ENFORCER_CRIME);
	const crimeWith = Math.min(g * (1 + CRIME_LORDS_CRIME_MULT), CRIME_TARGET);
	const taken = Math.max(0, CRIME_LORDS_CRIMINALS + CRIMINALS_PER_CRIME * crimeWith - c.idle);
	return {
		monthly: moved(c, -(taken + more)),
		upkeep: enforcerUpkeep(c, more),
		stability: (more / 100) * ENFORCER_STABILITY,
		enforcersWithout: toTarget(g, ENFORCER_CRIME),
		enforcersWith: toTarget(g * (1 + CRIME_LORDS_CRIME_MULT), ENFORCER_CRIME),
		crimeWithout: Math.min(g, CRIME_TARGET),
		crimeWith,
		criminalsTaken: taken
	};
}

/** The colony's crime inputs from its job rows; null where the save has no crime. */
export function crimeColony(
	rows: { type: string; filled: number; flows?: Resources }[],
	crime: number | null | undefined,
	open: number,
	idle: number
): CrimeColony | null {
	if (crime == null) return null;
	let enforcers = 0;
	let others = 0;
	const enforcerUpkeep: Resources = {};
	const made: Resources = {};
	for (const r of rows) {
		if (r.type === 'enforcer') {
			enforcers += r.filled;
			for (const [k, v] of Object.entries(r.flows ?? {}))
				if (v < 0) enforcerUpkeep[k] = (enforcerUpkeep[k] ?? 0) - v;
		} else if (r.type !== 'criminal') {
			others += r.filled;
			for (const [k, v] of Object.entries(r.flows ?? {})) made[k] = (made[k] ?? 0) + v;
		}
	}
	return {
		crime,
		enforcers,
		enforcerUpkeep,
		open: Math.max(0, open),
		idle: Math.max(0, idle),
		perWorkforce: others > 0 ? scaled(made, 1 / others) : {}
	};
}

export const CRIME_DECISIONS: Record<string, (c: CrimeColony) => CrimeEffect> = {
	decision_launch_anticrime_campaign: antiCrime,
	decision_negotiate_with_crime_lords: crimeLords
};
