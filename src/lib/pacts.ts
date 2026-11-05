// What each pact gives, per type and partner (4.5.x game files):
// - Upkeep (common/diplomacy_economy/00_diplomacy_economy.txt): migration treaty, research
//   agreement and commercial pact 0.25 influence each (free with some federation perks and laws,
//   commercial pacts with Universal Transactions), non-aggression pact 0.25, defensive pact 1,
//   guarantee 0.5. The budget books each type under its own category.
// - Commercial pact: 10 % of the partner's trade production (`COMMERCIAL_PACTS_INCOME_PERCENTAGE`),
//   not taken from the partner, booked as trade under `commercial_pacts`. Fit: Planetforgers
//   2214.02 booked 46.85, Σ 0.1 × (partner's trade income − its own commercial pacts' trade) 46.83.
// - Research agreement: +25 % research speed (`RESEARCH_AGREEMENT_SPEED_MULT`) on a tech the
//   partner has (concept_research_agreement_desc). Read as added to the research speed we already
//   have (measured, #lib/researchSpeed.ts): +0.25 × output a month, and of a tech's time
//   0.25 ÷ (factor + 0.25) saved — 20 % at no other bonus, 14.5 % at ×1.48. Not confirmed: no save
//   yet has a month whose tech in progress a partner had. Two partners with it: counted once.
// - Migration treaty: pops of both empires may settle in the other's colonies.
// Intel (common/intel_categories): technology level 1 (intel ≥ 30; an agreement keeps it there)
// shows the number of techs per area, no level lists them; economy level 3 (intel ≥ 90) shows
// resource production.

import { savedShare } from './researchSpeed.ts';
import { gameYear } from './series.ts';
import type { Series } from './series.ts';
import type { AiIntel, BudgetSource, EmpireSpecies, Relation, Snapshot } from './types.ts';

export const PACT_TYPES = [
	{ key: 'migration_access', name: 'migration treaty', budget: 'migration_pacts' },
	{ key: 'commercial_pact', name: 'commercial pact', budget: 'commercial_pacts' },
	{ key: 'research_agreement', name: 'research agreement', budget: 'research_agreements' },
	{ key: 'non_aggression_pledge', name: 'non-aggression pact', budget: 'non_aggression_pacts' },
	{ key: 'defensive_pact', name: 'defensive pact', budget: 'defensive_pacts' },
	{ key: 'guarantee', name: 'guarantee', budget: 'guarantees' },
	{ key: 'waystation_pact', name: 'wayline pact', budget: 'waystation_pacts' }
] as const;
export type PactKey = (typeof PACT_TYPES)[number]['key'];

export const COMMERCIAL_SHARE = 0.1;
export const RESEARCH_SPEED = 0.25;

const flows = (sources: BudgetSource[], source: string) => {
	const s = sources.find((x) => x.source === source);
	return { income: s?.income ?? {}, expenses: s?.expenses ?? {} };
};

export type PactType = {
	key: PactKey;
	name: string;
	partners: { countryId: number; name: string }[];
	upkeep: number; // influence a month, booked
	gain: Record<string, number>; // what the budget books as its income (commercial pacts: trade)
};

/** Every pact type we hold at least one of, with its partners and what the budget books. */
export function pactTypes(relations: Relation[], budget: BudgetSource[]): PactType[] {
	return PACT_TYPES.map((t) => {
		const f = flows(budget, t.budget);
		return {
			key: t.key,
			name: t.name,
			partners: relations
				.filter((r) => r.agreements.includes(t.key))
				.map((r) => ({ countryId: r.countryId, name: r.name })),
			upkeep: f.expenses.influence ?? 0,
			gain: f.income
		};
	}).filter((t) => t.partners.length > 0);
}

export type CommercialShare = {
	countryId: number;
	trade: number | null; // what this pact brings us a month; null: not known
	base: number | null; // the partner's own trade production
};

/**
 * The booked commercial pact trade split by partner: 10 % of each partner's trade production
 * (its trade income less what its own pacts bring it). Partners without a known base get null,
 * and `rest` is what the booked total leaves for them.
 */
export function commercialSplit(
	total: number,
	partners: { countryId: number; base: number | null }[]
): { shares: CommercialShare[]; rest: number; predicted: number } {
	const shares = partners.map((p) => ({
		countryId: p.countryId,
		base: p.base,
		trade: p.base === null ? null : Math.max(0, p.base) * COMMERCIAL_SHARE
	}));
	const predicted = shares.reduce((t, s) => t + (s.trade ?? 0), 0);
	return { shares, predicted, rest: total - predicted };
}

/** A partner's trade production from its intel: gross trade income less its pacts' trade. */
export const tradeBase = (ai: AiIntel) => (ai.income.trade ?? 0) - (ai.commercialPactTrade ?? 0);

export type TechGap = { key: string; cost: number; area: string; inReach: boolean };

export type ResearchValue = {
	countryId: number;
	ours: { techs: TechGap[]; savedInReach: number; saved: number }; // techs they have, we lack
	theirs: { count: number; saved: number }; // ours they lack
	thisMonth: { area: string; tech: string; extra: number }[]; // research in progress they know
};

type TechInfo = (key: string) => { cost: number; area: string };

/** Our research speed factor per area (#lib/researchSpeed.ts); 1 where not measured. */
export type Factor = (area: string) => number;

