import { error } from '@sveltejs/kit';
import { focusView } from '#lib/focus.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';

// The empire focus: the cards to do, and per category the next reward (research options).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const s = snaps.findLast((x) => x.focus !== null);
	const view = s?.focus ? focusView(s.focus, getGameData().focus) : null;
	const techs = view?.rewards.flatMap((r) => [...r.techs, ...(r.next?.techs ?? [])]) ?? [];
	const names = getGameData().techs;
	return {
		...rest,
		seenAt: s?.date ?? null,
		view,
		techNames: Object.fromEntries(techs.map((t) => [t, names[t]?.name ?? t])),
		explain: pick(
			getExplanations(),
			techs.map((t) => `tech:${t}`)
		)
	};
}
