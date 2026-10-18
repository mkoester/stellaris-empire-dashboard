import { error } from '@sveltejs/kit';
import { dlcRows } from '#lib/addons.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';

// Every DLC the game knows, which the branch's latest save has active, and when that changed.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const last = snaps.findLast((s) => s.dlcs !== null);
	return {
		...rest,
		seenAt: last?.date ?? null,
		rows: dlcRows(getGameData().dlcs, last?.dlcs ?? null),
		changes: rest.milestones.filter((m) => m.kind === 'dlc')
	};
}
