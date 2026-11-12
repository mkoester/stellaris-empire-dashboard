import { fromDays, toDays } from './events.ts';
import { gameYear, type Series } from './series.ts';
import type { ExternalBuildings, Snapshot, Specialists, Subject } from './types.ts';

// The subjects tab beyond the agreement cards (pure): loyalty over time, when the deal can be
// renegotiated, where a specialisation stands, holdings against the limit. From 4.5.4's files:
// - `common/defines/00_defines.txt`: an agreement can change every AGREEMENT_CHANGE_COOLDOWN_MONTHS
//   (60); a proposal costs AGREEMENT_PROPOSE_INFLUENCE_COST (50) + |loyalty delta| ×
//   AGREEMENT_LOYALTY_DELTA_MULT (5); each month the subject's opinion of its overlord × 0.01
//   (SUBJECT_MONTHLY_LOYALTY_OPINION_MULTIPLIER) is added to its loyalty, and its specialist XP
//   grows by loyalty × 0.1 (SUBJECT_XP_LOYALTY_MULTIPLIER);
// - `common/specialist_subject_types`: levels 1–3, 1200 XP to level 2, 3600 more to level 3.
// Assumed, not seen in game: the cooldown runs from the save's `date_changed`, and a deal never
// renegotiated (changed = added) waits it only with `has_cooldown_on_first_renegotiation`.

export type Defines = Record<string, number>;
const D = (d: Defines, k: string, fallback: number) => d[k] ?? fallback;

/** When the deal can be renegotiated: a date, or "now" (null when the save cannot tell). */
export function renegotiation(
	s: Subject,
	today: string,
	defines: Defines
): { from: string; now: boolean } | null {
	if (!s.changed) return null;
	const never = s.since !== null && s.changed === s.since;
	if (never && s.firstCooldown === false) return { from: s.since ?? s.changed, now: true };
	const from = fromDays(
		toDays(s.changed) + D(defines, 'AGREEMENT_CHANGE_COOLDOWN_MONTHS', 60) * 30
	);
	return { from, now: toDays(from) <= toDays(today) };
}

/** What proposing a new deal costs in influence, for a change of loyalty by `delta`. */
export const proposalCost = (delta: number, defines: Defines) =>
	D(defines, 'AGREEMENT_PROPOSE_INFLUENCE_COST', 50) +
	Math.abs(delta) * D(defines, 'AGREEMENT_LOYALTY_DELTA_MULT', 5);

/** Loyalty a month from the subject's opinion of us alone. */
export const loyaltyFromOpinion = (opinion: number | null, defines: Defines) =>
	opinion === null
		? null
		: opinion * D(defines, 'SUBJECT_MONTHLY_LOYALTY_OPINION_MULTIPLIER', 0.01);

/** One subject's loyalty along the branch's saves (a chart's series, x in game years). */
export function loyaltySeries(snaps: Snapshot[], countryId: number): Series {
	const points = snaps.flatMap((s) => {
		if (s.kind !== 'save' || !s.subjects) return [];
		const sub = s.subjects.find((x) => x.countryId === countryId);
		return sub && sub.loyalty !== null ? [[gameYear(s.date), sub.loyalty] as const] : [];
	});
	return { x: points.map((p) => p[0]), lines: { loyalty: points.map((p) => p[1]) } };
}

/** Loyalty's change a month between the last two saves that show it (null with fewer). */
export function loyaltyTrend(snaps: Snapshot[], countryId: number): number | null {
	const seen = snaps.flatMap((s) => {
		const sub = s.kind === 'save' ? s.subjects?.find((x) => x.countryId === countryId) : undefined;
		return sub && sub.loyalty !== null ? [{ date: s.date, loyalty: sub.loyalty }] : [];
	});
	if (seen.length < 2) return null;
	const [a, b] = seen.slice(-2);
	const months = (toDays(b.date) - toDays(a.date)) / 30;
	return months > 0 ? (b.loyalty - a.loyalty) / months : null;
}

export type SpecialistView = {
	type: string;
	name: string;
	level: number;
	xp: number;
	xpNext: number | null; // to the next level; null at the top
	perMonth: number | null; // XP a month at today's loyalty
	months: number | null; // to the next level at that rate
	perks: string[]; // what the current level brings
	nextPerks: string[]; // what the next brings
};

/** Where a subject's specialisation stands, or null without one (or without the data). */
export function specialist(s: Subject, data: Specialists, defines: Defines): SpecialistView | null {
	const key = s.terms.specialist_type;
	const type = key ? data.types[key] : undefined;
	if (!key || !type) return null;
	const level = Math.max(s.specialistLevel, 1);
	const row = type.levels.find((l) => l.level === level);
	const next = type.levels.find((l) => l.level === level + 1);
	const perMonth =
		s.loyalty === null
			? null
			: Math.max(s.loyalty, 0) * D(defines, 'SUBJECT_XP_LOYALTY_MULTIPLIER', 0.1);
	const xpNext = row?.xpNext ?? null;
	const left = xpNext === null ? null : Math.max(xpNext - s.specialistExperience, 0);
	return {
		type: key,
		name: type.name,
		level,
		xp: s.specialistExperience,
		xpNext,
		perMonth,
		months: left === null || !perMonth ? null : left / perMonth,
		perks: row?.perks ?? [],
		nextPerks: next?.perks ?? []
	};
}

/** Our holdings on a subject's colonies against the deal's limit (`subject_holdings_limit_N`). */
export function holdings(
	s: Subject,
	external: ExternalBuildings[] | null,
	us: number | null
): { used: number; limit: number | null } | null {
	if (!s.weAreOverlord || external === null) return null;
	const term = s.terms.subject_holdings_limit;
	const n = term?.match(/_(\d+)$/);
	const used = external.filter(
		(e) => e.kind === 'subject_holding' && e.holderId === us && e.ownerId === s.countryId
	).length;
	return { used, limit: n ? Number(n[1]) : null };
}
