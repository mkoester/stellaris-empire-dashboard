import { fmt, pretty } from './format.ts';
import { byTopBar } from './resourceGroups.ts';
import { gameYear, type Series } from './series.ts';
import type { DealSide, Resources, Snapshot, TradeDeal } from './types.ts';

// Trade deals along a branch: what they move each month, which ones there were. Pure.

/** The game date a deal ends, or null for one without an end (or an unknown start). */
export function dealEnd(d: Pick<TradeDeal, 'start' | 'years'>): string | null {
	if (d.start === null || d.years === null) return null;
	const [y, ...rest] = d.start.split('.');
	return [Number(y) + d.years, ...rest].join('.');
}

export type SidePart =
	{ resource: string; amount: number; monthly: boolean } | { resource: null; text: string };

/** One side's parts: monthly resources, then once-off ones (each in the top bar's order), then terms. */
export function sideParts(s: DealSide): SidePart[] {
	const resources = (r: Resources, monthly: boolean): SidePart[] =>
		Object.entries(r)
			.sort(([a], [b]) => byTopBar(a, b))
			.map(([resource, amount]) => ({ resource, amount, monthly }));
	return [
		...resources(s.monthly, true),
		...resources(s.once, false),
		...s.other.map((o) => ({ resource: null, text: pretty(o) }))
	];
}

/** One side in a line: "10 energy/month, 200 minerals, sensor link" — or "nothing". */
export function sideSummary(s: DealSide): string {
	const parts = sideParts(s).map((p) =>
		p.resource === null
			? p.text
			: `${fmt(p.amount)} ${pretty(p.resource)}${p.monthly ? '/month' : ''}`
	);
	return parts.length ? parts.join(', ') : 'nothing';
}

/** Net monthly resources the deals bring in (received minus given). */
export function dealNet(deals: TradeDeal[]): Resources {
	const net: Resources = {};
	for (const d of deals) {
		for (const [k, v] of Object.entries(d.gets.monthly)) net[k] = (net[k] ?? 0) + v;
		for (const [k, v] of Object.entries(d.gives.monthly)) net[k] = (net[k] ?? 0) - v;
	}
	return net;
}

/** Net monthly resources from deals over time, one line per resource ever traded: saves only. */
export function dealFlowSeries(history: Snapshot[]): Series {
	const saves = history.filter((s) => s.tradeDeals !== null);
	const nets = saves.map((s) => dealNet(s.tradeDeals!));
	const keys = [...new Set(nets.flatMap((n) => Object.keys(n)))].sort();
	return {
		x: saves.map((s) => gameYear(s.date)),
		lines: Object.fromEntries(keys.map((k) => [k, nets.map((n) => n[k] ?? 0)]))
	};
}

/** Every deal seen along the branch, newest first, with the saves it was first and last seen in. */
export function dealHistory(
	history: Snapshot[]
): { deal: TradeDeal; firstSeen: string; lastSeen: string; active: boolean }[] {
	const saves = history.filter((s) => s.tradeDeals !== null);
	const latest = saves.at(-1)?.tradeDeals ?? [];
	const seen = new Map<string, { deal: TradeDeal; firstSeen: string; lastSeen: string }>();
	for (const s of saves)
		for (const d of s.tradeDeals!) {
			const known = seen.get(d.id);
			seen.set(d.id, { deal: d, firstSeen: known?.firstSeen ?? s.date, lastSeen: s.date });
		}
	return [...seen.values()]
		.map((e) => ({ ...e, active: latest.some((d) => d.id === e.deal.id) }))
		.sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
}
