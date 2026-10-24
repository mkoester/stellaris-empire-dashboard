import type { Change, TradeOption } from './tradeoffs.ts';
import type { Resources } from './types.ts';
import { valueOf } from './value.ts';

// The best way to get more of one resource — pure. Every option (a station, a district, a
// building, a starbase module, a cleared blocker with the district it makes room for, an edict)
// costs something once, something per month and yields per month; the market sells the resource
// at its price plus the fee. Each option is priced as **trade per unit** of the resource over a
// horizon: (one-off + months × what it uses per month) ÷ (months × the units it adds) — the same
// unit as the market's buy price, so the two compare directly. What else it yields is shown beside
// it, not netted: a mining district that yields a little alloys besides its minerals is no cheap
// way to get alloys.

export type ProduceKind =
	TradeOption['kind'] | 'module' | 'starbase_building' | 'blocker' | 'edict';

export type ProduceOption = Omit<TradeOption, 'kind'> & {
	kind: ProduceKind;
	// measured: from our budget; base: the game files' value, before modifiers; estimated: a
	// modifier's share of what its group yields now
	basis: 'measured' | 'base' | 'estimated';
};

/** Monthly output per group a change can target: `jobs`, `job:<job>`, `stratum:<s>`, stations. */
export type GroupFlows = Record<string, Resources>;

const add = (a: Resources, b: Resources, k = 1): Resources => {
	const out = { ...a };
	for (const [r, v] of Object.entries(b)) out[r] = (out[r] ?? 0) + v * k;
	return out;
};

/**
 * What output changes add per month today: each change's percentage of what its groups yield now,
 * of one resource or all. An approximation — the game adds multipliers, so +10 % on top of an
 * existing +50 % is less than 10 % of the measured output.
 */
export function changeGain(changes: Change[], flows: GroupFlows): Resources {
	let out: Resources = {};
	for (const c of changes.filter((c) => c.target === 'output'))
		for (const g of c.groups) {
			const yields = flows[g] ?? {};
			const picked = c.resource ? { [c.resource]: yields[c.resource] ?? 0 } : yields;
			out = add(out, picked, c.pct);
		}
	return Object.fromEntries(Object.entries(out).filter(([, v]) => Math.abs(v) > 1e-9));
}

export type ProduceRow = {
	option: ProduceOption;
	gain: number; // units of the resource per month, net of what the option itself uses of it
	cost: number; // one-off, in trade
	uses: number; // per month, in trade: upkeep and inputs in other resources
	also: number; // per month, in trade: what else it yields
	perUnit: number; // trade per unit of the resource over the horizon
	payback: number | null; // months until it beats buying the units; null without a market price
};

/**
 * An option's other resources per month, split: what it uses (upkeep, and inputs — negative
 * output) and what else it yields. `resource` itself is left out (its net is the gain).
 */
export function sides(option: ProduceOption, resource: string) {
	const uses: Resources = {};
	const also: Resources = {};
	for (const [k, v] of Object.entries(option.upkeep))
		if (k !== resource) uses[k] = (uses[k] ?? 0) + v;
	for (const [k, v] of Object.entries(option.output))
		if (k === resource) continue;
		else if (v < 0) uses[k] = (uses[k] ?? 0) - v;
		else also[k] = v;
	return { uses, also };
}

/**
 * The options that add `resource`, cheapest per unit over `months` first. With a market price
 * (`buy`, fee included) each also shows its payback against buying the same units.
 */
export function rankFor(
	resource: string,
	options: ProduceOption[],
	weights: Resources,
	months: number,
	buy: number | null
): ProduceRow[] {
	return options
		.flatMap((option): ProduceRow[] => {
			const gain = (option.output[resource] ?? 0) - (option.upkeep[resource] ?? 0);
			if (gain <= 1e-9) return [];
			const { uses, also } = sides(option, resource);
			const cost = valueOf(option.cost, weights);
			const [u, a] = [valueOf(uses, weights), valueOf(also, weights)];
			const perUnit = (cost + months * u) / (months * gain);
			const saved = buy === null ? 0 : gain * buy - u;
			return [
				{ option, gain, cost, uses: u, also: a, perUnit, payback: saved > 0 ? cost / saved : null }
			];
		})
		.sort((a, b) => a.perUnit - b.perUnit);
}

/** Every resource some option adds, in `order` (the top bar's), the rest after. */
export function producible(options: ProduceOption[], order: string[]): string[] {
	const found = new Set(
		options.flatMap((o) =>
			Object.keys(o.output).filter((r) => (o.output[r] ?? 0) - (o.upkeep[r] ?? 0) > 1e-9)
		)
	);
	return [
		...order.filter((r) => found.has(r)),
		...[...found].filter((r) => !order.includes(r)).sort()
	];
}

export const HORIZONS = [12, 60, 120];

/** The tab's view, the profile's: the resource, the horizon, the viewer's own values in trade. */
export type ProduceView = { resource: string | null; months: number; weights: Resources };
export const DEFAULT_PRODUCE_VIEW: ProduceView = { resource: null, months: 60, weights: {} };

export function parseProduceView(v: unknown): ProduceView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<ProduceView>;
	const w = o.weights && typeof o.weights === 'object' ? o.weights : {};
	return {
		resource: typeof o.resource === 'string' ? o.resource : null,
		months: HORIZONS.includes(o.months as number)
			? (o.months as number)
			: DEFAULT_PRODUCE_VIEW.months,
		weights: Object.fromEntries(
			Object.entries(w).filter(([, x]) => typeof x === 'number' && Number.isFinite(x) && x >= 0)
		)
	};
}
