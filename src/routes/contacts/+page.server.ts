import { error } from '@sveltejs/kit';
import { combatLog, contactChanges, contactTable } from '#lib/contacts.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { setting } from '#lib/server/settings.ts';

// Every empire we know (relations), with what the save tells about it; filters and columns are
// the profile's contactView.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const s = snaps.findLast((x) => x.relations !== null);
	// the latest full save: the wars running and the subject agreements then
	const save = snaps.findLast((x) => x.kind === 'save');
	const subjects = save?.subjects ?? null;
	return {
		wars: save?.wars ?? [],
		combats: combatLog(snaps),
		claims: save?.claims ?? [],
		subjects,
		// the game's words for subject terms
		diploNames: pick(
			getGameData().diploNames,
			(subjects ?? []).flatMap((s) => [s.preset, ...Object.entries(s.terms).flat()])
		),
		...rest,
		seenAt: s?.date ?? null,
		view: setting('contactView'),
		rows: s ? contactTable(s.relations ?? [], s.countries ?? [], s.firstContacts ?? []) : [],
		// each open first contact's difficulty and clues since the previous save
		changes: contactChanges(snaps),
		names: getGameData().identityNames,
		flagColors: getGameData().flagColors,
		nomads: (s?.diplomacy ?? []).filter((c) => c.nomadic).map((c) => c.id)
	};
}
