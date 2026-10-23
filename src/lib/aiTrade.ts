import type { AiIntel, GameData, Resources } from './types.ts';

// What another empire makes of a trade — pure, and **estimated**: the game decides in the engine;
// its files give only the inputs (4.5.2, docs/trade-calibration.md). Measured in game (2212.08.01,
// three empires, one fallen — the calibration doc's results):
// - the acceptance is the worth of what we offer × its personality's trade willingness (shown
//   beside the acceptance) minus the worth of what it offers — no term for attitude or opinion
//   beside them; a willingness of 0 trades nothing, an attitude that does not trade refuses
//   everything;
// - worth is linear in the amount, however much (1000 alloys at once to an empire holding 261 count
//   per unit what 9 a month do), and a unit a month is worth 0.5 × the months of a unit at once
//   (TRADE_VALUE_RESOURCE_MONTHLY_MULT) — for a monthly-for-monthly deal the rate is the same;
// - it gives at once at most its stockpile above max(`ai_wants`, TRADE_MIN_RESOURCE_STOCKPILE 500),
//   and a month at most TRADE_MAX_RESOURCE_PERCENT (0.3) of its gross monthly income, rounded down
//   (energy 181.9 a month → 54);
// - a unit at once is worth P × B / (B + its gross income of it per month), short of it or flush,
//   P and B per resource (`WORTH`), in the tooltip's own unit — not ai_weight, not the defines'
//   income base (50, on net income). Every tooltip line within 3 %: energy from 16 empires (base
//   280), minerals from 16 (240), trade, consumer goods, alloys and living metal from 6 (fitted on
//   3, they predicted the next three empires within 2.4 %), food from 13 at one date (2213.02, 2 %
//   rms; bio ships make no difference). Minerals and food drift over time, the rest do not: at the
//   same income KhellZen and Lolehndra valued minerals 0.048 → 0.053 → 0.056 and food 0.067 →
//   0.078 → 0.082 (2212.08, 2213.01–02, 2213.08); energy rose 10 % by 2213.02, then held; trade,
//   consumer goods, alloys and living metal held throughout. The defines give energy and minerals
//   a value of their own, "scaled by income & need" (TRADE_VALUE_RESOURCE) — the need is engine
//   state. The curves hold the latest level (2213.08); expect minerals and food to keep moving.
//   A resource not measured is not valued (null): no estimate for it;
// - a gift raises its opinion of us by its worth as the acceptance shows it (`giftOpinion()`):
//   "Favorable Trade Deal" (accumulates to 100) came out the tooltip or one less, at 13 empires
//   given 1000 energy (2212.08) and 8 given 1000 minerals (2213.01). It did not fade: the files
//   say −2 a month, the saves showed every energy gift unchanged four months on (2212.09–2213.01);
// - a gift into full storage is worth nothing: both fallen empires, at their 135,000 minerals,
//   valued 1000 minerals at 0 (2213.01) — though they counted minerals a month (2212.08). Not
//   modelled: their storage is not in the save.
// - a nomadic empire never gives energy or minerals but takes them (seen in game): they are its
//   operational reserves, which "can be bought on the market, but not sold"
//   (concept_operational_reserves_desc).
// Unmeasured, from the defines: it gives nothing once its want is at least 0.8 of its storage
// (OFFER_TRADE_MIN_RESOURCE_THRESHOLD).

/**
 * A unit's worth to the AI at once: `p` with no income of it, falling by base / (base + gross
 * income); in the trade screen's acceptance points (docs/trade-calibration.md → What we know).
 */
export const WORTH: Record<string, { p: number; base: number }> = {
	energy: { p: 0.0747, base: 280 },
	minerals: { p: 0.0795, base: 240 },
	food: { p: 0.1574, base: 130 }, // 13 empires at one date (2213.02): 2 % rms
	trade: { p: 0.0884, base: 185 },
	consumer_goods: { p: 0.1253, base: 195 },
	alloys: { p: 0.1468, base: 165 },
	sr_living_metal: { p: 0.3144, base: 105 }
};

export type TradeModel = {
	under: number; // stockpile below this share of storage: short (shown, not valued)
	over: number; // above it: flush
	monthlyShare: number; // pays at most this share of its gross income a month
	monthlyMult: number; // a unit a month is worth this × the months of one at once
	offerThreshold: number; // won't give away what it wants this share of its storage of
	keep: number; // keeps at least this much of anything (TRADE_MIN_RESOURCE_STOCKPILE)
	worth: typeof WORTH;
	calibrated: boolean;
};

