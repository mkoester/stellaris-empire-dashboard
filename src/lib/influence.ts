// Influence: where it comes from, where it goes, and what the empire leaves uncollected.
//
// Power projection (budget `country_power_projection`): at most
// `country_power_projection_influence_produces_add` (2, `empire_base` in
// common/static_modifiers/00_static_modifiers.txt), reduced by the naval coverage shortage
// (`navy_coverage_shortage`: 1 − navy size ÷ empire size, clamped 0–1, mult −1). Fitted on 40
// saves (2026-11-05): navy size = 2 × used naval capacity, so coverage = min(1, 2 × used ÷ size)
// — 15 at 52 → 1.1538, 28 at 70 → 1.6, 15 at 119 → 0.5042. A navy of 0 booked 0.2 (Roaming
// Korinth; the throwaway Theian Preservers 2200.03–05 likewise): read as a floor of 10 % coverage.
// Rivals (common/diplomacy_economy): 0.5 influence each, × `rivalries_influence_produces_mult`.
// Slots: 3 (`empire_base`), +2 with the Animosity stance, +1 with Enmity adopted.

import { gameYear } from './series.ts';
import type { Series, Unbooked } from './series.ts';
import type { BudgetSource, Snapshot } from './types.ts';

export const PP_MAX = 2;
const COVERAGE_FLOOR = 0.1; // no navy books 0.2 (two empires)
export const RIVAL_INFLUENCE = 0.5;
const RIVAL_SLOTS = 3;

const influenceOf = (sources: BudgetSource[], source: string, side: 'income' | 'expenses') =>
	sources.find((s) => s.source === source)?.[side].influence ?? 0;

export type PowerProjection = {
	booked: number; // this month, from the budget
	max: number; // at full coverage
	coverage: number; // 0.1–1
	navalToMax: number; // more naval capacity to use for full coverage
	floored: boolean; // coverage at the estimated floor: max is the default, not measured
};

/**
 * Power projection now and at full naval coverage. The maximum is the booked amount ÷ coverage
 * (so modifiers are counted), the default 2 where coverage sits at the floor.
 */
export function powerProjection(
	empireSize: number,
	navalUsed: number,
	booked: number
): PowerProjection {
	const raw = empireSize > 0 ? (2 * navalUsed) / empireSize : 1;
	const floored = raw < COVERAGE_FLOOR;
	const coverage = Math.min(1, Math.max(COVERAGE_FLOOR, raw));
	return {
		booked,
		max: floored || booked <= 0 ? PP_MAX : booked / coverage,
		coverage,
		navalToMax: Math.max(0, Math.ceil(empireSize / 2) - navalUsed),
		floored
	};
}

/** Rival slots: the base 3, the Animosity stance's 2, Enmity's adoption 1. */
export function rivalSlots(policyFlags: string[], traditions: string[]): number {
	return (
		RIVAL_SLOTS +
		(policyFlags.some((f) => f.startsWith('diplo_stance_animosity')) ? 2 : 0) +
		(traditions.includes('tr_enmity_adopt') ? 1 : 0)
	);
}

export type Uncollected = { what: string; amount: number; how: string; estimated: boolean };

/**
 * Influence a month the empire could have and does not: power projection short of its maximum,
 * empty rival slots, and income lost at the storage cap (only known with the companion mod).
 */
