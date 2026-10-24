import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { growthData } from '#lib/server/growth.ts';

// Pop growth per colony as measured, with what feeds the game's planet capacity, and projected.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	return { ...rest, ...growthData(snaps) };
}
