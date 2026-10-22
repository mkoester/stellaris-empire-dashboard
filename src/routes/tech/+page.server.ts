import { error } from '@sveltejs/kit';
import { techOffers } from '#lib/techOffers.ts';
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
	const latest = snaps.findLast((s) => s.techOptions !== null);
	const options = latest?.techOptions ?? {};
	// progress of every queued tech; the permanent options (null: a save read before 2026-10-22)
	const queued = Object.fromEntries((latest?.techQueued ?? []).map((q) => [q.tech, q.progress]));
	const permanent = latest?.techPermanent ?? null;
	const offers = techOffers(snaps).reverse();
	// stored research per field and how long it lasts: each month up to the monthly gain is used
	const stocked = snaps.findLast((s) => s.techStored !== null);
	const stored = Object.entries(stocked?.techStored ?? {})
		.filter(([, points]) => points > 0)
		.map(([area, points]) => {
			const gain = stocked?.income?.[`${area}_research`] ?? 0;
			return { area, points, months: gain > 0 ? points / gain : null };
		});
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
			Object.entries(options).map(([area, list]) => [
				area,
				list.map((k) => ({
					...tech(k),
					researching: (progress?.research ?? []).some((r) => r.tech === k),
					permanent: permanent?.includes(k) ?? false,
					progress: queued[k] ?? null
				}))
			])
		),
		permanentKnown: permanent !== null,
		stored,
		offers: offers.map((o) => ({ ...o, cards: o.cards.map(tech) })),
		researched: researched.map(tech).map((t) => ({ ...t, area: techs[t.key]?.area ?? '' })),
		tiers: techTiers(researched, techs),
		explain: pick(
			getExplanations(),
			[
				...researched,
				...Object.values(options).flat(),
				...offers.flatMap((o) => o.cards),
				...(progress?.research ?? []).map((r) => r.tech)
			].map((k) => `tech:${k}`)
		)
	};
}
