import { error } from '@sveltejs/kit';
import { proposalDates } from '#lib/contacts.ts';
import { facts } from '#lib/government.ts';
import { proposable } from '#lib/proposable.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { contactView } from '#lib/server/settings.ts';

// The Galactic Community: resolutions in force (by category, their effects summed), the proposal
// queue with each side's diplomatic weight, what we could propose, and its history (milestones of
// kind `galcom`).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const save = snaps.findLast((x) => x.kind === 'save');
	const galcom = save?.galcom ?? null;
	const data = getGameData();
	// what we could propose; our traditions and timed modifiers make proposing cheaper
	const costMult = save
		? [
				...(save.traditions ?? []).map((t) => `tradition:${t}`),
				...(save.countryModifiers ?? []).map((m) => `modifier:${m.key}`)
			].reduce((n, k) => n + (data.resolutionCostMult[k] ?? 0), 0)
		: 0;
	const proposals =
		save && galcom
			? proposable(
					data.resolutions,
					galcom,
					facts(save, data.scriptedTriggers),
					save.date,
					costMult
				)
			: [];
	// the resolutions shown: in the community now, in its history, and those we could propose
	const resolutions = [
		...(galcom
			? [galcom.voting, ...galcom.proposed, ...galcom.passed].flatMap((r) => r ?? [])
			: []),
		...rest.milestones.flatMap((m) => (m.galcom ? [{ type: m.galcom.resolution }] : [])),
		...proposals.flatMap((p) => [{ type: p.key }, ...(p.needs ? [{ type: p.needs }] : [])])
	];
	return {
		...rest,
		seenAt: save?.date ?? null,
		galcom,
		proposals,
		costMult,
		// when each proposal first showed up in a save: the game stores no date
		proposalDates: proposalDates(snaps),
		// the game's words for resolutions and their categories; resolution effects as popups
		diploNames: pick(data.diploNames, [
			...resolutions.flatMap((r) => [r.type, data.resolutionCategories[r.type] ?? '']),
			...proposals.map((p) => p.category)
		]),
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
