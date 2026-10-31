import { error } from '@sveltejs/kit';
import { councilorBonus, councilSeats, facts } from '#lib/government.ts';
import { CLASS_SKILL, leaderLimits, leaderRoles, skillModifiers } from '#lib/leaders.ts';
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
				slavery: data.speciesRights.flatMap((k) =>
					k.options.filter((o) => o.isSlavery).map((o) => o.key)
				)
			})
		: null;
	// the country's councilor bonus: what a leader not seated would act at on the council
	const councilBonus = s
		? councilorBonus(s, data.councilorSkill).reduce((n, b) => n + b.value, 0)
		: 0;
	const leaders = (s?.leaderList ?? []).map((l) => ({
		...l,
		...leaderRoles(
			l,
			seats.find((x) => x.leaderId === l.id),
			explanations,
			councilBonus,
			f
		)
	}));
	const pool = s?.leaderPool ?? [];
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
		explain: pick(
			explanations,
			[...leaders, ...pool].flatMap((l) => (l.traits ?? []).map((t) => `ltrait:${t}`))
		)
	};
}
