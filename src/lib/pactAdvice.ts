import { COMMERCIAL_SHARE, RESEARCH_SPEED, tradeBase, type PactType } from './pacts.ts';
import type { AiIntel, GameData, Relation } from './types.ts';

// Whom to offer a research agreement or a commercial pact (the user's ask 2026-11-18): every
// empire we talk to that has none with us yet, ranked by what the pact would bring a month, in
// trade; greyed where the game would refuse it now — a requirement not met, or an acceptance the
// AI would turn down — but kept in its place. Pure. From 4.5.4:
// - `common/diplomatic_actions/00_actions.txt` (`action_form_research_agreement`,
//   `action_form_commercial_pact`): AI_acceptance_base_value −50; `possible`: their trust in us
//   ≥ 20 or our opinion of them good (`OPINION_GOOD`, 300), a Familiar Face hive 10 trust; an
//   embassy with them or Diplomatic Networking (a megacorp: or Universal Transactions, commercial
//   pacts only); neither side Fanatic Purifiers, Inward Perfection, Pompous Purists (theirs) or a
//   Devouring Swarm or Terminators (research); both independent (commercial: the recipient too); a
//   research agreement only between regular empires (`potential`).
// - `common/defines/00_defines.txt` `*_ACCEPTANCE_*`: their opinion of us × 0.4; their attitude
//   towards us 100 with `alliance` behaviour, 50 with `coexist`, else 0; −30 per pact of the kind
//   they already have; −0.1 per border distance (the save's `border_range`; none without a
//   border — a nomad's with everyone — read as 0: a nomad can sign pacts, which −0.1 × 2³¹ would
//   rule out); research: −0.5 per tech only one side has,
//   clamped to ±100; commercial: −0.5 per trade a month they would give (−100 … 0), +1 per trade
//   they would get (0 … 100) — read as the 10 % share each side passes on (an assumption: the
//   define says "collected trade value").
// - `common/personalities`: `research_agreement_acceptance` / `commercial_pact_acceptance`.
// The engine adds terms the files do not name (2217.07.01: −13 in game where these summed to
// +156): every acceptance is an upper bound, ≈ (docs/open-checks.md 10).

export type PactKind = 'research' | 'commercial';

export const BASE_ACCEPTANCE = -50;
/** Influence a month either pact costs, before modifiers (00_diplomacy_economy.txt). */
export const PACT_UPKEEP = 0.25;
/** Each pact type's base influence upkeep (00_diplomacy_economy.txt, 4.5.4). */
const BASE_UPKEEP: Record<string, number> = {
	migration_access: 0.25,
	commercial_pact: 0.25,
	research_agreement: 0.25,
	non_aggression_pledge: 0.25,
	defensive_pact: 1,
	guarantee: 0.5
};

export type Upkeep = { amount: number; from: 'own' | 'other' | 'base' };

/**
 * What one more pact of the kind costs in influence a month, measured from the budget: the kind's
 * booked upkeep per partner where we hold one; else the factor of another pact type we hold
 * (booked over base: `diplomacy_upkeep_mult` and the like apply to all — Roaming Korinth
 * 2217.07.01, Isolationist +100 %: a guarantee booked 1 for 0.5, a commercial pact offered at
 * 0.40, the ruler's nomad −5 % a level on commercial pacts on top, which only the kind's own
 * booking shows); else the base. A federation's free pacts book nothing, which reads low.
 */
export function pactUpkeep(kind: PactKind, types: PactType[]): Upkeep {
	const own = types.find((t) => t.key === FLAG[kind]);
	if (own && own.upkeep > 0) return { amount: own.upkeep / own.partners.length, from: 'own' };
	const other = types.find((t) => BASE_UPKEEP[t.key] && t.upkeep > 0);
	if (other)
		return {
			amount: PACT_UPKEEP * (other.upkeep / (BASE_UPKEEP[other.key] * other.partners.length)),
			from: 'other'
		};
	return { amount: PACT_UPKEEP, from: 'base' };
}
const FLAG: Record<PactKind, string> = {
	research: 'research_agreement',
	commercial: 'commercial_pact'
};
const DEFINE: Record<PactKind, string> = {
	research: 'RESEARCH_AGREEMENT_ACCEPTANCE',
	commercial: 'COMMERCIAL_PACT_ACCEPTANCE'
};
const NEVER_ACTOR: Record<PactKind, string[]> = {
	research: [
		'civic_fanatic_purifiers',
		'civic_hive_devouring_swarm',
		'civic_inwards_perfection',
		'civic_machine_terminator'
	],
	commercial: ['civic_fanatic_purifiers', 'civic_inwards_perfection']
};
const NEVER_RECIPIENT: Record<PactKind, string[]> = {
	research: [
		'civic_fanatic_purifiers',
		'civic_hive_devouring_swarm',
		'civic_inwards_perfection',
		'civic_pompous_purists',
		'civic_machine_terminator'
	],
	commercial: ['civic_fanatic_purifiers', 'civic_inwards_perfection', 'civic_pompous_purists']
};

