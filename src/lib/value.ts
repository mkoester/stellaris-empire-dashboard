import { basePrice } from './market.ts';
import type { Resources } from './types.ts';

// Resources in one unit — pure. The market prices every tradable resource in trade (its
// currency): `market_price / market_amount`, energy 1, alloys 4, the rare ones 20. What the market
// does not sell (research, unity, influence, trade itself) counts as 1 unless the viewer weighs it.

export const NOT_TRADED = 1;

/** The value of one unit of each resource, in trade: its market base price, else 1. */
export const defaultWeights = (keys: string[]): Resources =>
	Object.fromEntries(keys.map((k) => [k, basePrice(k) ?? NOT_TRADED]));

export const valueOf = (r: Resources, weights: Resources) =>
	Object.entries(r).reduce(
		(sum, [k, v]) => sum + v * (weights[k] ?? basePrice(k) ?? NOT_TRADED),
		0
	);