export const modelFrom = (defines: Record<string, number>): TradeModel => ({
	under: defines.TRADE_RESOURCE_STOCKPILE_UNDER ?? 0.33,
	over: defines.TRADE_RESOURCE_STOCKPILE_OVER ?? 0.75,
	monthlyShare: defines.TRADE_MAX_RESOURCE_PERCENT ?? 0.3,
	monthlyMult: defines.TRADE_VALUE_RESOURCE_MONTHLY_MULT ?? 0.5,
	offerThreshold: defines.OFFER_TRADE_MIN_RESOURCE_THRESHOLD ?? 0.8,
	keep: defines.TRADE_MIN_RESOURCE_STOCKPILE ?? 500,
	worth: WORTH,
	calibrated: true
});

type Info = GameData['resourceInfo'];

export type Stance = 'needs' | 'plenty' | 'normal';

/** How the AI stands on a resource: short of it, flush with it, or neither (not in its value). */
export function stance(r: string, ai: AiIntel, info: Info, m: TradeModel): Stance {
	const max = info[r]?.max ?? null;
	const have = ai.stockpile[r] ?? 0;
	if (max === null || max <= 0) return 'normal';
	if (have < m.under * max) return 'needs';
	if (have > m.over * max) return 'plenty';
	return 'normal';
}

/** What a unit of `r` at once is worth to the AI, in acceptance points; null: not measured. */
export function aiValue(r: string, ai: AiIntel, info: Info, m: TradeModel): number | null {
	const w = m.worth[r];
	if (!info[r]?.tradable || w === undefined) return null;
	const income = Math.max(0, ai.income[r] ?? 0);
	return w.p * (w.base / (w.base + income));
}

/** A nomadic empire's reserve: it takes these, never gives them. */
export const NOMAD_RESERVE = ['energy', 'minerals'];

/** Whether an empire can hand `r` over at all. */
export const canGive = (r: string, nomadic: boolean) => !(nomadic && NOMAD_RESERVE.includes(r));

/** How much of `r` the AI would hand over at once at most: what it holds beyond its want. */
export function spare(r: string, ai: AiIntel, info: Info, m: TradeModel): number {
	if (!canGive(r, ai.nomadic)) return 0;
	const i = info[r];
	const want = i?.aiWants ?? 0;
	if (i?.max && want >= m.offerThreshold * i.max) return 0;
	return Math.max(0, (ai.stockpile[r] ?? 0) - Math.max(want, m.keep));
}

/** How much of `r` the AI would pay a month at most; null: its gross income is not known. */
export function monthlyCap(r: string, ai: AiIntel, m: TradeModel): number | null {
	if (!canGive(r, ai.nomadic)) return 0;
	const income = ai.income[r];
	if (income === undefined) return Object.keys(ai.income).length ? 0 : null;
	return Math.max(0, Math.floor(m.monthlyShare * income));
}

export type Terms = {
	willingness: number | null; // the personality's
	trades: boolean; // its attitude trades at all, and willingness > 0
};

export function terms(
	ai: AiIntel,
	personalities: GameData['personalities'],
	attitudes: GameData['attitudes']
): Terms {
	const willingness = ai.personality ? (personalities[ai.personality]?.willingness ?? null) : null;
	const attitudeTrades = ai.attitude ? (attitudes[ai.attitude]?.trade ?? true) : true;
	return { willingness, trades: attitudeTrades && (willingness === null || willingness > 0) };
}

/**
 * Units of `get` the AI gives for one unit of `give` from us, at most: our unit's worth to it ×
 * its willingness ÷ its unit's worth. Null when it does not trade, either resource is off the table, or it has none
 * of `get` to spare.
 */
export function rate(
	give: string,
	get: string,
	ai: AiIntel,
	t: Terms,
	info: Info,
	m: TradeModel
): number | null {
	if (!t.trades || give === get) return null;
	const [vg, vr] = [aiValue(give, ai, info, m), aiValue(get, ai, info, m)];
	if (vg === null || vr === null || vr <= 0 || spare(get, ai, info, m) <= 0) return null;
	return (vg * (t.willingness ?? 1)) / vr;
}

/**
 * The opinion a gift of `amount` of `r` buys: its worth to the AI at its willingness, rounded down
 * (the game showed the acceptance's figure or one less), up to the modifier's cap less what is
 * left of earlier gifts. Whatever its attitude: unfriendly, rival and dismissive empires took gifts
 * (2212.08). Null when it is not valued.
 */
export function giftOpinion(
	r: string,
	amount: number,
	ai: AiIntel,
	t: Terms,
	info: Info,
	m: TradeModel,
	cap: { max: number | null; current: number }
): number | null {
	const v = aiValue(r, ai, info, m);
	if (v === null) return null;
	const worth = Math.floor(amount * v * (t.willingness ?? 1));
	return cap.max === null ? worth : Math.max(0, Math.min(worth, cap.max - cap.current));
}

