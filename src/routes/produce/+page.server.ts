import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { produceData } from '#lib/server/produce.ts';
import { produceView } from '#lib/server/settings.ts';

// The best way to get more of a resource: every option ranked by trade per unit, against the market.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	return { ...rest, produce: produceData({ ...rest, snaps }), view: produceView() };
}
