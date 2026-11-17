import type { Resources, Snapshot } from '#lib/types.ts';
import { addResources, goalCost, type CostWorld } from './cost.ts';

// When a planned goal can be paid for, and built: its cost against the stockpile and the monthly
// net. Two incomes: this month's, and the mean of the last months (a profile setting, ⚙). The net
// is the budget's (`balance`), which books recurring flows only — one-time spending (construction,
// edicts, decisions, #lib/spending.ts) moves the stockpile but never the net, so the mean leaves it
// out by construction. Pure.

export const DEFAULT_INCOME_WINDOW = 6;
export const MAX_INCOME_WINDOW = 24;

export function parseIncomeWindow(v: unknown): number {
	return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_INCOME_WINDOW
		? v
		: DEFAULT_INCOME_WINDOW;
}

export type Rates = { now: Resources; avg: Resources; months: number }; // months: the mean's

const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

/**
 * This month's net and the mean net over the last `window` game months that have a reading (saves
 * within one month report the same budget, so the month's last one stands for it).
 */
export function incomeRates(snaps: Snapshot[], window: number): Rates {
	const latest = snaps.at(-1);
	if (!latest) return { now: {}, avg: {}, months: 0 };
	const last = monthIndex(latest.date);
	const byMonth = new Map<number, Resources>();
	for (const s of snaps) {
		const m = monthIndex(s.date);
		if (m > last - window && m <= last) byMonth.set(m, s.balance);
	}
	const months = [...byMonth.values()];
	const avg = months.reduce((a, b) => addResources(a, b, 1 / months.length), {} as Resources);
	return { now: latest.balance, avg, months: months.length };
}

/** Months until `cost` is in the stockpile at `rate`; null: never (no income, or over storage). */
export type Eta = { months: number | null; binding: string | null; overCap: string[] };

export function eta(cost: Resources, stock: Resources, rate: Resources, max: Resources): Eta {
	let months = 0;
	let binding: string | null = null;
	const overCap = Object.keys(cost).filter((r) => max[r] !== undefined && cost[r] > max[r]);
	for (const [r, need] of Object.entries(cost)) {
		const short = need - (stock[r] ?? 0);
		if (short <= 0) continue;
		const m = (rate[r] ?? 0) > 0 ? short / rate[r] : Infinity;
		if (m > months) [months, binding] = [m, r];
	}
	return { months: overCap.length || months === Infinity ? null : months, binding, overCap };
}

/** A goal's two times, from one income: paid (start) and built (finish). */
export type When = { start: number | null; finish: number | null; binding: string | null };
export type CostRow = {
	cost: Resources;
	days: number | null; // base build days
	overCap: string[];
	alone: { now: When; avg: When };
	ordered: { now: When; avg: When } | null; // with the wants above it paid first
};

const when = (e: Eta, days: number | null): When => ({
	start: e.months,
	finish: e.months === null || days === null ? null : e.months + days / 30,
	binding: e.binding
});

export type Planned = {
	id: string;
	kind: string;
	target: Record<string, unknown>;
	queued: boolean; // counts towards the plan order: wanted, not done, not blocked, not parked
};

/**
 * Each goal's cost and times, alone and in plan order — the goals before it that are `queued` paid
 * first, out of the same stockpile and income (so its time is that of their sum and its own).
 */
export function costRows(
	goals: Planned[],
	w: CostWorld,
	rates: Rates,
	max: Resources
): Map<string, CostRow> {
	const out = new Map<string, CostRow>();
	const stock = w.latest.stockpile;
	let before: Resources = {};
	let ahead = 0;
	for (const g of goals) {
		const c = goalCost(g.kind, g.target, w);
		if (!c) continue;
		// storage caps what one goal can gather, not the plan's sum: that is paid as it goes
		const both = (cost: Resources, cap: Resources) => ({
			now: when(eta(cost, stock, rates.now, cap), c.days),
			avg: when(eta(cost, stock, rates.avg, cap), c.days)
		});
		const sum = addResources(before, c.cost);
		const alone = both(c.cost, max);
		const overCap = eta(c.cost, stock, rates.now, max).overCap;
		out.set(g.id, {
			cost: c.cost,
			days: c.days,
			overCap,
			alone,
			// the first queued goal's plan-order time is its own
			ordered: g.queued && ahead > 0 ? (overCap.length ? alone : both(sum, {})) : null
		});
		if (g.queued) [before, ahead] = [sum, ahead + 1];
	}
	return out;
}

/** Months as the planner shows them: "now", "< 1 m", "3 m", "2 y 4 m"; null: "never". */
export function formatMonths(m: number | null): string {
	if (m === null) return 'never';
	if (m <= 0) return 'now';
	if (m < 1) return '< 1 m';
	const whole = Math.ceil(m);
	const [y, mo] = [Math.floor(whole / 12), whole % 12];
	return y ? (mo ? `${y} y ${mo} m` : `${y} y`) : `${mo} m`;
}
