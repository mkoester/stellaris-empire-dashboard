import { error } from '@sveltejs/kit';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { economyOf } from '#lib/server/unitCosts.ts';

// What each unit costs us, source by source, and how well each colony works its jobs.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const { jobs } = getGameData();
	return {
		...rest,
		economy: economyOf(snaps),
		jobNames: Object.fromEntries(Object.entries(jobs).map(([k, j]) => [k, j.name]))
	};
}
