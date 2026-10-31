import { error } from '@sveltejs/kit';
import { councilorBonus, councilSeats, facts } from '#lib/government.ts';
import {
	baseLeaderCost,
	CLASS_SKILL,
	leaderCostFactors,
	leaderLimits,
	leaderRoles,
	leaderUpkeep,
	skillModifiers,
	traitRoles,
	upkeepFactors
} from '#lib/leaders.ts';
import { leaderSources } from '#lib/leaderSources.ts';
import type { LeaderInfo } from '#lib/types.ts';
import { empireHeld } from '#lib/wellbeingLevers.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';

// Every hired leader: class, level, age, traits, what it holds (with the level it acts at there)
// and what that gives; and the recruitable pool.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const s = snaps.findLast((x) => x.leaderList !== null);
	const explanations = getExplanations();
	const data = getGameData();
	const seats = s ? councilSeats(s, data, explanations) : [];
	// what the save tells for the traits' conditions (gestalt, nomadic …)
	const f = s
		? facts(s, data.scriptedTriggers, {
				electionTypes: data.electionTypes,
				archetypes: data.speciesArchetypes,
				slavery: data.speciesRights.flatMap((k) =>
					k.options.filter((o) => o.isSlavery).map((o) => o.key)
				)
			})
		: null;
	// the country's councilor bonus: what a leader not seated would act at on the council
	const councilBonus = s
		? councilorBonus(s, data.councilorSkill).reduce((n, b) => n + b.value, 0)
		: 0;
	const withRoles = (s?.leaderList ?? []).map((l) => ({
		...l,
		...leaderRoles(
			l,
			seats.find((x) => x.leaderId === l.id),
			explanations,
			councilBonus,
			f
		)
	}));
	// a leader's own upkeep modifier: its traits' on itself (conditions already weighed)
	const own = (self: { modifiers: { key: string; value: number }[] }[]) =>
		self
			.flatMap((b) => b.modifiers)
			.reduce((n, m) => n + (m.key === 'leaders_upkeep_mult' ? m.value : 0), 0);
	const factors = upkeepFactors(
		withRoles.map((l) => ({ class: l.class, level: l.level, own: own(l.self) })),
		s?.budget ?? null
	);
	// a class without hired leaders has no budget line: the others' factor (empire-wide modifiers)
	const known = Object.values(factors).filter((x): x is number => x !== null);
	const factorOf = (cls: string) =>
		factors[cls] ?? (known.length ? known.reduce((a, b) => a + b, 0) / known.length : null);
	const upkeep = (l: { class: string; level?: number }, ownMult: number) => {
		const fct = factorOf(l.class);
		return fct === null || l.level === undefined ? null : leaderUpkeep(l.level, fct, ownMult);
	};
	const leaders = withRoles.map((l) => ({ ...l, upkeep: upkeep(l, own(l.self)) }));
	const costs = s ? leaderCostFactors(s, data.leaderCost, seats) : null;
	// what acts on leaders besides their traits: traditions, perks, civics, techs, …
	const sources = s ? leaderSources(explanations, empireHeld(s), f) : [];
	const pool = (s?.leaderPool ?? []).map((p) => {
		// its traits on itself, as if hired
		const self = p.traits
			? leaderRoles({ ...p, traits: p.traits } as LeaderInfo, undefined, explanations, 0, f).self
			: [];
		return {
			...p,
			upkeep: upkeep(p, own(self)),
			cost:
				costs && p.level !== undefined
					? Math.round(baseLeaderCost(p.level) * (costs[p.class] ?? 1))
					: null
		};
	});
	return {
		...rest,
		leaders,
		pool,
		poolKnown: s?.leaderPool !== null && s?.leaderPool !== undefined,
		limits: s ? leaderLimits(s, data.leaderCap) : null,
		// what each class gives per skill level, by role
		classSkill: Object.entries(CLASS_SKILL).map(([cls, roles]) => ({
			cls,
			roles: Object.entries(roles).flatMap(([role, parts]) =>
				parts.map(([where, key]) => ({
					role: where ? `${role}: ${where}` : role,
					modifiers: skillModifiers(key, explanations)
				}))
			)
		})),
		// per class and trait, the roles it acts in (badges)
		traitRoles: Object.fromEntries(
			[...leaders, ...pool].flatMap((l) =>
				(l.traits ?? []).map((t) => [`${l.class}:${t}`, traitRoles(t, l.class, explanations)])
			)
		),
		sources,
		explain: pick(explanations, [
			...[...leaders, ...pool].flatMap((l) => (l.traits ?? []).map((t) => `ltrait:${t}`)),
			...sources.flatMap((r) => r.sources.map((x) => x.ref))
		])
	};
}
