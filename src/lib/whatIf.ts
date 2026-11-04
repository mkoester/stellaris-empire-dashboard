import { changeGain, type GroupFlows } from './produce.ts';
import { changesOf, jobGroup, type Change } from './tradeoffs.ts';
import type { Colony, Resources } from './types.ts';
import {
	amenities,
	happinessStability,
	stabilityOutput,
	type WellbeingRules
} from './wellbeing.ts';

// What a set of modifiers would do if it held from now — pure, ≈ throughout. Two paths:
// - output: `<group>_produces_mult` and the like, as the produce tab prices edicts (`changesOf()`
//   → `changeGain()`: a share of what the group yields today — an upper bound, the game adds
//   multipliers);
// - wellbeing: amenities, happiness and stability, colony by colony, along the Luxury Goods chain
//   (#lib/wellbeing.ts): amenities → happiness → approval → stability (× the colony's
//   `stabilityMult`) → job output, which raises output, not upkeep.
// What neither path knows is listed, never dropped.

/** What the wellbeing path reads, per modifier key. */
export type Push = {
	amenitiesAdd: number;
	amenitiesMult: number;
	happiness: number;
	stability: number;
};
const NO_PUSH: Push = { amenitiesAdd: 0, amenitiesMult: 0, happiness: 0, stability: 0 };
const WELLBEING: Record<string, keyof Push> = {
	planet_amenities_add: 'amenitiesAdd',
	planet_amenities_mult: 'amenitiesMult',
	pop_happiness: 'happiness',
	planet_stability_add: 'stability'
};

/** One colony as the wellbeing path needs it. */
export type ColonyInput = {
	colony: Colony;
	jobOutput: Resources; // its jobs' output a month at today's stability (`jobOutput()`)
	uncapped: number | null; // stability before the cap (companion mod), else null
};

export type Chain = {
	amenities: number; // added
	happiness: number; // change from amenities and `pop_happiness` (0.05 = +5 points)
	approval: number; // the Pop Approval Rating after, 0–1
	stability: number; // points added before the cap
	stabilityAfter: number; // capped
	output: number; // change of the job output multiplier (0.06 = +6 %)
	monthly: Resources; // extra job output a month
};

/**
 * One colony through the chain, or null where the save lacks amenities or approval. A gestalt's
 * amenities move stability directly and it has no happiness.
 */
export function wellbeingChain(
	ci: ColonyInput,
	push: Partial<Push>,
	gestalt: boolean,
	r: WellbeingRules
): Chain | null {
	const p = { ...NO_PUSH, ...push };
	const { colony } = ci;
	const have = colony.amenities;
	const need = colony.amenitiesUsage;
	const approval = colony.approval ?? colony.happiness;
	if (have == null || need == null || (!gestalt && approval == null)) return null;
	const added = have * p.amenitiesMult + p.amenitiesAdd;
	const before = amenities(have, need, gestalt, r);
	const after = amenities(have + added, need, gestalt, r);
	if (!before || !after) return null;
	const fromAmenities = after.effect - before.effect;
	const happiness = gestalt ? 0 : fromAmenities + p.happiness;
	const approvalAfter = gestalt ? 0 : Math.min(1, Math.max(0, approval! + happiness));
	const mult = 1 + (colony.stabilityMult ?? 0);
	const stability =
		(gestalt
			? fromAmenities
			: happinessStability(approvalAfter, r) - happinessStability(approval!, r)) *
			mult +
		p.stability * mult;
	const now = ci.uncapped ?? colony.stability;
	const cap = (s: number) => Math.min(Math.max(s, r.minStability), r.maxStability);
	const outNow = stabilityOutput(cap(now), r);
	const output = stabilityOutput(cap(now + stability), r) - outNow;
	const monthly = Object.fromEntries(
		Object.entries(ci.jobOutput)
			.filter(([, v]) => v > 0)
			.map(([k, v]) => [k, (v / (1 + outNow)) * output])
	);
	return {
		amenities: added,
		happiness,
		approval: approvalAfter,
		stability,
		stabilityAfter: cap(now + stability),
		output,
		monthly
	};
}

export type WhatIf = {
	monthly: Resources; // output change a month, both paths summed
	stability: number | null; // mean stability points added over the colonies, pops-weighted
	modelled: string[]; // the modifier keys counted
	unmodelled: string[]; // the rest: shown, not counted
};

const add = (into: Resources, from: Resources, k = 1) => {
	for (const [r, v] of Object.entries(from)) into[r] = (into[r] ?? 0) + v * k;
};

