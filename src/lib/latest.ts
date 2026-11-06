import type { Snapshot } from './types.ts';

/**
 * The branch's latest snapshot as the pages read it. A month from the companion mod's feed (`log`)
 * carries no colonies; while no save follows it — `fast_forward`, which writes no autosaves
 * (throwaway Theian Preservers 2207.05–10, 2026-11-05: the colonies tab said "No colony matches")
 * — the colonies are the last save's.
 */
export function latestOf(snaps: Snapshot[]): Snapshot {
	const last = snaps[snaps.length - 1];
	if (last.kind !== 'log' || last.colonies.length) return last;
	const save = snaps.findLast((s) => s.kind === 'save');
	return save ? { ...last, colonies: save.colonies } : last;
}
