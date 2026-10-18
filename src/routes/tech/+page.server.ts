import { error } from '@sveltejs/kit';
import { techTiers } from '#lib/techTiers.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';

// Research: what is being researched with its due date, the cards on offer, what is done.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const techs = getGameData().techs;
	const progress = snaps.findLast((s) => s.progress !== null)?.progress ?? null;
	const options = snaps.findLast((s) => s.techOptions !== null)?.techOptions ?? {};
	const researched = progress?.researched ?? [];
	const tech = (key: string) => ({
		key,
		name: techs[key]?.name ?? key,
		tier: techs[key]?.tier ?? null,
		cost: techs[key]?.cost ?? null
	});
	return {
		...rest,
		queues: (progress?.research ?? []).map((r) => ({
			...tech(r.tech),
			area: r.area,
			progress: r.progress,
			due: rest.upcoming.find((u) => u.ref === `tech:${r.tech}`) ?? null
		})),
		options: Object.fromEntries(
			Object.entries(options).map(([area, list]) => [area, list.map(tech)])
		),
		researched: researched.map(tech).map((t) => ({ ...t, area: techs[t.key]?.area ?? '' })),
		tiers: techTiers(researched, techs),
		explain: pick(
			getExplanations(),
			[
				...researched,
				...Object.values(options).flat(),
				...(progress?.research ?? []).map((r) => r.tech)
			].map((k) => `tech:${k}`)
		)
	};
}
