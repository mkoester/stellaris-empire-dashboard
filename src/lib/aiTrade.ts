import type { AiIntel, GameData, Resources } from './types.ts';

// What another empire makes of a trade — pure, and **estimated**: the game decides in the engine;
// its files give only the inputs (4.5.2, docs/trade-calibration.md). The model, until the
// calibration session's numbers replace its guesses (`TradeModel`):
// - a unit of a resource is worth `ai_weight` to the AI (energy 1.5, minerals and food 1, alloys
//   and consumer goods 5, motes 10, rare 100), less the more it earns of it per month
//   (× INCOME_BASE / (INCOME_BASE + income), TRADE_VALUE_RESOURCE_INCOME_BASE = 50), more when its
//   stockpile is under a third of its storage and less over three quarters
//   (TRADE_RESOURCE_STOCKPILE_UNDER / OVER — the factors themselves are guesses);
// - it accepts when what it gets is worth what it gives ÷ its personality's trade willingness
//   ("at 1.0 they accept a deal that is equally good for both sides"); a willingness of 0 trades
//   nothing, and an attitude that does not trade refuses everything;
// - it gives away nothing it holds less than it wants (`ai_wants`), nor anything once its want is
//   at least 0.8 of its storage (OFFER_TRADE_MIN_RESOURCE_THRESHOLD);
// - monthly payments count half (TRADE_VALUE_RESOURCE_MONTHLY_MULT) — for a monthly-for-monthly
//   deal the rate is the same.

export type TradeModel = {
	incomeBase: number;
	under: number; // stockpile below this share of storage: it needs more
	over: number; // above it: it has plenty
	needFactor: number; // value × this when it needs more (guess)
	plentyFactor: number; // value × this when it has plenty (guess)
	offerThreshold: number; // won't give away what it wants this share of its storage of
	calibrated: boolean;
};

export const modelFrom = (defines: Record<string, number>): TradeModel => ({
	incomeBase: defines.TRADE_VALUE_RESOURCE_INCOME_BASE ?? 50,
	under: defines.TRADE_RESOURCE_STOCKPILE_UNDER ?? 0.33,
	over: defines.TRADE_RESOURCE_STOCKPILE_OVER ?? 0.75,
	needFactor: 2,
	plentyFactor: 0.5,
	offerThreshold: defines.OFFER_TRADE_MIN_RESOURCE_THRESHOLD ?? 0.8,
	calibrated: false
});

type Info = GameData['resourceInfo'];

export type Stance = 'needs' | 'plenty' | 'normal';

/** How the AI stands on a resource: short of it, flush with it, or neither. */
export function stance(r: string, ai: AiIntel, info: Info, m: TradeModel): Stance {
	const max = info[r]?.max ?? null;
	const have = ai.stockpile[r] ?? 0;
	if (max === null || max <= 0) return 'normal';
	if (have < m.under * max) return 'needs';
	if (have > m.over * max) return 'plenty';
	return 'normal';
}

/** What a unit of `r` is worth to the AI, in its weight units; null: it does not trade it. */
export function aiValue(r: string, ai: AiIntel, info: Info, m: TradeModel): number | null {
	const i = info[r];
	if (!i?.tradable || i.aiWeight === null) return null;
	const income = Math.max(0, ai.net[r] ?? 0);
	const s = stance(r, ai, info, m);
	return (
		i.aiWeight *
		(m.incomeBase / (m.incomeBase + income)) *
		(s === 'needs' ? m.needFactor : s === 'plenty' ? m.plentyFactor : 1)
	);
}

/** How much of `r` the AI would hand over at most: what it holds beyond its want. */
export function spare(r: string, ai: AiIntel, info: Info, m: TradeModel): number {
	const i = info[r];
	const want = i?.aiWants ?? 0;
	if (i?.max && want >= m.offerThreshold * i.max) return 0;
	return Math.max(0, (ai.stockpile[r] ?? 0) - want);
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
 * its willingness ÷ its unit's worth. Null when it does not trade, either resource is off the
 * table, or it has none of `get` to spare.
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

/** Months until a gift's opinion is gone at the modifier's monthly decay. */
export const monthsLeft = (value: number, decay: number | null) =>
	decay && decay > 0 ? Math.ceil(value / decay) : null;
