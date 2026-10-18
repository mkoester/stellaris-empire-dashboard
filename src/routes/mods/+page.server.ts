import { error } from '@sveltejs/kit';
import { modRows, versionChanges } from '#lib/addons.ts';
import { getDb, getMods } from '#lib/server/app.ts';
import { modVersions } from '#lib/server/db.ts';
import { branch } from '#lib/server/branch.ts';

// The installed mods, which the branch's latest save has active, when that changed, and the
// updates the dashboard noticed between its starts.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const last = snaps.findLast((s) => s.mods !== null);
	return {
		...rest,
		seenAt: last?.date ?? null,
		gameVersion: last?.gameVersion ?? null,
		rows: modRows(getMods(), last?.mods ?? null, last?.gameVersion ?? null),
		changes: rest.milestones.filter((m) => m.kind === 'mod'),
		updates: versionChanges(modVersions(getDb()))
	};
}
