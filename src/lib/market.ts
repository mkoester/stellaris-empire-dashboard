import { gameYear, type Series } from './series.ts';
import type { MarketOrder, Snapshot } from './types.ts';

// Soft monthly limits of the internal market: trading more per month than the price recovers in a
// month inflates it. The limits are the resource's `market_amount`
// (common/strategic_resources/00_strategic_resources.txt, 4.5.2) × 0.42 to buy / × 0.64 to sell,
// rounded down — this reproduces every value the RustyMonthlyLimits mod shows (42/64, 21/32,
// 10/16, 4/6, 2/3). The two factors are that mod's, from community testing, not from game files.

const MARKET_AMOUNT: Record<string, number> = {
	energy: 100,
	minerals: 100,
	food: 100,
	consumer_goods: 50,
	alloys: 25,
	volatile_motes: 10,
	exotic_gases: 10,
	rare_crystals: 10,
	sr_living_metal: 5,
	sr_zro: 5,
	sr_dark_matter: 5
};

const FACTOR = { buy: 0.42, sell: 0.64 };

/**
 * The monthly limit for an order, or null for a resource without one — and for every resource on
 * the galactic market, whose price all its members move, so one empire's limit means nothing.
 */
export function monthlyLimit(
	order: Pick<MarketOrder, 'kind' | 'resource'>,
	galactic = false
): number | null {
	const amount = MARKET_AMOUNT[order.resource];
	return amount === undefined || galactic ? null : Math.floor(amount * FACTOR[order.kind]);
}

/**
 * Every resource in the order of `common/strategic_resources/00_strategic_resources.txt` (4.5.2):
 * the save's per-resource market lists (`fluctuations`, `resources_bought`) follow it.
 */
export const MARKET_RESOURCES = [
	'energy',
	'minerals',
	'food',
	'physics_research',
	'society_research',
	'engineering_research',
	'influence',
	'unity',
	'trade',
	'consumer_goods',
	'alloys',
	'volatile_motes',
	'exotic_gases',
	'rare_crystals',
	'sr_living_metal',
	'sr_zro',
	'sr_dark_matter',
	'nanites',
	'minor_artifacts',
	'astral_threads',
	'biomass',
	'menace',
	'integrity',
	'advanced_logic',
	'feral_insight',
	'entropy_crystals'
];

// Every traded resource's `market_price` is 100 (4.5.2), in trade (`MARKET_RESOURCE`) for
// `market_amount` units.
const MARKET_PRICE = 100;

/** Trade per unit at base price: energy 1, consumer goods 2, alloys 4, motes 10, zro 20. */
export function basePrice(resource: string): number | null {
	const amount = MARKET_AMOUNT[resource];
	return amount === undefined ? null : MARKET_PRICE / amount;
}

/**
 * Trade per unit, before the market fee (the save does not hold the fee: 30 % base, lowered by
 * modifiers). The fluctuation is percent off the base price (`MARKET_MIN/MAX_FLUCTUATION_FROM_
 * BASE_PRICE`: −80 … +400).
 */
export function price(resource: string, fluctuation: number): number | null {
	const base = basePrice(resource);
	return base === null ? null : base * (1 + fluctuation / 100);
}

/**
 * Price per unit over time, one line per resource in `keys` that was ever traded: saves only (the
 * mod feed knows no prices), a gap where the market did not trade it.
 */
export function priceSeries(history: Snapshot[], keys: string[]): Series {
	const saves = history.filter((s) => s.market !== null);
	const traded = keys.filter((k) => saves.some((s) => k in s.market!.fluctuations));
	return {
		x: saves.map((s) => gameYear(s.date)),
		lines: Object.fromEntries(
			traded.map((k) => [
				k,
				saves.map((s) => {
					const f = s.market!.fluctuations[k];
					return f === undefined ? null : price(k, f);
				})
			])
		)
	};
}

/** Dates the branch moved between the internal and the galactic market, oldest first. */
export function marketSwitches(history: Snapshot[]): { date: string; galactic: boolean }[] {
	const saves = history.filter((s) => s.market !== null);
	return saves
		.filter((s, i) => i > 0 && s.market!.galactic !== saves[i - 1].market!.galactic)
		.map((s) => ({ date: s.date, galactic: s.market!.galactic }));
}
