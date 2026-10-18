import { error } from '@sveltejs/kit';
import { getExplanations } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';

// Every hired leader: class, level, age, traits, job and council seat.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const leaders = snaps.findLast((s) => s.leaderList !== null)?.leaderList ?? [];
	return {
		...rest,
		leaders,
		explain: pick(
			getExplanations(),
			leaders.flatMap((l) => l.traits.map((t) => `ltrait:${t}`))
		)
	};
}
