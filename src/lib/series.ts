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
const YEARS_BACK = 20;
const YEARS_AHEAD = 1;

/** Default x-axis window: the last 20 years (never before the start) and one year ahead. */
export function xRange(history: Snapshot[]): [number, number] {
	const last = history.length ? gameYear(history[history.length - 1].date) : START_YEAR;
	return [Math.max(START_YEAR, last - YEARS_BACK), last + YEARS_AHEAD];
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
		history.flatMap((s, i) => {
			const after = i > 0 ? history[i - 1].date : '';
			const days = (s.ticks ?? []).filter((t) => t.date > after && t.date < s.date);
			return [
				...days.map((t) => ({ date: t.date, values: withoutResearch(t.stockpile) })),
				{ date: s.date, values: withoutResearch(s.stockpile) }
			];
		})
	);
}

function pointSeries(points: { date: string; values: Resources | null }[]): Series {
	const keys = [...new Set(points.flatMap((p) => Object.keys(p.values ?? {})))].sort();
	return {
		x: points.map((p) => gameYear(p.date)),
		lines: Object.fromEntries(
			keys.map((k) => [k, points.map((p) => (p.values === null ? null : (p.values[k] ?? 0)))])
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
