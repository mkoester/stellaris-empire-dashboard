import { colonyActiveBuildings } from './buildings.ts';
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

// The market fee: `MARKET_TRADE_FEE_BASE` 30 % plus every `country_trade_fee`, at least
// `MARKET_TRADE_FEE_MIN` 5 %. The save holds no total, so it is summed from the sources the save
// shows — every `country_trade_fee` in 4.5.2's `common/` (re-grep on game updates). Not counted:
// the enclave trader councilor (`councilor_enclave_trader`, −1 %), whose post the snapshot lacks.
const BASE_FEE = 0.3;
const MIN_FEE = 0.05;

type FeeSource = {
	key: string;
	name: string; // the game's English name
	fee: number;
	in: 'tradition' | 'modifier' | 'building' | 'station';
};
const FEE_SOURCES: FeeSource[] = [
	{ key: 'tr_mercantile_insider_trading', name: 'Insider Trading', fee: -0.1, in: 'tradition' },
	{ key: 'tr_logistics_4', name: 'Galactic Exchange Efficiencies', fee: -0.1, in: 'tradition' },
	{
		key: 'tr_versatility_adaptive_programming',
		name: 'Adaptive Programming',
		fee: -0.1,
		in: 'tradition'
	},
	{ key: 'galactic_market_founder', name: 'Market Nexus', fee: -0.1, in: 'modifier' },
	{
		key: 'secrets_of_the_inetian_traders',
		name: 'Secrets of the Inetian Traders',
		fee: -0.05,
		in: 'modifier'
	},
	{
		key: 'secrets_of_the_inetian_traders_hive_mach',
		name: 'Secrets of the Inetian Traders',
		fee: -0.05,
		in: 'modifier'
	},
	{ key: 'resolution_sanctions_economic', name: 'Economic Sanctions', fee: 0.1, in: 'modifier' },
	{
		key: 'black_needle_base_sold_stolen_items',
		name: 'Sold Stolen Items (Black Needle Base)',
		fee: 0.1,
		in: 'modifier'
	},
	// country_modifier of a building: once per building (one per planet)
	{
		key: 'building_galactic_stock_exchange',
		name: 'Galactic Stock Exchange',
		fee: -0.05,
		in: 'building'
	},
	{ key: 'trader_proxy_office', name: 'Trader Proxy Office', fee: -0.05, in: 'station' },
	{
		key: 'waystation_trader_proxy_office',
		name: 'Trader Proxy Office (waystation)',
		fee: -0.05,
		in: 'station'
	}
];

export type MarketFee = {
	fee: number;
	sources: { key: string; name: string; count: number; fee: number }[];
};

/** The fee as a fraction (0.3 = 30 %) with what lowers or raises it; null without the data. */
export function marketFee(s: Snapshot): MarketFee | null {
	if (s.traditions === null || s.countryModifiers === null || s.stations === null) return null;
	const found: Record<FeeSource['in'], string[]> = {
		tradition: s.traditions,
		modifier: s.countryModifiers.map((m) => m.key),
		building: s.colonies.flatMap((c) => colonyActiveBuildings(c.districtList)),
		station: s.stations.flatMap((st) => [...st.modules, ...st.buildings])
	};
	const sources = FEE_SOURCES.map((f) => ({
		key: f.key,
		name: f.name,
		count: found[f.in].filter((k) => k === f.key).length,
		fee: f.fee
	})).filter((f) => f.count > 0);
	const total = BASE_FEE + sources.reduce((sum, f) => sum + f.fee * f.count, 0);
	return { fee: Math.max(MIN_FEE, Math.round(total * 1000) / 1000), sources };
}

/** The fee in percent over time: saves only, a gap where a save lacks the data. */
export function feeSeries(history: Snapshot[]): Series {
	const saves = history.filter((s) => s.kind === 'save');
	return {
		x: saves.map((s) => gameYear(s.date)),
		lines: {
			'market fee %': saves.map((s) => {
				const f = marketFee(s);
				return f === null ? null : Math.round(f.fee * 1000) / 10;
			})
		}
	};
}

// How a price recovers after trading, fitted on the internal market of Roaming Cyber Gang
// (2221–2223, 4.5.x; the user's ask 2026-11-19 after buying 1000 food). Per day the fluctuation
// moves back toward 0 by RECOVER_ABOVE + RECOVER_PER × f above the base price (0.018519 =
// 400 % / 21600 days; at 0.62, 18.8, 19.2 and 19.8 % it reproduces the saves to 4 digits) and by
// RECOVER_BELOW below it (−0.36 → −0.32316 in 12 days); under MARKET_FLUCTUATION_EPSILON it snaps to
// 0. A monthly order moves it on the 1st by 2 (INTERNAL_MARKET_FLUCTUATION_MULT) × amount ÷
// `market_amount` % — × MARKET_FLUCTUATION_ABOVE_BASE_PRICE 1 buying, × _BELOW_ 0.3 selling (42
// food +0.84, 6 motes −0.36). Together they give the buy limit: 42 energy adds 0.84, and a month's
// recovery (0.0185 × 29 days) brings that under 0.3 by the next 1st. The defines'
// MARKET_DAYS_TO_BASE_PRICE × INTERNAL_MARKET_DAYS_TO_BASE_PRICE (5400 days from +400 %) would
// recover 4× faster than seen. The galactic market: trades move it ½ as much and it recovers 3×
// faster (the internal multipliers), not fitted, and every member trades on it.
const RECOVER_ABOVE = 400 / 21600;
const RECOVER_PER = 0.000297;
const RECOVER_BELOW = 0.00307;
const EPSILON = 0.3;
const IMPACT = { buy: 1, sell: -0.3 };
const DAY_LIMIT = 360 * 100;

/**
 * When the price of `resource`, now `fluctuation` % off base on day `day` (`toDays()`), is back to
 * normal with these standing orders: the first day it snaps to 0. `days` null when that is no
 * later than the next month's trade (the orders' own monthly swing), `never` when the orders push
 * it further each month than it recovers.
 */
export function priceRecovery(
	resource: string,
	fluctuation: number,
	day: number,
	orders: MarketOrder[],
	galactic = false
): { days: number | null; never: boolean } {
	const amount = MARKET_AMOUNT[resource];
	const speed = galactic ? 3 : 1;
	const monthly = orders
		.filter((o) => o.resource === resource && amount !== undefined)
		.reduce((s, o) => s + ((galactic ? 1 : 2) * IMPACT[o.kind] * o.amount) / amount, 0);
	let f = fluctuation;
	const nextTrade = (Math.floor(day / 30) + 1) * 30;
	for (let d = day + 1; d <= day + DAY_LIMIT; d++) {
		const step =
			speed * (f > 0 ? RECOVER_ABOVE + RECOVER_PER * f : RECOVER_BELOW - RECOVER_PER * f);
		f = f > 0 ? Math.max(0, f - step) : Math.min(0, f + step);
		if (Math.abs(f) < EPSILON) return { days: d <= nextTrade ? null : d - day, never: false };
		if (d % 30 === 0) f += monthly;
	}
	return { days: null, never: true };
}
