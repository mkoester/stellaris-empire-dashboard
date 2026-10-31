import type { Snapshot } from '#lib/types.ts';
import type { State } from './kinds.ts';

// Since when a goal holds along the branch, derived on read like the milestones: the first save
// of the latest unbroken run of saves that showed it. Pure.

export type Since = { date: string; exact: boolean }; // exact false: "by" that date (the run reaches back to a save that could not tell, or the first)

/**
 * `stateAt` answers the goal at one save (the latest included). Walks back from the latest while
 * the goal holds; a save that cannot tell (`unknown`) ends the walk inexactly.
 */
export function holdsSince(saves: Snapshot[], stateAt: (s: Snapshot) => State): Since | null {
	let since: string | null = null;
	for (let i = saves.length - 1; i >= 0; i--) {
		const st = stateAt(saves[i]);
		if (st === 'done') {
			since = saves[i].date;
			if (i === 0) return { date: since, exact: false };
			continue;
		}
		if (since === null) return null;
		return { date: since, exact: st !== 'unknown' };
	}
	return since === null ? null : { date: since, exact: false };
}

/** What the branch's saves listed at any time: for goals done once their subject is gone. */
export function seenAlong(saves: Snapshot[]) {
	const set = <T>(f: (s: Snapshot) => T[] | undefined) => [
		...new Set(saves.flatMap((s) => f(s) ?? []))
	];
	return {
		anomalies: set((s) => s.anomalies?.map((a) => a.planetId)),
		digSites: set((s) => s.digSites?.map((d) => d.planetId)),
		situations: set((s) => s.situations?.map((x) => x.type)),
		contacts: set((s) => s.firstContacts?.map((f) => f.countryId))
	};
}
