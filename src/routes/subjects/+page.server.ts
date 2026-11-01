import { error } from '@sveltejs/kit';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { siteRows } from '#lib/branchOffices.ts';

// Subjects and branch offices at the branch's latest save: our subject agreements, the holdings
// and branch offices we own or that sit on our colonies, and for a MegaCorp where an office would
// bring the most trade for its influence.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const save = snaps.findLast((x) => x.kind === 'save');
	const subjects = save?.subjects ?? [];
	const external = save?.external ?? null;
	const relations = snaps.findLast((x) => x.relations !== null)?.relations ?? [];
	const data = getGameData();
	return {
		...rest,
		seenAt: save?.date ?? null,
		subjects,
		external,
		megacorp: save?.branchSites !== null && save?.branchSites !== undefined,
		sites: save?.branchSites ? siteRows(save.branchSites, relations, true) : [],
		diploNames: pick(
			data.diploNames,
			subjects.flatMap((s) => [s.preset, ...Object.entries(s.terms).flat()])
		),
		buildingNames: pick(
			data.names,
			(external ?? []).flatMap((e) => e.buildings)
		)
	};
}
