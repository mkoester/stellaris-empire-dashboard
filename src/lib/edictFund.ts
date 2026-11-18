// The Edict Fund (the user's question 2026-11-18: "when below edict fund this costs nothing — is
// this respected?"): a pool of unity that pays edicts' unity upkeep first; only what goes beyond
// it is spent ("concept_edict_fund_desc", 4.5.4 localisation). Its size is the country's
// `country_edict_fund_add` × (1 + `country_edict_fund_mult`) — the product an assumption to check
// (docs/open-checks.md 40). Pure.
// - Exact: companion mod 0.14.0 exports both modifiers into `sdash_ef_add` / `sdash_ef_mult`.
// - Without it, ≈ and a lower bound: `empire_base`'s 10, what the held traditions, perks, civics,
//   the authority, origin, techs and timed modifiers add, and the council seats' effects
//   (the ruler's +5 a level); jobs that add to it (bureaucrats and priests under some civics)
//   are not counted. Where the budget books no edict upkeep, the fund holds at least what the
//   active edicts need.
// Edicts' upkeep is scaled by `edict_size_effect` and `edicts_upkeep_mult` before the fund pays
// (k, below): measured from the budget where it books some — booked = k × base − fund —, else 1.

export type Fund = { amount: number; exact: boolean };

/** The fund from the modifiers' totals. */
export const fundOf = (add: number, mult: number) => Math.max(0, add * (1 + mult));

/** ≈ the fund from what the dashboard sees: the sums of both modifiers over the held sources. */
export function estimateFund(
	held: string[], // `bySource` keys the empire holds, and `modifier:empire_base`
	bySource: Record<string, { add?: number; mult?: number }>,
	seats: { key: string; value: number }[] // council seats' current effects
): number {
	let add = 0;
	let mult = 0;
	for (const h of new Set(held)) {
		add += bySource[h]?.add ?? 0;
		mult += bySource[h]?.mult ?? 0;
	}
	for (const s of seats)
		if (s.key === 'country_edict_fund_add') add += s.value;
		else if (s.key === 'country_edict_fund_mult') mult += s.value;
	return fundOf(add, mult);
}

export type FundState = {
	fund: Fund;
	k: number; // upkeep scale (size effect × upkeep mult)
	measured: boolean; // k from the budget
	need: number; // the active edicts' unity upkeep, scaled
	booked: number; // unity the budget books beyond the fund
	room: number; // fund left over
};

/**
 * The fund against the active edicts: `base` their unity upkeep before scaling, `booked` what
 * the budget books for edicts in unity (null: no budget read).
 */
export function fundState(fund: Fund, base: number, booked: number | null): FundState {
	const paid = booked ?? 0;
	const measured = base > 0 && paid > 0;
	const k = measured ? (paid + fund.amount) / base : 1;
	const need = k * base;
	// nothing booked: the fund covers what is active, so it is at least that
	const amount =
		!measured && booked !== null && !fund.exact ? Math.max(fund.amount, need) : fund.amount;
	return {
		fund: { ...fund, amount },
		k,
		measured,
		need,
		booked: paid,
		room: Math.max(0, amount - need)
	};
}

/**
 * The unity upkeep an edict changes, after the fund: enacting one (`active` false) pays what goes
 * beyond the room left; cancelling one saves what the budget books less what it would still book.
 * Negative: saved.
 */
export function unityUpkeep(upkeep: number, active: boolean, s: FundState): number {
	const own = s.k * upkeep;
	if (!active) return Math.max(0, own - s.room);
	const after = Math.max(0, s.need - own - s.fund.amount);
	return -(s.booked - after);
}

/** A short text for a price's tooltip. */
export const fundNote = (s: FundState) =>
	`edict fund ${s.fund.exact ? '' : '≈ '}${Math.round(s.fund.amount)} unity a month, ` +
	`${Math.round(Math.min(s.need, s.fund.amount))} of it in use by active edicts` +
	(s.fund.exact
		? ''
		: ' (≈, at least: jobs that add to it are not counted; the companion mod 0.14.0 gives it exactly)');
