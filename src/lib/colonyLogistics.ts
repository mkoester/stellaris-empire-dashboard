import { basePrice } from './market.ts';
import type { ProduceRow } from './produce.ts';
import type { Colony, Resources } from './types.ts';

// What a colony's local deficits cost — pure. A colony that uses more of a resource than it makes
// is supplied from the rest of the empire, and the empire pays trade for it: the budget's
// `planet_resource_deficit` (4.5 `COLONY_DEFICIT_ECONOMIC_CATEGORY`), booked empire-wide only.
// The rule (MattMills/stellarstellaris-win `docs/economy.md`, "Planetary deficits", inferred
// there from saves): per colony and resource, the shortfall (upkeep − produces) × the resource's
// `deficit_trade_conversion_mult` (`common/strategic_resources`: 0.125 basic, 0.25 consumer goods,
// 0.5 alloys, 1.25 / 2.5 rare and strategic; data DB `strategic_resource.deficit_trade`), × the
// galaxy setting "Logistics: Planet Deficit" (`logistics_planet_deficit_costs`, 1 by default).
// **The capital's shortfall is first covered by the country's `country_base` income.** Checked
// 2026-11-02: 15 of 17 AI empires exact (2210.01.01; the two misses pre-FTL), our campaigns 1.6 to
// 4.4 % off (Planetforgers 2213.11–2214.02, UNE 2202.08 and 2207.04) — the colony tables are the
// month's, the budget's jobs a moment later. `fitCheck()` shows the gap; every figure is ≈.

export const BUDGET_SOURCE = 'planet_resource_deficit';
const PER_PRICE = 0.125; // every rate is 0.125 × the base price: the fallback for an old data DB

/** Trade a month per unit short: the data DB's rate, else 0.125 × the market base price. */
export const rateOf = (resource: string, rates: Resources): number | null => {
	const r = rates[resource];
	if (r !== undefined) return r;
	const p = basePrice(resource);
	return p === null ? null : p * PER_PRICE;
};

/** The capital's colony: its designation is one of the capital ones (`col_capital*`). */
export const isCapital = (c: Pick<Colony, 'designation'>) =>
	c.designation.startsWith('col_capital');

/**
 * What the colony uses beyond what it makes, per resource (positive amounts only), less what
 * `covered` pays first (the country's `country_base` income, for the capital).
 */
export function shortfall(
	c: Pick<Colony, 'produces' | 'upkeep'>,
	covered: Resources = {}
): Resources {
	return Object.fromEntries(
		Object.entries(c.upkeep)
			.map(([k, v]) => [k, v - (c.produces[k] ?? 0) - (covered[k] ?? 0)] as const)
			.filter(([, v]) => v > 1e-6)
	);
}

export type Fee = {
	byResource: Resources; // trade a month
	total: number;
	unpriced: string[]; // short of something with no known rate
};

/** The trade a month the shortfall costs, at the galaxy's planet-deficit multiplier. */
export function logisticsFee(short: Resources, rates: Resources = {}, mult = 1): Fee {
	const byResource: Resources = {};
	const unpriced: string[] = [];
	for (const [k, v] of Object.entries(short)) {
		const r = rateOf(k, rates);
		if (r === null) unpriced.push(k);
		else if (r > 0) byResource[k] = v * r * mult;
	}
	return { byResource, total: Object.values(byResource).reduce((a, b) => a + b, 0), unpriced };
}

/** The galaxy setting's multiplier, 1 when the save has none. */
export const feeMult = (setup: Record<string, unknown> | null | undefined) => {
	const v = setup?.logistics_planet_deficit_costs;
	return typeof v === 'number' && Number.isFinite(v) ? v : 1;
};

export type FitCheck = { model: number; booked: number | null; off: number | null };

/** The model's sum over our colonies against what the budget booked; `off` as a share. */
export function fitCheck(fees: number[], booked: number | null): FitCheck {
	const model = fees.reduce((a, b) => a + b, 0);
	const off =
		booked === null ? null : booked === 0 ? (model === 0 ? 0 : null) : (model - booked) / booked;
	return { model, booked, off };
}

export type LocalAlternative = {
	resource: string;
	short: number; // a month
	importing: number; // trade per unit: the empire's cost of making it elsewhere + the fee
	fee: number; // trade per unit, the fee alone
	best: {
		label: string;
		perUnit: number; // trade per unit over the horizon: its cost and upkeep
		needed: number; // how many to build to cover the shortfall
		room: number | null; // how many can be built here; null: unknown (buildings: slots are not in the save)
		workers: number; // pops the needed ones employ
		moved: number; // of them, pops taken off the jobs they work now (the idle go first)
		lost: number; // trade per unit: what the moved pops make now
		total: number; // perUnit + lost
		made: number; // units a month the needed ones make (the shortfall and a surplus)
		net: number; // trade a month: (total − the unit's value) × made; below 0 it pays by itself
	} | null; // null: nothing here adds it
	verdict: 'import' | 'local' | 'none';
};

/** What the colony's job output is worth a month per employed pop, in trade. */
export const perWorker = (jobOutput: Resources, employed: number, values: Resources) =>
	employed > 0
		? Object.entries(jobOutput).reduce(
				(sum, [k, v]) => sum + v * (values[k] ?? basePrice(k) ?? 1),
				0
			) / employed
		: 0;

/**
 * Per short resource: importing — the empire's cost per unit (`values`) plus the fee per unit —
 * against the cheapest way to make it on this colony (`rows`: `rankFor()` of the colony's own
 * options) plus what its workers make now: civilians (`idle`) take the jobs first, the rest leave
 * their jobs, each worth `worker` trade a month (`perWorker()`). Making it here wins when its net
 * cost a month — (that per unit − the unit's value) × the units it makes, surplus included — is
 * less than the fee on the shortfall.
 */
export function localAlternatives(
	short: Resources,
	values: Resources,
	rows: Record<string, ProduceRow[]>,
	rates: Resources = {},
	mult = 1,
	worker = 0,
	idle = 0
): LocalAlternative[] {
	return Object.entries(short).map(([resource, amount]) => {
		const fee = (rateOf(resource, rates) ?? 0) * mult;
		const value = values[resource] ?? basePrice(resource) ?? 1;
		const importing = value + fee;
		const row = rows[resource]?.[0];
		const best = row
			? (() => {
					const needed = Math.ceil(amount / row.gain - 1e-9);
					const workers = row.option.pops * needed;
					const moved = Math.max(0, workers - idle);
					const made = row.gain * needed;
					const lost = (moved * worker) / made;
					return {
						label: row.option.label,
						perUnit: row.perUnit,
						needed,
						room: row.option.kind === 'building' ? null : row.option.count,
						workers,
						moved,
						lost,
						total: row.perUnit + lost,
						made,
						net: (row.perUnit + lost - value) * made
					};
				})()
			: null;
		// importing costs the fee on the shortfall; making it here its net cost (every unit it makes
		// is worth its value, the surplus too)
		const verdict = !best ? 'none' : best.net < fee * amount ? 'local' : 'import';
		return { resource, short: amount, importing, fee, best, verdict };
	});
}
