import { error } from '@sveltejs/kit';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { setupGroups } from '#lib/galaxySetup.ts';

// The settings the galaxy was created with, from the branch's latest save that holds them.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const s = snaps.findLast((x) => x.kind === 'save' && x.galaxySetup);
	return {
		...rest,
		seenAt: s?.date ?? null,
		groups: s?.galaxySetup ? setupGroups(s.galaxySetup, getGameData().precursors) : []
	};
}
