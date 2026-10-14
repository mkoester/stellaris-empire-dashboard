import type { Resources, Snapshot } from './types.ts';

// Snapshot history → chart columns. Pure, shared by server and page.

/** "2203.07.01" → 2203.5 (game months are 30 days; precision beyond a day is irrelevant here). */
export function gameYear(date: string): number {
	const [y, m, d] = date.split('.').map(Number);
	return y + (m - 1) / 12 + (d - 1) / 360;
}

export type Series = { x: number[]; lines: Record<string, number[]> };

/** One line per resource that appears anywhere in the history; missing months read as 0. */
export function resourceSeries(history: Snapshot[], pick: (s: Snapshot) => Resources): Series {
	const keys = [...new Set(history.flatMap((s) => Object.keys(pick(s))))].sort();
	return {
		x: history.map((s) => gameYear(s.date)),
		lines: Object.fromEntries(keys.map((k) => [k, history.map((s) => pick(s)[k] ?? 0)]))
	};
}

export function popSeries(history: Snapshot[]): Series {
	return { x: history.map((s) => gameYear(s.date)), lines: { pops: history.map((s) => s.pops) } };
}
