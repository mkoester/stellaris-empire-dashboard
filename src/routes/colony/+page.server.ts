import { error, redirect } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';

// The colony tab opens on the first colony; the colony page's dropdown picks another.
export function load({ url }) {
	const b = branch(url);
	const first = b?.latest.colonies[0];
	if (!b || !first) error(404, 'no colony yet');
	redirect(307, `/colony/${first.planetId}${url.search}`);
}
