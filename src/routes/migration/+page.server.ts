import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { migrationFrames, migrationHistory } from '#lib/migration.ts';

// Migration between colonies — own and treaty partners' — in four variants to compare. The flow
// diagram and the map step through `frames` (one per month with data); bars and matrix show the
// whole history.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	return {
		...rest,
		frames: migrationFrames(snaps),
		history: migrationHistory(snaps),
		// the map's background: the latest known systems and hyperlanes
		systems: snaps.findLast((s) => s.knownSystems)?.knownSystems ?? []
	};
}