/**
 * What a research agreement is worth to each side: the share of every tech only the other has
 * that +25 % on top of the side's own speed saves (ours: measured; theirs: unknown, read as none —
 * an upper bound), ours within reach first; and this month's extra research — 25 % of our monthly
 * output in each area whose tech in progress the partner has.
 */
export function researchValue(
	countryId: number,
	weLack: string[],
	theyLack: string[],
	info: TechInfo,
	reach: Set<string>,
	current: { area: string; tech: string }[],
	monthly: Record<string, number>,
	factor: Factor = () => 1
): ResearchValue {
	const techs = weLack
		.map((key) => ({ key, ...info(key), inReach: reach.has(key) }))
		.sort((a, b) => Number(b.inReach) - Number(a.inReach) || b.cost - a.cost);
	const saved = (list: { cost: number; area: string }[], f: Factor = factor) =>
		list.reduce((t, x) => t + x.cost * savedShare(RESEARCH_SPEED, f(x.area)), 0);
	const known = new Set(weLack);
	return {
		countryId,
		ours: {
			techs,
			savedInReach: saved(techs.filter((t) => t.inReach)),
			saved: saved(techs)
		},
		theirs: { count: theyLack.length, saved: saved(theyLack.map(info), () => 1) },
		thisMonth: current
			.filter((c) => known.has(c.tech))
			.map((c) => ({ ...c, extra: (monthly[c.area] ?? 0) * RESEARCH_SPEED }))
	};
}

/**
 * The partner's number of techs per area, as technology intel shows it: ours, less what it lacks,
 * plus what only it has.
 */
export function techCounts(
	ours: string[],
	weLack: string[],
	theyLack: string[],
	areaOf: (key: string) => string
): { area: string; ours: number; theirs: number }[] {
	const count = (list: string[], area: string) => list.filter((k) => areaOf(k) === area).length;
	return ['physics', 'society', 'engineering'].map((area) => ({
		area,
		ours: count(ours, area),
		theirs: count(ours, area) - count(theyLack, area) + count(weLack, area)
	}));
}

export type TechHint = {
	key: string;
	area: string;
	cost: number;
	saved: number;
	partners: number[]; // research partners who have it
	offered: boolean; // on a card now
};

/**
 * Which tech a research agreement speeds up most: the cards on offer and the techs within reach
 * that a partner has, by research saved (once, however many partners have it).
 */
export function techHints(
	partners: { countryId: number; weLack: string[] }[],
	offered: Set<string>,
	reach: Set<string>,
	info: TechInfo,
	factor: Factor = () => 1
): TechHint[] {
	const by = new Map<string, number[]>();
	for (const p of partners)
		for (const k of p.weLack) by.set(k, [...(by.get(k) ?? []), p.countryId]);
	return [...by]
		.filter(([k]) => offered.has(k) || reach.has(k))
		.map(([key, ids]) => {
			const t = info(key);
			return {
				key,
				...t,
				saved: t.cost * savedShare(RESEARCH_SPEED, factor(t.area)),
				partners: ids,
				offered: offered.has(key)
			};
		})
		.sort((a, b) => Number(b.offered) - Number(a.offered) || b.saved - a.saved);
}

export type SpeciesExchange = {
	countryId: number;
	ourSpecies: string | null; // our main species
	theirSpecies: string | null; // theirs
	oursThere: { name: string; pops: number }[]; // our species in their empire, latest
	theirsHere: number; // their main species' pops in ours, latest
	series: Series; // our main species there, theirs here, over time
};

const popsOf = (e: EmpireSpecies | undefined, name: string | null) =>
	name === null || !e ? 0 : (e.species.find((s) => s.name === name)?.pops ?? 0);

/**
 * Whose pops went where under each migration treaty: our species in the partner's empire and its
 * main species in ours, along the branch's saves (from READER 45 on).
 */
export function speciesExchange(history: Snapshot[], ourId: number): SpeciesExchange[] {
	const saves = history.filter((s) => s.speciesByEmpire !== null);
	const latest = saves.at(-1)?.speciesByEmpire ?? [];
	const ours = latest.find((e) => e.countryId === ourId);
	const ourNames = new Set(ours?.species.map((s) => s.name) ?? []);
	return latest
		.filter((e) => e.countryId !== ourId)
		.map((e) => {
			const ourSpecies = ours?.founder ?? null;
			const label = (n: string | null, where: string) => `${n ?? '?'} ${where}`;
			const oursThereLabel = label(ourSpecies, 'in theirs');
			const theirsHereLabel = label(e.founder, 'in ours');
			const at = saves.map((s) => ({
				date: s.date,
				us: s.speciesByEmpire!.find((x) => x.countryId === ourId),
				them: s.speciesByEmpire!.find((x) => x.countryId === e.countryId)
			}));
			return {
				countryId: e.countryId,
				ourSpecies,
				theirSpecies: e.founder,
				// our other species there (the main one is the chart's)
				oursThere: e.species.filter(
					(s) => ourNames.has(s.name) && s.name !== e.founder && s.name !== ourSpecies
				),
				theirsHere: popsOf(ours, e.founder),
				series: {
					x: at.map((a) => gameYear(a.date)),
					lines: {
						[oursThereLabel]: at.map((a) => (a.them ? popsOf(a.them, ourSpecies) : null)),
						[theirsHereLabel]: at.map((a) => (a.us ? popsOf(a.us, e.founder) : null))
					}
				}
			};
		});
}
