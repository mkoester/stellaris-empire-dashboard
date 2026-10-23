import { error } from '@sveltejs/kit';
import { proposalDates } from '#lib/contacts.ts';
import { diploWeight } from '#lib/diploWeight.ts';
import { facts } from '#lib/government.ts';
import { proposable } from '#lib/proposable.ts';
import type { Facts } from '#lib/triggers.ts';
import type { CountryInfo } from '#lib/types.ts';
import { actualOutlook, outlook } from '#lib/votes.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { contactView } from '#lib/server/settings.ts';

/**
 * What the save tells about another empire, for the conditions of its AI's vote: its identity;
 * the rest (flags, traditions, techs) is unknown.
 */
function aiFacts(c: CountryInfo, nomadic: boolean): Facts {
	return {
		countryType: c.type,
		government: [...c.ethics, ...c.civics, ...(c.authority ? [c.authority] : [])],
		origin: c.origin,
		governmentType: c.governmentType,
		dlcs: null,
		policyFlags: null,
		countryFlags: null,
		traditions: null,
		perks: null,
		techs: null,
		atWar: null,
		situations: null,
		nomadic
	} as unknown as Facts;
}

/** Pops-weighted happiness over the colonies that report it. */
function happinessOf(colonies: { pops: number; happiness: number | null }[]): number | null {
	const known = colonies.filter((c) => c.happiness !== null);
	const pops = known.reduce((n, c) => n + c.pops, 0);
	return pops ? known.reduce((n, c) => n + c.pops * (c.happiness ?? 0), 0) / pops : null;
}

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
	// our diplomatic weight, part by part as the game's tooltip: every modifier source we hold
	const explanations = getExplanations();
	const weight =
		save && galcom && save.score
			? diploWeight(
					{
						military: save.score.military,
						economy: save.score.economy,
						tech: save.score.tech,
						pops: save.colonies.reduce((n, c) => n + c.pops, 0),
						happiness: happinessOf(save.colonies)
					},
					[
						...galcom.passed.map((r) => `resolution:${r.type}`),
						...(save.traditions ?? []).map((t) => `tradition:${t}`),
						...(save.ascensionPerks ?? []).map((p) => `perk:${p}`),
						...(save.government ?? []).flatMap((k) => [
							`civic:${k}`,
							`ethic:${k}`,
							`authority:${k}`
						]),
						...(save.origin ? [`origin:${save.origin}`] : []),
						...Object.values(save.policies ?? {}).map((o) => `policy:${o}`),
						...(save.edicts ?? []).map((e) => `edict:${e}`),
						...(save.countryModifiers ?? []).map((m) => `modifier:${m.key}`)
					].flatMap((k) => {
						const e = explanations[k];
						return e ? [{ name: e.title, modifiers: e.modifiers }] : [];
					}),
					galcom.weights[save.countries?.find((c) => c.id === save.countryId)?.name ?? '']?.value ??
						null
				)
			: null;
	// how each resolution we could propose now would fare: every AI member's vote
	const ourName = save?.countries?.find((c) => c.id === save.countryId)?.name ?? '';
	const byName = new Map((save?.countries ?? []).map((c) => [c.name, c]));
	const opinion = new Map((save?.aiIntel ?? []).map((a) => [a.countryId, a.opinion]));
	const nomads = new Set((save?.diplomacy ?? []).filter((c) => c.nomadic).map((c) => c.id));
	const members = (galcom?.members ?? []).flatMap((name) => {
		const c = byName.get(name);
		return name === ourName || !c
			? []
			: [
					{
						name,
						weight: galcom?.weights[name]?.value ?? 0,
						facts: aiFacts(c, nomads.has(c.id)),
						opinionOfUs: opinion.get(c.id) ?? null
					}
				];
	});
	// predicted for what we could propose; from the votes cast for what is in the queue
	const queued = galcom ? [...(galcom.voting ? [galcom.voting] : []), ...galcom.proposed] : [];
	const outlooks = Object.fromEntries(
		proposals.flatMap((p) => {
			if (p.status === 'proposable')
				return [
					[
						p.key,
						outlook(data.resolutions[p.key].aiWeight, members, galcom?.weights[ourName]?.value ?? 0)
					]
				];
			const q = p.status === 'proposed' ? queued.find((x) => x.type === p.key) : undefined;
			return q && galcom
				? [[p.key, actualOutlook(q, galcom.weights, galcom.members, ourName)]]
				: [];
		})
	);
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
		weight,
		outlooks,
		// when each proposal first showed up in a save: the game stores no date
		proposalDates: proposalDates(snaps),
		// the game's words for resolutions and their categories; resolution effects as popups
		diploNames: pick(data.diploNames, [
			...resolutions.flatMap((r) => [r.type, data.resolutionCategories[r.type] ?? '']),
			...proposals.map((p) => p.category)
		]),
		resolutionGroups: pick(data.resolutionGroups, [
			...resolutions.map((r) => data.resolutionCategories[r.type] ?? ''),
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
