import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { tradeoffData } from '#lib/server/tradeoffs.ts';

// The exploratory trade-offs tab (a display switch in ⚙): what can be built now, measured from the
// branch's latest full save, and what upcoming techs and traditions change. Ranked and simulated
// in the page, so the knobs answer at once.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	return { ...rest, tradeoffs: tradeoffData({ ...rest, snaps }) };
}
