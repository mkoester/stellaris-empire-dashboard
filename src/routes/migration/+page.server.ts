import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { arkshipsOf, mapSystems, territoriesOf } from '#lib/server/mapSystems.ts';
import { migrationView } from '#lib/server/settings.ts';
import { arkshipFirstSeen, migrationFrames, migrationHistory } from '#lib/migration.ts';

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
		systems: mapSystems(snaps),
		territories: territoriesOf(snaps),
		// our arkships: on the map, and in the circle's order (oldest by the first save listing it)
		arkships: arkshipsOf(snaps),
		firstSeen: arkshipFirstSeen(snaps),
		view: migrationView()
	};
}