/** What we are, for the pacts' requirements. */
export type Us = {
	civics: string[]; // the save's `government` keys
	traditions: string[];
	perks: string[];
	megacorp: boolean;
	subject: boolean;
	tradeBase: number; // our trade production a month, our commercial pacts' trade left out
};

/** Another empire we talk to, as far as the save tells. */
export type Other = {
	countryId: number;
	name: string;
	type: string; // country type: `default` for a regular empire
	civics: string[];
	subject: boolean;
	ai: AiIntel;
	relation: Relation | null; // ours to them: embassy, our opinion, border distance, pacts
	pacts: Record<PactKind, number>; // how many of each kind it has with others
};

export type Term = { label: string; value: number | null }; // null: not known
export type Acceptance = {
	terms: Term[];
	total: number | null; // null: a term other than the distance is unknown
	// false: refuses; null: cannot tell. Never true: the sum is an upper bound — the game showed
	// −13 for a commercial pact this read as +156 (Roaming Korinth 2217.07.01, Mishar Pact), so
	// terms the files do not name pull it down, and only a sum at or below 0 decides
	accepts: false | null;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The AI's acceptance of the pact, term by term as its tooltip lists them (≈). */
export function acceptance(
	kind: PactKind,
	o: Other,
	us: Pick<Us, 'tradeBase'>,
	data: Pick<GameData, 'defines' | 'personalities' | 'attitudes'>
): Acceptance {
	const d = (term: string): number | null => data.defines[`${DEFINE[kind]}_${term}`] ?? null;
	const times = (f: number | null, v: number | null | undefined) =>
		f === null || v === null || v === undefined ? null : f * v;
	const att = o.ai.attitude ? data.attitudes[o.ai.attitude] : undefined;
	const attitude =
		att?.alliance === undefined
			? null
			: att.alliance
				? d('ATTITUDE_ALLIANCE')
				: att.coexist
					? d('ATTITUDE_COEXIST')
					: d('OTHER_ATTITUDE');
	const personality = o.ai.personality
		? (data.personalities[o.ai.personality]?.acceptance?.[kind] ?? null)
		: 0;
	const terms: Term[] = [
		{ label: 'base', value: BASE_ACCEPTANCE },
		{ label: 'their opinion of us', value: times(d('OPINION_FACTOR'), o.ai.opinion) },
		{ label: `attitude (${att?.name ?? o.ai.attitude ?? '?'})`, value: attitude },
		{ label: 'personality', value: personality },
		{
			label: `their ${kind === 'research' ? 'research agreements' : 'commercial pacts'}`,
			value: times(d('NUM_PACTS'), o.pacts[kind])
		},
		{
			label:
				o.relation && o.relation.borderRange === null
					? 'border distance (no border)'
					: 'border distance',
			value: o.relation ? times(d('DISTANCE_MULT'), o.relation.borderRange ?? 0) : null
		}
	];
	if (kind === 'research') {
		const given = d('GIVEN_TECHS');
		const taken = d('TAKEN_TECHS');
		const lo = d('TECHS_MIN');
		const hi = d('TECHS_MAX');
		const weLack = o.ai.techsWeLack?.length;
		const theyLack = o.ai.theyLackCount ?? o.ai.techsTheyLack?.length;
		terms.push({
			label: 'tech difference',
			value:
				given === null ||
				taken === null ||
				lo === null ||
				hi === null ||
				weLack === undefined ||
				theyLack === undefined
					? null
					: clamp(given * weLack + taken * theyLack, lo, hi)
		});
	} else {
		const term = (f: string, v: number) => {
			const [k, lo, hi] = [d(f), d(`${f}_MIN`), d(`${f}_MAX`)];
			return k === null || lo === null || hi === null ? null : clamp(k * v, lo, hi);
		};
		terms.push(
			{
				label: 'trade they give',
				value: term('GIVEN_VALUE', COMMERCIAL_SHARE * Math.max(0, tradeBase(o.ai)))
			},
			{
				label: 'trade they get',
				value: term('TAKEN_VALUE', COMMERCIAL_SHARE * Math.max(0, us.tradeBase))
			}
		);
	}
	const known = terms.reduce((n, t) => n + (t.value ?? 0), 0);
	// the distance is never positive: without it, a sum at or below 0 already refuses
	const open = terms.filter((t) => t.value === null);
	const onlyDistance = open.length === 1 && open[0].label.startsWith('border distance');
	return {
		terms,
		total: open.length ? null : known,
		accepts: (!open.length || onlyDistance) && known <= 0 ? false : null
	};
}

/** Why the game would not let us propose it now; [] when nothing stands in the way. */
export function requirements(
	kind: PactKind,
	o: Other,
	us: Us,
	opinionGood: number | null
): string[] {
	const out: string[] = [];
	if (us.subject) out.push('we are a subject: no pacts of our own');
	if (kind === 'commercial' && o.subject) out.push('a subject: makes no pacts of its own');
	const trust = o.ai.trust;
	const ourOpinion = o.relation?.opinion ?? null;
	const familiar = us.civics.includes('civic_hive_familiar_face');
	const trusted =
		trust >= 20 ||
		(familiar && trust >= 10) ||
		(opinionGood !== null && ourOpinion !== null && ourOpinion >= opinionGood);
	if (!trusted) out.push(`needs ${familiar ? 10 : 20} trust (has ${Math.floor(trust)})`);
	const embassy =
		(o.relation?.agreements ?? []).includes('embassy') ||
		us.traditions.includes('tr_diplomacy_diplomatic_networking') ||
		(kind === 'commercial' && us.megacorp && us.perks.includes('ap_universal_transactions'));
	if (!embassy) out.push('needs an embassy with them');
	return out;
}

/** Whether the game never allows the pact for us, or with this empire. */
export const neverForUs = (kind: PactKind, us: Us) =>
	us.civics.some((c) => NEVER_ACTOR[kind].includes(c));
export const neverWith = (kind: PactKind, o: Other) =>
	(kind === 'research' && o.type !== 'default') ||
	o.civics.some((c) => NEVER_RECIPIENT[kind].includes(c));

/** Whether we already have it with them. */
export const hasPact = (kind: PactKind, o: Other) =>
	(o.relation?.agreements ?? []).includes(FLAG[kind]);

/**
 * A research agreement's extra research a month: +25 % of our output in each area, for the share
 * (by cost) of the techs we would research next — `next`: the one in progress and the cards on
 * offer, else every tech within reach — that they have and no research partner already gives.
 */
export function researchGain(
	weLack: string[],
	next: string[],
	covered: Set<string>, // techs a current research partner has
	info: (key: string) => { cost: number; area: string },
	monthly: Record<string, number> // our research output by area
): Record<string, number> {
	const theirs = new Set(weLack);
	const out: Record<string, number> = {};
	for (const area of ['physics', 'society', 'engineering']) {
		const here = next.map((k) => ({ k, ...info(k) })).filter((t) => t.area === area);
		const all = here.reduce((n, t) => n + t.cost, 0);
		if (!all) continue;
		const gained = here
			.filter((t) => theirs.has(t.k) && !covered.has(t.k))
			.reduce((n, t) => n + t.cost, 0);
		const extra = RESEARCH_SPEED * (monthly[area] ?? 0) * (gained / all);
		if (extra > 0) out[`${area}_research`] = extra;
	}
	return out;
}

/** A commercial pact's trade a month: 10 % of their trade production. */
export const commercialGain = (ai: AiIntel) => COMMERCIAL_SHARE * Math.max(0, tradeBase(ai));

export type Advice = {
	countryId: number;
	name: string;
	gain: Record<string, number>; // a month
	value: number; // gain less the 0.25 influence upkeep, in trade
	available: boolean; // the game would let us and they would accept (≈)
	why: string[]; // what stands in the way now
	acceptance: Acceptance;
};

/** Every candidate for the pact, ranked by value, available or not. */
export function advise(
	kind: PactKind,
	others: Other[],
	us: Us,
	data: Pick<GameData, 'defines' | 'personalities' | 'attitudes'>,
	gainOf: (o: Other) => Record<string, number> | null, // null: not known
	worth: (r: Record<string, number>) => number, // in trade
	upkeep: number // influence a month
): Advice[] | null {
	if (neverForUs(kind, us)) return null;
	return others
		.filter((o) => !hasPact(kind, o) && !neverWith(kind, o))
		.flatMap((o) => {
			const gain = gainOf(o);
			if (gain === null) return [];
			const a = acceptance(kind, o, us, data);
			const why = requirements(kind, o, us, data.defines.OPINION_GOOD ?? null);
			if (a.accepts === false)
				why.push(
					`would refuse: acceptance ≈ ${Math.round(a.terms.reduce((n, t) => n + (t.value ?? 0), 0))}`
				);
			return [
				{
					countryId: o.countryId,
					name: o.name,
					gain,
					value: worth(gain) - worth({ influence: upkeep }),
					available: why.length === 0,
					why,
					acceptance: a
				}
			];
		})
		.sort((x, y) => y.value - x.value);
}
