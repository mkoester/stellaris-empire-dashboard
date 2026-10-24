import type { Snapshot } from '#lib/types.ts';
import { colonyEfficiency, costSources, unitCosts, unitValues } from '#lib/unitCosts.ts';
import { getGameData } from './app.ts';

// What each unit costs us and how well each colony works its jobs, from the latest save with a
// budget (`#lib/unitCosts.ts`). `values` is what every tab values resources at, in trade.

const latest = (snaps: Snapshot[]) =>
	snaps.findLast((s) => s.kind === 'save' && s.budget !== null) ?? null;

export function economyOf(snaps: Snapshot[]) {
	const save = latest(snaps);
	if (!save?.budget) return null;
	const { jobs } = getGameData();
	const sources = costSources(save.budget, save.colonies, jobs);
	const values = unitValues(sources);
	return {
		date: save.date,
		values,
		costs: unitCosts(sources, values),
		colonies: colonyEfficiency(save.budget, save.colonies, jobs)
	};
}

/** Every resource's value in trade: the market's base price, else what it costs us ({} unknown). */
export const valuesOf = (snaps: Snapshot[]) => economyOf(snaps)?.values ?? {};
