import { error } from '@sveltejs/kit';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { namedSpending } from '#lib/spending.ts';
import { resourceKeys, resourcePanelSeries, unbooked, xRange } from '#lib/series.ts';

// One chart per resource along the branch (stockpile, net per month), the latest save's budget by
// source (mod-feed months carry none), and what changed the stockpile outside it, named.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const budgeted = snaps.findLast((s) => s.budget !== null);
	const data = getGameData();
	const spends = namedSpending(snaps, {
		names: data.names,
		edicts: data.edicts,
		shipCosts: Object.fromEntries(Object.entries(data.costs.ship).map(([k, c]) => [k, c.cost]))
	});
	return {
		...rest,
		panels: resourceKeys(snaps).map((key) => ({
			key,
			series: resourcePanelSeries(snaps, key),
			unbooked: unbooked(snaps, key, spends)
		})),
		budget: budgeted?.budget ?? null,
		budgetDate: budgeted?.date ?? null,
		xRange: xRange(snaps)
	};
}