export type MonthlyDeal = {
	perMonth: number; // what it pays a month, rounded down
	capped: boolean; // held to its monthly cap: our lump buys more than it may pay
	total: number; // over the deal
	// the deal breaks when it "can't afford the monthly rate" (seen in game): its net income of it
	// after paying, and if that is negative, the months its stockpile lasts
	netAfter: number;
	monthsLeft: number | null;
};

/**
 * We pay `amount` of `give` at once, it pays `get` every month for `years`: our lump's worth to it
 * (× its willingness) buys a unit a month at monthlyMult × the months of one at once — twice the
 * units of a one-off swap over the deal, whatever its length. Held to its monthly cap. Null when it
 * does not trade, either resource is not valued, or it cannot pay `get` a month.
 */
export function lumpForMonthly(
	give: string,
	amount: number,
	get: string,
	years: number,
	ai: AiIntel,
	t: Terms,
	info: Info,
	m: TradeModel
): MonthlyDeal | null {
	if (!t.trades || give === get || !canGive(get, ai.nomadic)) return null;
	const [vg, vr] = [aiValue(give, ai, info, m), aiValue(get, ai, info, m)];
	if (vg === null || vr === null || vr <= 0) return null;
	const months = years * 12;
	const worth = amount * vg * (t.willingness ?? 1);
	const fair = Math.floor(worth / (vr * m.monthlyMult * months));
	const cap = monthlyCap(get, ai, m);
	const perMonth = cap === null ? fair : Math.min(fair, cap);
	if (perMonth <= 0) return null;
	const netAfter = (ai.net[get] ?? 0) - perMonth;
	return {
		perMonth,
		capped: cap !== null && fair > cap,
		total: perMonth * months,
		netAfter,
		monthsLeft: netAfter >= 0 ? null : Math.floor((ai.stockpile[get] ?? 0) / -netAfter)
	};
}

/**
 * The market's rate for the same swap: sell one unit of `give`, buy `get` with it — each at its
 * price and the fee (prices in trade per unit, before the fee).
 */
export function marketRate(
	give: string,
	get: string,
	prices: Resources,
	fee: number
): number | null {
	const [pg, pr] = [prices[give], prices[get]];
	if (!pg || !pr) return null;
	return (pg * (1 - fee)) / (pr * (1 + fee));
}

/** Trade we pay for one unit of `r` from the AI (it gives `r` for our trade); null: no deal. */
export function wantPrice(r: string, ai: AiIntel, t: Terms, info: Info, m: TradeModel) {
	const x = rate('trade', r, ai, t, info, m);
	return x === null || x <= 0 ? null : 1 / x;
}

/** Trade we receive for one unit of `r` given to the AI; null: no deal. */
export const offerPrice = (r: string, ai: AiIntel, t: Terms, info: Info, m: TradeModel) =>
	rate(r, 'trade', ai, t, info, m);

/** The market's price of a unit in trade: buying pays the fee on top, selling loses it. */
export function marketPrice(r: string, side: 'buy' | 'sell', prices: Resources, fee: number) {
	const p = prices[r];
	return p ? p * (side === 'buy' ? 1 + fee : 1 - fee) : null;
}

/**
 * Trader enclaves sell one strategic resource each, for energy (4.5.2
 * events/leviathans_events_1.txt, leviathans.130–132): 500·N energy at once, then
 * `enclave_trade_N_<xur|rig|mut>` (static_modifiers) — +N of the resource and −10·N energy a
 * month — for @traderDealDuration (3600 days), N = 1…5, one deal per enclave at a time.
 */
export const ENCLAVE_DEAL = {
	resource: { 1: 'exotic_gases', 2: 'volatile_motes', 3: 'rare_crystals' } as const,
	modifier: { 1: 'xur', 2: 'rig', 3: 'mut' } as const,
	once: 500, // energy at once, per unit a month
	monthly: 10, // energy per unit a month
	months: 120,
	maxPerMonth: 5
};

/** Energy per unit of an enclave deal over its run: the same for every N (≈ 14.2). */
export const enclaveUnitCost = () =>
	(ENCLAVE_DEAL.once + ENCLAVE_DEAL.monthly * ENCLAVE_DEAL.months) / ENCLAVE_DEAL.months;

/** Our running deal with an enclave, from our country modifiers: units a month, until when. */
export function enclaveDeal(
	kind: 1 | 2 | 3,
	modifiers: { key: string; until: string | null }[]
): { perMonth: number; until: string | null } | null {
	const re = new RegExp(`^enclave_trade_(\\d)_${ENCLAVE_DEAL.modifier[kind]}$`);
	for (const m of modifiers) {
		const hit = re.exec(m.key);
		if (hit) return { perMonth: Number(hit[1]), until: m.until };
	}
	return null;
}
