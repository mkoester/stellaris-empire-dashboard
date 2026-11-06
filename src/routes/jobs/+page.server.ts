import { error } from '@sveltejs/kit';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { outputModel } from '#lib/server/outputModel.ts';
import { economyOf } from '#lib/server/unitCosts.ts';

// What each unit costs us, source by source, and how well each colony works its jobs.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const { jobs } = data;
	const full = snaps.findLast((s) => s.progress !== null);
	return {
		...rest,
		output: full ? outputModel(full, data, getExplanations()) : null,
		economy: economyOf(snaps),
		jobNames: Object.fromEntries(Object.entries(jobs).map(([k, j]) => [k, j.name]))
	};
}
