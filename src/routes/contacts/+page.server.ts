import { error } from '@sveltejs/kit';
import { contactTable } from '#lib/contacts.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { contactView } from '#lib/server/settings.ts';

// Every empire we know (relations), with what the save tells about it; filters and columns are
// the profile's contactView.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const s = snaps.findLast((x) => x.relations !== null);
	// the latest full save: the wars running and the subject agreements then
	const save = snaps.findLast((x) => x.kind === 'save');
	return {
		wars: save?.wars ?? [],
		subjects: save?.subjects ?? null,
		...rest,
		seenAt: s?.date ?? null,
		view: contactView(),
		rows: s ? contactTable(s.relations ?? [], s.countries ?? [], s.firstContacts ?? []) : [],
		names: getGameData().identityNames
	};
}
