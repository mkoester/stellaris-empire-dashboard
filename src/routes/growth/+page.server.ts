import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { growthData } from '#lib/server/growth.ts';
import { popSeries, xExtent } from '#lib/series.ts';

// Pop growth per colony as measured, with what feeds the game's planet capacity, and projected.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	// the all tab's Pops chart, with the monthly change by cause
	return { ...rest, ...growthData(snaps), pops: popSeries(snaps), xExtent: xExtent(snaps) };
}
