import type { MarketOrder } from './types.ts';

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

/** The monthly limit for an order, or null for a resource without one. */
export function monthlyLimit(order: Pick<MarketOrder, 'kind' | 'resource'>): number | null {
	const amount = MARKET_AMOUNT[order.resource];
	return amount === undefined ? null : Math.floor(amount * FACTOR[order.kind]);
}
