import { error, redirect } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';

// The planets tab opens on the first colony; the planet page's dropdown picks another.
export function load({ url }) {
	const b = branch(url);
	const first = b?.latest.colonies.find((c) => c.planetId >= 0);
	if (!b || !first) error(404, 'no colony yet');
	redirect(307, `/planet/${first.planetId}${url.search}`);
}
