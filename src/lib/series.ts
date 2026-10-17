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
	const keys = [...new Set(history.flatMap((s) => Object.keys(pick(s) ?? {})))].sort();
	return {
		x: history.map((s) => gameYear(s.date)),
		lines: Object.fromEntries(
			keys.map((k) => [k, history.map((s) => (pick(s) === null ? null : (pick(s)![k] ?? 0)))])
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

/**
 * Council agenda progress over time and the gain per month since the save before (same agenda;
 * a gap where the agenda changed or no earlier save exists).
 */
export function agendaSeries(history: Snapshot[]): Series {
	const saves = history.map((s) => (s.progress?.agenda ? s : null));
	return {
		x: history.map((s) => gameYear(s.date)),
		lines: {
			progress: saves.map((s) => s?.progress?.agenda?.progress ?? null),
			'per month': saves.map((s, i) => {
				const before = saves.slice(0, i).findLast((p) => p !== null && p.date < (s?.date ?? ''));
				const a = s?.progress?.agenda;
				const b = before?.progress?.agenda;
				if (!s || !a || !b || a.key !== b.key) return null;
				const months = (gameYear(s.date) - gameYear(before.date)) * 12;
				return months > 0 ? Math.round(((a.progress - b.progress) / months) * 10) / 10 : null;
			})
		}
	};
}
