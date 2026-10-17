import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { dealFlowSeries, dealHistory } from '#lib/deals.ts';
import { xRange } from '#lib/series.ts';

// Trade deals along the branch: the running ones, what they move each month, all seen so far.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	return {
		...rest,
		history: dealHistory(snaps),
		flows: dealFlowSeries(snaps),
		xRange: xRange(snaps)
	};
}
