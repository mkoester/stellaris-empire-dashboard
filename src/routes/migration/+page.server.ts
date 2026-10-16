import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { flows, migrationHistory, ownerColors } from '#lib/migration.ts';

// Migration between colonies — own and foreign — in four variants to compare.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const rows = b.snaps.findLast((s) => s.migration)?.migration ?? [];
	return {
		...rest,
		rows,
		flows: flows(rows),
		colors: ownerColors(rows),
		history: migrationHistory(snaps)
	};
}
