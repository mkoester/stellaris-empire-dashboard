import { evaluate, type Facts, type Trigger } from './triggers.ts';

// How the AI members would vote on a resolution we propose, as the game decides it (4.5.2
// `common/resolutions/99_README_RESOLUTIONS.txt` and `00_defines.txt`): each AI's weight is the
// resolution's `ai_weight` — a base times the factors whose conditions hold for that AI — times
// a factor for its opinion of the proposer; it supports at RESOLUTION_VOTE_SUPPORT_THRESHOLD or
// more, opposes under RESOLUTION_VOTE_ABSTAIN_THRESHOLD, abstains between. The opinion factor:
// 0.5 at Terrible (OPINION_TERRIBLE −750 or less), 1.0 neutral, 1.3 at Excellent (750 or more),
// taken as linear between — 2214.02.01, Buzzword Standardization (base 7): exactly the members
// with a negative opinion of us (−371, −161, −12) were missing from the game's "Empires likely to
// support this Resolution" (screenshot 2026_10_23_11). Pure.

export const SUPPORT_THRESHOLD = 7.0;
export const ABSTAIN_THRESHOLD = 5.5;
const OPINION_TERRIBLE = -750;
const OPINION_EXCELLENT = 750;
const PROPOSER_OPINION = { min: 0.5, base: 1.0, max: 1.3 };

export type AiWeight = {
	base: number | null;
	modifiers: { factor: number | null; add: number | null; trigger: Trigger | null }[];
};

/** The factor an AI's opinion of the proposer puts on its weight. */
export function opinionFactor(opinion: number): number {
	const t = Math.max(
		-1,
		Math.min(1, opinion / (opinion < 0 ? -OPINION_TERRIBLE : OPINION_EXCELLENT))
	);
	return t < 0
		? PROPOSER_OPINION.base + t * (PROPOSER_OPINION.base - PROPOSER_OPINION.min)
		: PROPOSER_OPINION.base + t * (PROPOSER_OPINION.max - PROPOSER_OPINION.base);
}

export type AiVote = {
	weight: number;
	vote: 'for' | 'abstain' | 'against';
	uncertain: boolean; // a factor's condition the save cannot answer was left out
};

/** One AI's vote on a resolution we propose; null without an ai_weight. */
export function aiVote(w: AiWeight | null, f: Facts, opinionOfUs: number): AiVote | null {
	if (!w || w.base === null) return null;
	let weight = w.base;
	let uncertain = false;
	for (const m of w.modifiers) {
		const holds = m.trigger === null ? true : evaluate(m.trigger, f);
		if (holds === null) uncertain = true;
		if (!holds) continue;
		if (m.add !== null) weight += m.add;
		if (m.factor !== null) weight *= m.factor;
	}
	weight *= opinionFactor(opinionOfUs);
	const vote =
		weight >= SUPPORT_THRESHOLD ? 'for' : weight < ABSTAIN_THRESHOLD ? 'against' : 'abstain';
	return { weight, vote, uncertain };
}

export type Member = { name: string; weight: number; facts: Facts; opinionOfUs: number | null };

export type Outlook = {
	// the share of the decided weight for it, as we vote for it, abstain or vote against it
	ifFor: number | null;
	ifAbstain: number | null;
	ifAgainst: number | null;
	votes: { name: string; vote: AiVote['vote'] | null; uncertain: boolean; weight: number }[];
	actual?: boolean; // from the votes cast (a resolution in the queue), not predicted
};

/**
 * A resolution in the queue, from the votes cast so far: members not yet decided count on neither
 * side, our own vote is set aside for the two cases.
 */
export function actualOutlook(
	r: { support: string[]; oppose: string[] },
	weights: Record<string, { value: number }>,
	members: string[],
	us: string
): Outlook {
	const weight = (name: string) => weights[name]?.value ?? 0;
	const side = (names: string[]) =>
		names.filter((n) => n !== us).reduce((n, x) => n + weight(x), 0);
	const [yes, no] = [side(r.support), side(r.oppose)];
	const share = (a: number, b: number) => (a + b > 0 ? a / (a + b) : null);
	return {
		ifFor: share(yes + weight(us), no),
		ifAbstain: share(yes, no),
		ifAgainst: share(yes, no + weight(us)),
		votes: members
			.filter((n) => n !== us)
			.map((name) => ({
				name,
				vote: r.support.includes(name) ? 'for' : r.oppose.includes(name) ? 'against' : null,
				uncertain: false,
				weight: weight(name)
			})),
		actual: true
	};
}

/** How a resolution we propose would fare: each AI member's vote, and the share of weight for it. */
export function outlook(w: AiWeight | null, members: Member[], ourWeight: number): Outlook | null {
	if (!w || w.base === null) return null;
	const votes = members.map((m) => {
		const v = m.opinionOfUs === null ? null : aiVote(w, m.facts, m.opinionOfUs);
		return {
			name: m.name,
			vote: v?.vote ?? null,
			uncertain: v?.uncertain ?? true,
			weight: m.weight
		};
	});
	const sum = (vote: AiVote['vote']) =>
		votes.filter((v) => v.vote === vote).reduce((n, v) => n + v.weight, 0);
	const [yes, no] = [sum('for'), sum('against')];
	const share = (a: number, b: number) => (a + b > 0 ? a / (a + b) : null);
	return {
		ifFor: share(yes + ourWeight, no),
		ifAbstain: share(yes, no),
		ifAgainst: share(yes, no + ourWeight),
		votes
	};
}
