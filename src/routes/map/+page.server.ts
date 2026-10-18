import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { mapSystems } from '#lib/server/mapSystems.ts';
import { migrationFrames } from '#lib/migration.ts';

// The galaxy map on its own: the known systems and the colonies with the latest month's
// migration. Shares MigrationMap with /migration for now; fork it when they diverge.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	return {
		...rest,
		frame: migrationFrames(snaps).at(-1) ?? null,
		systems: mapSystems(snaps)
	};
}
