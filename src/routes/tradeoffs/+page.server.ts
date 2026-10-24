import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { getExplanations } from '#lib/server/app.ts';
import { pick } from '#lib/server/explain.ts';
import { tradeoffData } from '#lib/server/tradeoffs.ts';
import { valuesOf } from '#lib/server/unitCosts.ts';

// The exploratory trade-offs tab (a display switch in ⚙): what can be built now, measured from the
// branch's latest full save, and what upcoming techs and traditions change. Ranked and simulated
// in the page, so the knobs answer at once.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const tradeoffs = tradeoffData({ ...rest, snaps });
	return {
		...rest,
		tradeoffs,
		values: valuesOf(snaps),
		// each preset's popup: everything the tech, tradition or perk does
		explain: pick(
			getExplanations(),
			(tradeoffs?.presets ?? []).map((p) => p.ref)
		)
	};
}
