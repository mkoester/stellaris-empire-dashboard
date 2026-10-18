import { error } from '@sveltejs/kit';
import { branch } from '#lib/server/branch.ts';
import { colonyRows } from '#lib/server/colonies.ts';
import { colonyView } from '#lib/server/settings.ts';

// All colonies in one table: what each is good and bad at, what it makes, what needs attention.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	return {
		...colonyRows(b),
		date: b.latest.date,
		tip: b.tip,
		isHead: b.isHead,
		view: colonyView()
	};
}
