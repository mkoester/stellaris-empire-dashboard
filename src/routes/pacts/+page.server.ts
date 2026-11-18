import { error } from '@sveltejs/kit';
import { levelOf } from '#lib/diplomacy.ts';
import { techCostFactor } from '#lib/events.ts';
import { facts } from '#lib/government.ts';
import {
	commercialSplit,
	ourSpeciesAbroad,
	pactTypes,
	researchValue,
	speciesExchange,
	techCounts,
	techHints,
	tradeBase
} from '#lib/pacts.ts';
import { getGameData } from '#lib/server/app.ts';
import {
	advise,
	commercialGain,
	researchGain,
	PACT_UPKEEP,
	type Other,
	type Us
} from '#lib/pactAdvice.ts';
import { valuesOf } from '#lib/server/unitCosts.ts';
import { valueOf } from '#lib/value.ts';
import { branch } from '#lib/server/branch.ts';
import { display } from '#lib/server/settings.ts';
import { researchSpeed } from '#lib/researchSpeed.ts';
import { inReach } from '#lib/techTiers.ts';
import { evaluate } from '#lib/triggers.ts';
import { xExtent } from '#lib/series.ts';

// What each pact gives, per type and partner (#lib/pacts.ts). What the game shows a player stays
// plain, and what each commercial pact brings, always (the user's ask 2026-11-17); partners' tech
// counts need the `pactIntel` spoiler, their techs and the tech hints the `pactAll` cheat. Nothing
// else of a partner leaves the server. Whom to offer a research agreement or a commercial pact
// (#lib/pactAdvice.ts) needs the `pactAdvice` spoiler: ranked by what each brings, greyed where
// the game would refuse it now; only names, the ≈ value and the reasons leave the server.
type Advice = {
	upkeep: number;
	research: AdviceRow[] | null;
	commercial: AdviceRow[] | null;
};
type AdviceRow = {
	countryId: number;
	name: string;
	gain: Record<string, number>;
	value: number;
	available: boolean;
	why: string[];
	terms: { label: string; value: number | null }[];
	total: number | null;
	accepts: boolean | null;
};

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
		abroad: [] as ReturnType<typeof ourSpeciesAbroad>,
		names: {} as Record<string, string>,
		pactIntel: d.pactIntel,
		pactAll: d.pactAll,
		pactAdvice: d.pactAdvice,
		advice: null as Advice | null,
		xExtent: xExtent(snaps)
	};
	if (!latest) return none;

	const types = pactTypes(latest.relations ?? [], latest.budget ?? []);
	const partnersOf = (key: string) => types.find((t) => t.key === key)?.partners ?? [];
	const intel = new Map((latest.intel ?? []).map((i) => [i.countryId, i.intel]));
	const ai = new Map((latest.aiIntel ?? []).map((a) => [a.countryId, a]));
	const intelLevel = (id: number, category: 'technology') => levelOf(intel.get(id) ?? 0, category);

	// commercial pacts: the booked total, split by partner
	const commercialTotal =
		latest.budget?.find((s) => s.source === 'commercial_pacts')?.income.trade ?? 0;
	const commercial = partnersOf('commercial_pact').length
		? commercialSplit(
				commercialTotal,
				partnersOf('commercial_pact').map((p) => {
					const a = ai.get(p.countryId);
					return { countryId: p.countryId, base: a ? tradeBase(a) : null };
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
	const speed = researchSpeed(snaps);
	const factor = (area: string) => speed[area]?.factor ?? 1;
	const research = partnersOf('research_agreement').map((p) => {
		const a = ai.get(p.countryId);
		const weLack = a?.techsWeLack ?? null;
		const theyLack = a?.techsTheyLack ?? null;
		if (weLack === null || theyLack === null)
			return { countryId: p.countryId, name: p.name, known: false as const };
		const v = researchValue(p.countryId, weLack, theyLack, info, reach, current, monthly, factor);
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
				info,
				factor
			)
				.slice(0, 15)
				.map((h) => ({ ...h, name: name(h.key) }))
		: null;

	// whom to offer which pact: every empire we talk to without one yet
	const advice = (() => {
		if (!d.pactAdvice || latest.countryId === null) return null;
		const ourId = latest.countryId;
		const dip = new Map((latest.diplomacy ?? []).map((c) => [c.id, c]));
		const country = new Map((latest.countries ?? []).map((c) => [c.id, c]));
		const rel = new Map((latest.relations ?? []).map((r) => [r.countryId, r]));
		const count = (id: number, flag: string) =>
			(dip.get(id)?.relations ?? []).filter(
				(r) => r.countryId !== ourId && r.agreements.includes(flag)
			).length;
		const government = latest.government ?? [];
		const sources = latest.budget ?? [];
		const us: Us = {
			civics: government,
			traditions: latest.traditions ?? [],
			perks: latest.ascensionPerks ?? [],
			megacorp: government.includes('auth_corporate'),
			subject: (dip.get(ourId)?.overlord ?? null) !== null,
			tradeBase: sources
				.filter((s) => s.source !== 'commercial_pacts')
				.reduce((n, s) => n + (s.income.trade ?? 0), 0)
		};
		const others: Other[] = (latest.aiIntel ?? []).map((a) => {
			const c = country.get(a.countryId);
			return {
				countryId: a.countryId,
				name: rel.get(a.countryId)?.name ?? c?.name ?? 'unknown empire',
				type: c?.type ?? '',
				civics: c?.civics ?? [],
				subject: (dip.get(a.countryId)?.overlord ?? null) !== null,
				ai: a,
				relation: rel.get(a.countryId) ?? null,
				pacts: {
					research: count(a.countryId, 'research_agreement'),
					commercial: count(a.countryId, 'commercial_pact')
				}
			};
		});
		const values = valuesOf(snaps);
		const worth = (r: Record<string, number>) => valueOf(r, values);
		// what current partners already speed up counts once (#lib/pacts.ts)
		const covered = new Set(
			partnersOf('research_agreement').flatMap((p) => ai.get(p.countryId)?.techsWeLack ?? [])
		);
		// what we would research next: the techs in progress and the cards on offer, else all in reach
		const upcoming = [
			...new Set([...current.map((c) => c.tech), ...Object.values(full?.techOptions ?? {}).flat()])
		];
		const next = upcoming.length ? upcoming : [...reach];
		const row = (a: ReturnType<typeof advise>) =>
			a?.map((x) => ({
				countryId: x.countryId,
				name: x.name,
				gain: x.gain,
				value: x.value,
				available: x.available,
				why: x.why,
				terms: x.acceptance.terms,
				total: x.acceptance.total,
				accepts: x.acceptance.accepts
			})) ?? null;
		return {
			upkeep: PACT_UPKEEP,
			research: progress
				? row(
						advise(
							'research',
							others,
							us,
							data,
							(o) =>
								o.ai.techsWeLack
									? researchGain(o.ai.techsWeLack, next, covered, info, monthly)
									: null,
							worth,
							PACT_UPKEEP
						)
					)
				: null,
			commercial: row(
				advise(
					'commercial',
					others,
					us,
					data,
					(o) => ({ trade: commercialGain(o.ai) }),
					worth,
					PACT_UPKEEP
				)
			)
		};
	})();

	return {
		...none,
		advice,
		asOf: latest.date,
		types,
		commercial: commercial && { ...commercial, total: commercialTotal },
		research: research.length
			? {
					partners: research,
					hints,
					monthly,
					speed,
					current: current.map((c) => ({ ...c, name: name(c.tech) }))
				}
			: null,
		migration:
			partnersOf('migration_access').length && latest.countryId !== null
				? speciesExchange(snaps, latest.countryId)
				: [],
		abroad: latest.countryId !== null ? ourSpeciesAbroad(snaps, latest.countryId) : [],
		names: Object.fromEntries((latest.relations ?? []).map((r) => [r.countryId, r.name]))
	};
}
