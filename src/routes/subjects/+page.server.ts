import { error } from '@sveltejs/kit';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { display } from '#lib/server/settings.ts';
import { siteRows } from '#lib/branchOffices.ts';
import { xExtent } from '#lib/series.ts';
import {
	holdings,
	loyaltyFromOpinion,
	loyaltySeries,
	loyaltyTrend,
	proposalCost,
	renegotiation,
	specialist
} from '#lib/subjects.ts';

// Subjects and branch offices at the branch's latest save: our subject agreements with what each
// subject does and where its deal stands (#lib/subjects.ts), the holdings and branch offices we
// own or that sit on our colonies, and for a MegaCorp where an office would bring the most trade
// for its influence. A subject's numbers (power, fleet, size, pops) only with the
// `subjectNumbers` cheat: the game compares them only as Inferior, Equivalent or Superior.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const save = snaps.findLast((x) => x.kind === 'save');
	const subjects = save?.subjects ?? [];
	const external = save?.external ?? null;
	const relations = snaps.findLast((x) => x.relations !== null)?.relations ?? [];
	const data = getGameData();
	const d = display();
	const us = save?.countryId ?? null;
	const policyNames: Record<string, string> = Object.fromEntries(
		data.policies.flatMap((p) => [
			[p.key, p.name] as const,
			...p.options.map((o) => [o.key, o.name] as const)
		])
	);
	const details = subjects.map((s) => {
		const spec = specialist(s, data.specialists, data.defines);
		return {
			countryId: s.countryId,
			renegotiation: save ? renegotiation(s, save.date, data.defines) : null,
			proposalBase: proposalCost(0, data.defines),
			loyalty: loyaltySeries(snaps, s.countryId),
			trend: loyaltyTrend(snaps, s.countryId),
			fromOpinion: loyaltyFromOpinion(s.stance?.opinion ?? null, data.defines),
			specialist: spec,
			holdings: holdings(s, external, us),
			stance: s.stance,
			power: d.subjectNumbers ? s.power : null,
			hasPower: s.power !== null
		};
	});
	const perks = details.flatMap((x) => [
		...(x.specialist?.perks ?? []),
		...(x.specialist?.nextPerks ?? [])
	]);
	return {
		...rest,
		seenAt: save?.date ?? null,
		subjects,
		details,
		subjectNumbers: d.subjectNumbers,
		xExtent: xExtent(snaps),
		policyNames: pick(
			policyNames,
			subjects.flatMap((s) => Object.entries(s.stance?.policies ?? {}).flat())
		),
		perkNames: Object.fromEntries(perks.map((k) => [k, data.specialists.perks[k]?.name ?? k])),
		explain: pick(
			getExplanations(),
			perks.map((k) => `specialistperk:${k}`)
		),
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
