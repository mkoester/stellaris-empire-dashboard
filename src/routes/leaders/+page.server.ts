import { error } from '@sveltejs/kit';
import { councilorBonus, councilSeats } from '#lib/government.ts';
import { CLASS_SKILL, leaderLimits, leaderRoles } from '#lib/leaders.ts';
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
			councilBonus
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
					modifiers: explanations[`modifier:${key}`]?.modifiers ?? []
				}))
			)
		})),
		explain: pick(
			explanations,
			[...leaders, ...pool].flatMap((l) => (l.traits ?? []).map((t) => `ltrait:${t}`))
		)
	};
}
