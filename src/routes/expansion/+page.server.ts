import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { expansionRows } from '#lib/server/expansion.ts';
import { expansionView } from '#lib/server/settings.ts';

// Where to expand next: surveyed planets nobody owns, within a chosen range of the borders.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	// the latest full save that read the candidates (the mod's lines carry none)
	const s = b.snaps.findLast((x) => x.expansion !== null);
	return {
		planets: expansionRows(s?.expansion ?? []),
		date: s?.date ?? b.latest.date,
		isHead: b.isHead,
		view: expansionView()
	};
}
