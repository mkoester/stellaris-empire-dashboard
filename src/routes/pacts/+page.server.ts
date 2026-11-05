import { error } from '@sveltejs/kit';
import { levelOf } from '#lib/diplomacy.ts';
import { techCostFactor } from '#lib/events.ts';
import { facts } from '#lib/government.ts';
import {
	commercialSplit,
	pactTypes,
	researchValue,
	speciesExchange,
	techCounts,
	techHints,
	tradeBase
} from '#lib/pacts.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { display } from '#lib/server/settings.ts';
import { inReach } from '#lib/techTiers.ts';
import { evaluate } from '#lib/triggers.ts';
import { xExtent } from '#lib/series.ts';

// What each pact gives, per type and partner (#lib/pacts.ts). What the game shows a player stays
// plain; partners' tech counts and, at economy intel 3, their trade need the `pactIntel` spoiler;
// their techs, every partner's trade and the tech hints the `pactAll` cheat. Nothing else of a
// partner leaves the server.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const latest = snaps.findLast((s) => s.budget !== null && s.relations !== null) ?? null;
	const full = snaps.findLast((s) => s.progress !== null) ?? null;
	const d = display();
	const data = getGameData();
	const none = {
		...rest,
		asOf: null as string | null,
		types: [] as ReturnType<typeof pactTypes>,
		commercial: null,
		research: null,
		migration: [] as ReturnType<typeof speciesExchange>,
		names: {} as Record<string, string>,
		pactIntel: d.pactIntel,
		pactAll: d.pactAll,
		xExtent: xExtent(snaps)
	};
	if (!latest) return none;

	const types = pactTypes(latest.relations ?? [], latest.budget ?? []);
	const partnersOf = (key: string) => types.find((t) => t.key === key)?.partners ?? [];
	const intel = new Map((latest.intel ?? []).map((i) => [i.countryId, i.intel]));
	const ai = new Map((latest.aiIntel ?? []).map((a) => [a.countryId, a]));
	const intelLevel = (id: number, category: 'economy' | 'technology') =>
		levelOf(intel.get(id) ?? 0, category);

	// commercial pacts: the booked total, split by partner where we may know its trade
	const commercialTotal =
		latest.budget?.find((s) => s.source === 'commercial_pacts')?.income.trade ?? 0;
	const commercial = partnersOf('commercial_pact').length
		? commercialSplit(
				commercialTotal,
				partnersOf('commercial_pact').map((p) => {
					const a = ai.get(p.countryId);
					const shown = d.pactAll || (d.pactIntel && intelLevel(p.countryId, 'economy') >= 3);
					return { countryId: p.countryId, base: a && shown ? tradeBase(a) : null };
				})
			)
		: null;

	// research agreements
	const progress = full?.progress ?? null;
	const researched = progress?.researched ?? [];
	const info = (key: string) => {
		const t = data.techs[key];
		return {
			cost: Math.round((t?.cost ?? 0) * techCostFactor(t?.tier ?? null, progress?.costSettings)),
			area: t?.area ?? ''
		};
	};
	const name = (key: string) => data.techs[key]?.name ?? key;
	const f = full ? facts(full, data.scriptedTriggers, { shipKinds: data.shipKinds }) : null;
	const reach = new Set(
		f ? inReach(researched, data.techs, data.techRequirements, (p) => evaluate(p, f)) : []
	);
	const monthly = Object.fromEntries(
		['physics', 'society', 'engineering'].map((a) => [a, latest.income?.[`${a}_research`] ?? 0])
	);
	const current = progress?.research ?? [];
	const research = partnersOf('research_agreement').map((p) => {
		const a = ai.get(p.countryId);
		const weLack = a?.techsWeLack ?? null;
		const theyLack = a?.techsTheyLack ?? null;
		if (weLack === null || theyLack === null)
			return { countryId: p.countryId, name: p.name, known: false as const };
		const v = researchValue(p.countryId, weLack, theyLack, info, reach, current, monthly);
		const counts =
			d.pactAll || (d.pactIntel && intelLevel(p.countryId, 'technology') >= 1)
				? techCounts(researched, weLack, theyLack, (k) => data.techs[k]?.area ?? '')
				: null;
		return {
			countryId: p.countryId,
			name: p.name,
			known: true as const,
			// shown in game: the speed bonus on the tech in progress
			thisMonth: v.thisMonth.map((m) => ({ ...m, name: name(m.tech) })),
			counts,
			...(d.pactAll && {
				ours: {
					savedInReach: v.ours.savedInReach,
					saved: v.ours.saved,
					techs: v.ours.techs.slice(0, 40).map((t) => ({ ...t, name: name(t.key) })),
					more: Math.max(0, v.ours.techs.length - 40)
				},
				theirs: v.theirs
			})
		};
	});
	const offered = new Set(Object.values(full?.techOptions ?? {}).flat());
	const hints = d.pactAll
		? techHints(
				partnersOf('research_agreement').map((p) => ({
					countryId: p.countryId,
					weLack: ai.get(p.countryId)?.techsWeLack ?? []
				})),
				offered,
				reach,
				info
			)
				.slice(0, 15)
				.map((h) => ({ ...h, name: name(h.key) }))
		: null;

	return {
		...none,
		asOf: latest.date,
		types,
		commercial: commercial && { ...commercial, total: commercialTotal },
		research: research.length
			? {
					partners: research,
					hints,
					monthly,
					current: current.map((c) => ({ ...c, name: name(c.tech) }))
				}
			: null,
		migration:
			partnersOf('migration_access').length && latest.countryId !== null
				? speciesExchange(snaps, latest.countryId)
				: [],
		names: Object.fromEntries((latest.relations ?? []).map((r) => [r.countryId, r.name]))
	};
}
