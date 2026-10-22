import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { resourceKeys, resourcePanelSeries, xRange } from '#lib/series.ts';

// One chart per resource along the branch (stockpile, net per month) and the latest save's budget
// by source; mod-feed months carry no budget.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const budgeted = snaps.findLast((s) => s.budget !== null);
	return {
		...rest,
		panels: resourceKeys(snaps).map((key) => ({ key, series: resourcePanelSeries(snaps, key) })),
		budget: budgeted?.budget ?? null,
		budgetDate: budgeted?.date ?? null,
		xRange: xRange(snaps)
	};
}
