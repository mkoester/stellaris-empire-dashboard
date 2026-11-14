import type { Snapshot } from './types.ts';

// A feed month's own lists: empty means none this month, never "not known".
const OWN_LISTS = new Set(['logEvents', 'ticks']);
const missing = (v: unknown) => v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * The branch's latest snapshot as the pages read it. A month from the companion mod's feed (`log`)
 * carries only its date, stockpile, net income and events; while no save follows it — the next
 * autosave, or `fast_forward`, which writes none (throwaway Theian Preservers 2207.05–10,
 * 2026-11-05: the colonies tab said "No colony matches") — everything else is the last save's, so
 * nothing blanks out (the header lost name, score, empire size … after each feed month until the
 * next autosave, 0.1.15 on a fast machine, 2026-11-14).
 */
export function latestOf(snaps: Snapshot[]): Snapshot {
	const last = snaps[snaps.length - 1];
	if (last.kind !== 'log') return last;
	const save = snaps.findLast((s) => s.kind === 'save');
	if (!save) return last;
	const own = Object.entries(last).filter(([k, v]) => OWN_LISTS.has(k) || !missing(v));
	return { ...save, ...Object.fromEntries(own) } as Snapshot;
}
