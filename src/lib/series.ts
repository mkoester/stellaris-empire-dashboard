import { stripOrder } from './resourceGroups.ts';
import type { Spend } from './spending.ts';
import type { Colony, Resources, Snapshot } from './types.ts';

// Snapshot history → chart columns. Pure, shared by server and page.
// A value a source does not report (pops and gross income in mod-feed months) is null, which the
// chart draws as a gap bridged by the line, not as a drop to zero.

/** "2203.07.01" → 2203.5 (game months are 30 days; precision beyond a day is irrelevant here). */
export function gameYear(date: string): number {
	const [y, m, d] = date.split('.').map(Number);
	return y + (m - 1) / 12 + (d - 1) / 360;
}

export type Series = { x: number[]; lines: Record<string, (number | null)[]> };

/** Fractional year → "2203.07" (inverse of gameYear, to the month). */
export function gameMonth(year: number): string {
	const months = Math.round(year * 12);
	return `${Math.floor(months / 12)}.${String((months % 12) + 1).padStart(2, '0')}`;
}

/** "2207.03.10" + 30 → "2207.04.10": the game's calendar has 30-day months, 12 per year. */
export function addGameDays(date: string, days: number): string {
	const [y, m, d] = date.split('.').map(Number);
	const t = y * 360 + (m - 1) * 30 + (d - 1) + days;
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${Math.floor(t / 360)}.${pad(Math.floor((t % 360) / 30) + 1)}.${pad((t % 30) + 1)}`;
}

/** Every game starts on 2200.01.01. */
export const START_YEAR = 2200;
const YEARS_AHEAD = 1;
const MIN_SPAN = 1 / 12; // zoomed in to a month at most

/**
 * The x-axis window every history chart shares (`#lib/timeWindow.svelte.ts`): the last `years`
 * up to now and one year ahead, following new saves; or a fixed stretch `from`–`to`, once zoomed
 * or panned into the past.
 */
export type TimeWindow = { years: number | 'all' } | { from: number; to: number };
export const DEFAULT_YEARS = 20;
export const DEFAULT_WINDOW: TimeWindow = { years: DEFAULT_YEARS };
export const WINDOW_PRESETS = [5, 10, 20, 50] as const;

/** The history's first and last date as fractional years (2200 when empty). */
export function xExtent(history: Snapshot[]): [number, number] {
	if (!history.length) return [START_YEAR, START_YEAR];
	return [gameYear(history[0].date), gameYear(history[history.length - 1].date)];
}

/** The x range of `w` over a history spanning `extent`, never before 2200 nor past a year ahead. */
export function windowRange([first, last]: [number, number], w: TimeWindow): [number, number] {
	const end = last + YEARS_AHEAD;
	if ('years' in w) {
		const from = w.years === 'all' ? first : last - w.years;
		return [Math.max(START_YEAR, from), end];
	}
	return clampSpan(w.from, w.to, end);
}

/** `from`–`to` moved (not squeezed) into START_YEAR … end. */
function clampSpan(from: number, to: number, end: number): [number, number] {
	const span = Math.min(Math.max(to - from, MIN_SPAN), end - START_YEAR);
	const lo = Math.min(Math.max(from, START_YEAR), end - span);
	return [lo, lo + span];
}

/** A fixed stretch, or following the latest again once it reaches the right edge. */
function settle(from: number, to: number, [first, last]: [number, number]): TimeWindow {
	const end = last + YEARS_AHEAD;
	const [lo, hi] = clampSpan(from, to, end);
	if (hi < end - 1e-9) return { from: lo, to: hi };
	return lo <= Math.max(START_YEAR, first) + 1e-9 ? { years: 'all' } : { years: last - lo };
}

/** Zoomed by `factor` (< 1 in, > 1 out) around the year `at`, which stays where it is. */
export function zoomWindow(
	w: TimeWindow,
	extent: [number, number],
	factor: number,
	at: number
): TimeWindow {
	const [from, to] = windowRange(extent, w);
	return settle(at - (at - from) * factor, at + (to - at) * factor, extent);
}

/** Moved by `years` (negative: into the past). */
export function panWindow(w: TimeWindow, extent: [number, number], years: number): TimeWindow {
	const [from, to] = windowRange(extent, w);
	return settle(from + years, to + years, extent);
}

/** Exactly `from`–`to` (a drag-selection or the menu's years). */
export function spanWindow(extent: [number, number], from: number, to: number): TimeWindow {
	return settle(Math.min(from, to), Math.max(from, to), extent);
}

/** One line per resource that appears anywhere in the history; 0 where a reported map lacks it. */
export function resourceSeries(
	history: Snapshot[],
	pick: (s: Snapshot) => Resources | null
): Series {
	return pointSeries(history.map((s) => ({ date: s.date, values: pick(s) })));
}

/**
 * The stockpile per snapshot and, between snapshots, per day of the companion mod's tick (the
 * stockpile moves within a month: spending, the market, rewards).
 */
export function stockpileSeries(history: Snapshot[]): Series {
	return pointSeries(
		stockpilePoints(history).map((p) => ({
			date: p.date,
			values: withoutResearch(p.stockpile),
			partial: p.snap === null
		}))
	);
}

/** The points of `stockpileSeries`; `snap` is the snapshot a point is, null on a tick's day. */
function stockpilePoints(history: Snapshot[]) {
	return history.flatMap((s, i) => {
		const after = i > 0 ? history[i - 1].date : '';
		const days = (s.ticks ?? []).filter((t) => t.date > after && t.date < s.date);
		return [
			...days.map((t) => ({ date: t.date, stockpile: t.stockpile, snap: null })),
			{ date: s.date, stockpile: s.stockpile, snap: s as Snapshot | null }
		];
	});
}

/**
 * One resource's chart: its stockpile (daily where the mod's tick has it) and its net per month,
 * known at snapshots only — a gap on tick days, which the chart bridges.
 */
export function resourcePanelSeries(history: Snapshot[], key: string): Series {
	const points = stockpilePoints(history);
	return {
		x: points.map((p) => gameYear(p.date)),
		lines: {
			// a tick without the resource did not log it (a nomad's reserves): a gap, not 0
			stockpile: points.map((p) => p.stockpile[key] ?? (p.snap ? 0 : null)),
			'per month': points.map((p) => (p.snap ? (p.snap.balance[key] ?? 0) : null))
		}
	};
}

/** What the budget does not explain: the stockpile's change less the month's payout, by day. */
export type Unbooked = {
	since: string;
	actual: number; // the stockpile's change since `since`
	booked: number; // the month's payout, the budget's net
	days: { date: string; amount: number }[]; // the rest, per day of the mod's tick, else in one
	named: { date: string; label: string; amount: number; approx: boolean }[]; // of the rest
	unexplained: number; // the rest less what is named
	causes: { date: string; label: string }[]; // named, but at a cost the game does not say
};

/**
 * The latest month's resource changes outside the budget (construction, events, one-off market
 * trades, decisions, income lost at the cap, …), from the last snapshot before the latest's month
 * start on. The game pays the budget on the 1st, and a snapshot in that month holds that payout
 * as its balance (2207.03.10 → 04.02: energy −26.54 = +3.455 paid, −30 else; minerals −600 for a
 * district). Null when saves are missing for a month start in between.
 */
export function unbooked(history: Snapshot[], key: string, spends: Spend[] = []): Unbooked | null {
	const latest = history.at(-1);
	if (!latest) return null;
	const i = history.findLastIndex((s) => s.date < `${latest.date.slice(0, 8)}01`);
	if (i < 0 || monthStarts(history[i].date, latest.date) !== 1) return null;
	const base = history[i];
	const booked = latest.balance[key] ?? 0;
	const points = stockpilePoints(history.slice(i)).filter((p) => p.date >= base.date);
	const days = points.slice(1).flatMap((p, j) => {
		const before = points[j];
		const paid = monthStarts(before.date, p.date) > 0 ? booked : 0;
		const amount = (p.stockpile[key] ?? 0) - (before.stockpile[key] ?? 0) - paid;
		return Math.abs(amount) < 0.01 ? [] : [{ date: p.date, amount }];
	});
	const actual = (latest.stockpile[key] ?? 0) - (base.stockpile[key] ?? 0);
	const window = spends.filter((s) => s.date > base.date && s.date <= latest.date);
	const named = window.flatMap((s) =>
		s.cost?.[key] ? [{ date: s.date, label: s.label, amount: -s.cost[key], approx: s.approx }] : []
	);
	const unexplained = named.reduce((rest, n) => rest - n.amount, actual - booked);
	const causes = window.filter((s) => s.cost === null).map(({ date, label }) => ({ date, label }));
	return { since: base.date, actual, booked, days, named, unexplained, causes };
}

/** The resources to chart one by one: the strip's always-shown ones and any ever held or moved. */
export function resourceKeys(history: Snapshot[]): string[] {
	const moved = (r: Resources) => Object.keys(r).filter((k) => r[k] !== 0);
	return stripOrder(history.flatMap((s) => [...moved(s.stockpile), ...moved(s.balance)]));
}

/** One line per key; a key a point lacks is 0 — a gap where the point is `partial` (a tick's). */
function pointSeries(
	points: { date: string; values: Resources | null; partial?: boolean }[]
): Series {
	const keys = [...new Set(points.flatMap((p) => Object.keys(p.values ?? {})))].sort();
	return {
		x: points.map((p) => gameYear(p.date)),
		lines: Object.fromEntries(
			keys.map((k) => [
				k,
				points.map((p) => (p.values === null ? null : (p.values[k] ?? (p.partial ? null : 0))))
			])
		)
	};
}

/** One line per field, each one number (or a gap) per snapshot. */
export function fieldSeries(
	history: Snapshot[],
	fields: Record<string, (s: Snapshot) => number | null>
): Series {
	return {
		x: history.map((s) => gameYear(s.date)),
		lines: Object.fromEntries(Object.entries(fields).map(([label, f]) => [label, history.map(f)]))
	};
}

/** One line from one number per snapshot. */
export const scalarSeries = (
	history: Snapshot[],
	label: string,
	pick: (s: Snapshot) => number | null
): Series => fieldSeries(history, { [label]: pick });

export const popSeries = (history: Snapshot[]) => scalarSeries(history, 'pops', (s) => s.pops);

const RESEARCH = ['physics_research', 'society_research', 'engineering_research'];

/** The resource charts leave research out — it has its own chart. */
export const withoutResearch = (r: Resources | null): Resources | null =>
	r === null ? null : Object.fromEntries(Object.entries(r).filter(([k]) => !RESEARCH.includes(k)));

/** Monthly research per field, from the budget's income (the top bar's +14/+18/+14). */
export function researchSeries(history: Snapshot[]): Series {
	return resourceSeries(history, (s) =>
		s.income === null ? null : Object.fromEntries(RESEARCH.map((k) => [k, s.income![k] ?? 0]))
	);
}

/** One line per field of one colony; null where a snapshot has no such colony (or no colony data). */
export function colonySeries(
	history: Snapshot[],
	planetId: number,
	fields: Record<string, (c: Colony) => number | null>
): Series {
	const colony = (s: Snapshot) => s.colonies.find((c) => c.planetId === planetId);
	return {
		x: history.map((s) => gameYear(s.date)),
		lines: Object.fromEntries(
			Object.entries(fields).map(([label, f]) => [
				label,
				history.map((s) => {
					const c = colony(s);
					return c ? f(c) : null;
				})
			])
		)
	};
}

/** Month starts passed from one date to a later one: 2200.04.01 → 2200.05.02 is 1. */
export function monthStarts(from: string, to: string): number {
	const [fy, fm] = from.split('.').map(Number);
	const [ty, tm] = to.split('.').map(Number);
	return (ty - fy) * 12 + (tm - fm);
}

/**
 * Council agenda progress over time, one line per agenda (named by its key without `agenda_`), so
 * a new agenda starts its own line instead of falling from the last one's total; and the gain per
 * month since the save before on the same agenda. Progress moves on the 1st only, so the gain is
 * divided by the month starts passed — saves within one month give no rate, not 0.
 */
export function agendaSeries(history: Snapshot[]): Series {
	const agenda = (s: Snapshot) => s.progress?.agenda ?? null;
	const keys = [...new Set(history.flatMap((s) => agenda(s)?.key ?? []))];
	return {
		x: history.map((s) => gameYear(s.date)),
		lines: {
			...Object.fromEntries(
				keys.map((k) => [
					k.replace(/^agenda_/, ''),
					history.map((s) => (agenda(s)?.key === k ? agenda(s)!.progress : null))
				])
			),
			'per month': history.map((s, i) => {
				const a = agenda(s);
				const before = history
					.slice(0, i)
					.findLast((p) => agenda(p) !== null && monthStarts(p.date, s.date) > 0);
				const b = before && agenda(before);
				if (!a || !b || a.key !== b.key) return null;
				return Math.round(((a.progress - b.progress) / monthStarts(before.date, s.date)) * 10) / 10;
			})
		}
	};
}

/**
 * A colony's pops, employed, civilians and open jobs: at each snapshot from the save, and between
 * them on the days the companion mod (0.9.0) logged a change — its ticks, filed with the month
 * after them, matched by the colony's name (`name`: the page's, for months the log alone saw).
 * A day's employed is pops − unemployed, its civilians the unemployed (docs/open-checks.md 23).
 */
export function colonyDaySeries(
	history: Snapshot[],
	planetId: number,
	name: string,
	atSave: (c: Colony) => { pops: number; employed: number; civilians: number; open: number }
): Series {
	const points = history.flatMap((s, i) => {
		const after = i > 0 ? history[i - 1].date : '';
		const colony = s.colonies.find((c) => c.planetId === planetId);
		const key = colony?.name ?? name;
		const days = (s.ticks ?? []).flatMap((t) => {
			const d = t.colonies?.[key];
			return d && t.date > after && t.date < s.date
				? [
						{
							date: t.date,
							v: {
								pops: d.pops,
								employed: d.pops - d.unemployed,
								civilians: d.unemployed,
								open: d.openJobs
							}
						}
					]
				: [];
		});
		return [...days, { date: s.date, v: colony ? atSave(colony) : null }];
	});
	const line = (k: 'pops' | 'employed' | 'civilians' | 'open') =>
		points.map((p) => (p.v ? p.v[k] : null));
	return {
		x: points.map((p) => gameYear(p.date)),
		lines: {
			pops: line('pops'),
			employed: line('employed'),
			civilians: line('civilians'),
			'open jobs': line('open')
		}
	};
}
