import { error } from '@sveltejs/kit';
import { councilSeats } from '#lib/government.ts';
import { leaderRoles } from '#lib/leaders.ts';
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
	const seats = s ? councilSeats(s, getGameData(), explanations) : [];
	const leaders = (s?.leaderList ?? []).map((l) => ({
		...l,
		...leaderRoles(
			l,
			seats.find((x) => x.leaderId === l.id),
			explanations
		)
	}));
	const pool = s?.leaderPool ?? [];
	return {
		...rest,
		leaders,
		pool,
		poolKnown: s?.leaderPool !== null && s?.leaderPool !== undefined,
		explain: pick(
			explanations,
			[...leaders, ...pool].flatMap((l) => (l.traits ?? []).map((t) => `ltrait:${t}`))
		)
	};
}
