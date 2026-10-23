import { error } from '@sveltejs/kit';
import { proposalDates } from '#lib/contacts.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { contactView } from '#lib/server/settings.ts';

// The Galactic Community: resolutions in force (by category, their effects summed), the proposal
// queue with each side's diplomatic weight, and its history (milestones of kind `galcom`).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const save = snaps.findLast((x) => x.kind === 'save');
	const galcom = save?.galcom ?? null;
	// the resolutions shown: in the community now, and in its history (named, with popups)
	const resolutions = [
		...(galcom
			? [galcom.voting, ...galcom.proposed, ...galcom.passed].flatMap((r) => r ?? [])
			: []),
		...rest.milestones.flatMap((m) => (m.galcom ? [{ type: m.galcom.resolution }] : []))
	];
	const data = getGameData();
	return {
		...rest,
		seenAt: save?.date ?? null,
		galcom,
		// when each proposal first showed up in a save: the game stores no date
		proposalDates: proposalDates(snaps),
		// the game's words for resolutions and their categories; resolution effects as popups
		diploNames: pick(
			data.diploNames,
			resolutions.flatMap((r) => [r.type, data.resolutionCategories[r.type] ?? ''])
		),
		resolutionCategories: pick(
			data.resolutionCategories,
			resolutions.map((r) => r.type)
		),
		explain: pick(
			getExplanations(),
			resolutions.map((r) => `resolution:${r.type}`)
		),
		view: contactView()
	};
}
