import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';

// The event log: every milestone of the branch, searched and filtered in the page.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	// colonies ever held on this branch, for the colony filter (latest name wins)
	const colonies = new Map(snaps.flatMap((s) => s.colonies.map((c) => [c.planetId, c.name])));
	return { ...rest, colonies: [...colonies].map(([planetId, name]) => ({ planetId, name })) };
}