// An empire-wide +10 % of a resource: ≈ that share of what jobs make of it (other sources left
// out). Here only — the trade-offs tab's rules leave it out on purpose.
// A designation's +15 % miners: extra workforce, so output (and upkeep, not counted) of that job.
const COUNTRY = /^country_(\w+)_produces_mult$/;
const WORKFORCE = /^(\w+?)_jobs_bonus_workforce_mult$/;
const changes = (mods: Record<string, number>): Change[] =>
	Object.entries(mods).flatMap(([k, v]): Change[] => {
		const base = { label: '', month: 0, pct: v, target: 'output' as const };
		const c = k.match(COUNTRY);
		if (c) return [{ ...base, groups: ['jobs'], resource: c[1] }];
		const w = k.match(WORKFORCE);
		if (w) return [{ ...base, groups: [jobGroup(w[1])] }];
		return changesOf('', 0, { [k]: v });
	});

/** Which modifier keys each path reads; the rest is unmodelled. */
export function split(modifiers: Record<string, number>) {
	const push: Partial<Push> = {};
	const output: Record<string, number> = {};
	const unmodelled: string[] = [];
	for (const [k, v] of Object.entries(modifiers)) {
		if (k in WELLBEING) push[WELLBEING[k]] = (push[WELLBEING[k]] ?? 0) + v;
		else if (changes({ [k]: v }).some((c) => c.target === 'output')) output[k] = v;
		else unmodelled.push(k);
	}
	return { push, output, unmodelled: unmodelled.sort() };
}

/**
 * What `modifiers` (key → value, a removed one negated) would do: their output modifiers on
 * `flows`, their wellbeing ones on each of `colonies`.
 */
export function whatIf(
	modifiers: Record<string, number>,
	flows: GroupFlows,
	colonies: ColonyInput[],
	gestalt: boolean,
	r: WellbeingRules
): WhatIf {
	const { push, output, unmodelled } = split(modifiers);
	const monthly: Resources = changeGain(changes(output), flows);
	let stability: number | null = null;
	if (Object.keys(push).length) {
		let points = 0;
		let pops = 0;
		for (const ci of colonies) {
			const c = wellbeingChain(ci, push, gestalt, r);
			if (!c) continue;
			add(monthly, c.monthly);
			points += c.stability * ci.colony.pops;
			pops += ci.colony.pops;
		}
		stability = pops > 0 ? points / pops : null;
	}
	return {
		monthly: Object.fromEntries(Object.entries(monthly).filter(([, v]) => Math.abs(v) > 1e-9)),
		stability,
		modelled: [
			...Object.keys(output),
			...Object.keys(modifiers).filter((k) => k in WELLBEING)
		].sort(),
		unmodelled
	};
}

/** The net modifiers of switching from `from` to `to` (a policy option, a designation). */
export function swapModifiers(
	from: Record<string, number> | undefined,
	to: Record<string, number> | undefined
): Record<string, number> {
	const out: Record<string, number> = { ...(to ?? {}) };
	for (const [k, v] of Object.entries(from ?? {})) out[k] = (out[k] ?? 0) - v;
	return Object.fromEntries(Object.entries(out).filter(([, v]) => Math.abs(v) > 1e-12));
}

/** A colony's output per group a modifier can target, from its job rows (output only, as `groupFlows()`). */
export function colonyFlows(
	rows: { type: string; category: string; flows?: Resources }[]
): GroupFlows {
	const out: GroupFlows = { jobs: {} };
	for (const r of rows) {
		const made = Object.fromEntries(Object.entries(r.flows ?? {}).filter(([, v]) => v > 0));
		for (const g of ['jobs', jobGroup(r.type), `stratum:${r.category}`]) {
			out[g] ??= {};
			add(out[g], made);
		}
	}
	return out;
}

// Designations by their district set, as the game's `potential`s split them (4.5.3
// `common/colony_types/00_colony_types.txt`: `uses_district_set`, `is_capital`, owner nomadic or
// wilderness). The save cannot answer those planet-scope triggers, so a colony's candidates are
// those of its own family — ≈, the game may still refuse one (a spiritualist bureau, a resort).
const FAMILIES = ['habitat', 'ring', 'ecu', 'mac', 'wilderness', 'nomad'];
const NEVER =
	/^col_(fe_|pre_ftl_|infested|contingency|cosmogenesis|nanotech|arkship_|trophy|nomad_trophy|hiv(_|$))/;

const familyOf = (key: string) => {
	const capital = /^col_(capital|wilderness_capital)/.test(key);
	const nomad = key.includes('nomad');
	const fam = FAMILIES.find((f) => key.startsWith(`col_${f}_`)) ?? (nomad ? 'nomad' : 'standard');
	return `${capital ? 'capital' : 'colony'}:${nomad ? 'nomad' : fam}`;
};

/** Gestalt-only designations (hive, machine, nexus) for gestalts, the rest for the others. */
const fitsGestalt = (key: string, gestalt: boolean) =>
	/(hive|machine|nexus|gestalt)/.test(key) === gestalt;

/** The designations this colony could switch to, ≈ (`FAMILIES`), its own left out. */
export function designationCandidates(current: string, all: string[], gestalt: boolean): string[] {
	const fam = familyOf(current);
	return all.filter(
		(k) => k !== current && !NEVER.test(k) && familyOf(k) === fam && fitsGestalt(k, gestalt)
	);
}
