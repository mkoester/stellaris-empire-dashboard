import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { plannerPage } from '#lib/server/planner.ts';

// The planner: goals for this playthrough, per branch of the save graph (#lib/planner/*).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	return { ...rest, ...plannerPage(snaps, b.tip) };
}
