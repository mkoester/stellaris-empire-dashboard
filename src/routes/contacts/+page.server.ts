import { error } from '@sveltejs/kit';
import { contactTable } from '#lib/contacts.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
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
	const galcom = save?.galcom ?? null;
	const resolutions = galcom ? [galcom.voting, ...galcom.proposed].flatMap((r) => r ?? []) : [];
	const subjects = save?.subjects ?? null;
	return {
		wars: save?.wars ?? [],
		subjects,
		galcom,
		// the game's words for resolutions and subject terms; resolution effects as popups
		diploNames: pick(getGameData().diploNames, [
			...resolutions.map((r) => r.type),
			...(subjects ?? []).flatMap((s) => [s.preset, ...Object.entries(s.terms).flat()])
		]),
		explain: pick(
			getExplanations(),
			resolutions.map((r) => `resolution:${r.type}`)
		),
		...rest,
		seenAt: s?.date ?? null,
		view: contactView(),
		rows: s ? contactTable(s.relations ?? [], s.countries ?? [], s.firstContacts ?? []) : [],
		names: getGameData().identityNames
	};
}
