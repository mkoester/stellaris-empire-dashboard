import { error } from '@sveltejs/kit';
import { combatLog, contactTable, proposalDates } from '#lib/contacts.ts';
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
	// the resolutions shown: in the community now, and in its history (named, with popups)
	const resolutions = [
		...(galcom
			? [galcom.voting, ...galcom.proposed, ...galcom.passed].flatMap((r) => r ?? [])
			: []),
		...rest.milestones.flatMap((m) => (m.galcom ? [{ type: m.galcom.resolution }] : []))
	];
	const subjects = save?.subjects ?? null;
	return {
		wars: save?.wars ?? [],
		combats: combatLog(snaps),
		claims: save?.claims ?? [],
		subjects,
		galcom,
		// when each proposal first showed up in a save: the game stores no date
		proposalDates: proposalDates(snaps),
		// the game's words for resolutions and subject terms; resolution effects as popups
		diploNames: pick(getGameData().diploNames, [
			...resolutions.flatMap((r) => [r.type, getGameData().resolutionCategories[r.type] ?? '']),
			...(subjects ?? []).flatMap((s) => [s.preset, ...Object.entries(s.terms).flat()])
		]),
		resolutionCategories: pick(
			getGameData().resolutionCategories,
			resolutions.map((r) => r.type)
		),
		explain: pick(
			getExplanations(),
			resolutions.map((r) => `resolution:${r.type}`)
		),
		...rest,
		seenAt: s?.date ?? null,
		view: contactView(),
		rows: s ? contactTable(s.relations ?? [], s.countries ?? [], s.firstContacts ?? []) : [],
		names: getGameData().identityNames,
		flagColors: getGameData().flagColors,
		nomads: (s?.diplomacy ?? []).filter((c) => c.nomadic).map((c) => c.id)
	};
}