export function uncollected(
	s: Snapshot,
	rivals: number,
	unbooked: Unbooked | null = null
): Uncollected[] {
	const budget = s.budget ?? [];
	const out: Uncollected[] = [];
	// a budget without the source (a gestalt or event country?) tells nothing
	if (
		s.empireSize !== null &&
		s.navalUsed !== null &&
		budget.some((b) => b.source === 'country_power_projection')
	) {
		const pp = powerProjection(
			s.empireSize,
			s.navalUsed,
			influenceOf(budget, 'country_power_projection', 'income')
		);
		if (pp.max - pp.booked > 0.005)
			out.push({
				what: 'power projection',
				amount: pp.max - pp.booked,
				how: `use ${pp.navalToMax} more naval capacity (${s.navalUsed} used, full coverage at ${Math.ceil(s.empireSize / 2)} for empire size ${s.empireSize})`,
				estimated: pp.floored
			});
	}
	if (s.policyFlags !== null && s.traditions !== null) {
		const free = rivalSlots(s.policyFlags, s.traditions) - rivals;
		const booked = influenceOf(budget, 'rivalries', 'income');
		const each = rivals > 0 && booked > 0 ? booked / rivals : RIVAL_INFLUENCE;
		if (free > 0)
			out.push({
				what: free === 1 ? 'a free rival slot' : `${free} free rival slots`,
				amount: free * each,
				how: 'declare a rival: needs terrible relations or a rivalry stance, and costs opinion',
				estimated: rivals === 0
			});
	}
	const lost = lostAtCap(s, unbooked);
	if (lost !== null)
		out.push({
			what: 'storage full',
			amount: lost.amount,
			how: `the stockpile stays at ${lost.at}: spend influence (claims, outposts, decisions)`,
			estimated: lost.estimated
		});
	return out;
}

/**
 * Income lost at the storage cap: the whole positive net while the stockpile is at its maximum
 * (the companion mod's `storageMax`), or — without the mod — while it did not move although the
 * budget booked a gain (Planetforgers 2214.01–02: 1000 both months, +5.8 booked).
 */
export function lostAtCap(
	s: Snapshot,
	u: Unbooked | null
): { amount: number; at: number; estimated: boolean } | null {
	const net = s.balance.influence ?? 0;
	const stock = s.stockpile.influence ?? 0;
	if (net <= 0) return null;
	const max = s.storageMax?.influence;
	if (max !== undefined) return stock >= max ? { amount: net, at: max, estimated: false } : null;
	return u && Math.abs(u.actual) < 0.005 && u.booked > 0
		? { amount: u.booked, at: stock, estimated: true }
		: null;
}

/** Readable names for the influence budget's sources; the rest as `sourceLabel` has them. */
export const INFLUENCE_LABELS: Record<string, string> = {
	country_base: 'base',
	country_power_projection: 'power projection',
	rivalries: 'rivals',
	pop_factions: 'factions',
	envoy_costs: 'envoys improving or harming relations',
	commercial_pacts: 'commercial pacts',
	research_agreements: 'research agreements',
	migration_pacts: 'migration treaties',
	non_aggression_pacts: 'non-aggression pacts',
	defensive_pacts: 'defensive pacts',
	guarantees: 'guarantees',
	waystation_pacts: 'wayline pacts',
	country_ruler: 'ruler',
	federation: 'federation',
	country_ethic: 'governing ethic',
	country_civics: 'civics',
	country_agendas: 'council agendas',
	edicts: 'edicts'
};

/**
 * Influence per month along the branch, one line per budget source that ever earned (+) or cost
 * (−) any, and the net. Mod-feed months carry no budget: a gap.
 */
export function influenceSeries(history: Snapshot[], label: (source: string) => string): Series {
	const sources = new Set(
		history.flatMap((s) =>
			(s.budget ?? [])
				.filter((b) => (b.income.influence ?? 0) !== 0 || (b.expenses.influence ?? 0) !== 0)
				.map((b) => b.source)
		)
	);
	const at = history.filter((s) => s.budget !== null);
	return {
		x: at.map((s) => gameYear(s.date)),
		lines: {
			net: at.map((s) => s.balance.influence ?? 0),
			...Object.fromEntries(
				[...sources].map((src) => [
					label(src),
					at.map((s) => {
						const b = s.budget!.find((x) => x.source === src);
						return b ? (b.income.influence ?? 0) - (b.expenses.influence ?? 0) : 0;
					})
				])
			)
		}
	};
}
