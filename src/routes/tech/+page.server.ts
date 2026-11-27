import { error } from '@sveltejs/kit';
import { techOffers } from '#lib/techOffers.ts';
import { repeatableLimit } from '#lib/techCard.ts';
import { facts } from '#lib/government.ts';
import type { TreeTech } from '#lib/techTree.ts';
import type { Snapshot } from '#lib/types.ts';
import { inReach, techTiers } from '#lib/techTiers.ts';
import { evaluate } from '#lib/triggers.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch, withOptions } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { researchBonuses } from '#lib/server/researchBonuses.ts';
import { sourceWhatIfs } from '#lib/server/whatIfs.ts';

// Research: what is being researched with its due date, the cards on offer, what is done.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	// at the head, the cards the companion mod logged on the 2nd (0.13.0) count as a reading — for
	// the cards alone: it repeats the last save, which would read as no progress for rates
	const carded = rest.isHead ? withOptions(snaps, snaps.at(-1)?.campaign ?? '') : snaps;
	const techs = getGameData().techs;
	const progress = snaps.findLast((s) => s.progress !== null)?.progress ?? null;
	const latest = carded.findLast((s) => s.techOptions !== null);
	const options = latest?.techOptions ?? {};
	// progress of every queued tech; the permanent options (null: a save read before 2026-10-22)
	const queued = Object.fromEntries((latest?.techQueued ?? []).map((q) => [q.tech, q.progress]));
	const permanent = latest?.techPermanent ?? null;
	// progress kept by techs switched away from (null: a save read before READER 49)
	const kept = latest?.techKept ?? null;
	const offers = techOffers(carded).reverse();
	// stored research per field and how long it lasts: each month up to the monthly gain is used
	const stocked = snaps.findLast((s) => s.techStored !== null);
	const stored = Object.entries(stocked?.techStored ?? {})
		.filter(([, points]) => points > 0)
		.map(([area, points]) => {
			const gain = stocked?.income?.[`${area}_research`] ?? 0;
			return { area, points, months: gain > 0 ? points / gain : null };
		});
	const researched = progress?.researched ?? [];
	const onOffer = new Set(Object.values(options).flat());
	const repeatables = getGameData().repeatables ?? {};
	const tech = (key: string) => ({
		key,
		name: techs[key]?.name ?? repeatables[key]?.name ?? key,
		tier: techs[key]?.tier ?? null,
		cost: techs[key]?.cost ?? null,
		// a repeatable tech's cap: `max 5`, `∞`; null for the rest
		repeats: key in repeatables ? repeatableLimit(repeatables[key].levels).badge : null
	});
	return {
		...rest,
		// the date of the cards shown: the last save's, or the mod's 2nd of the month after it
		optionsDate: latest?.date ?? null,
		// ≈ what each card on offer would do once researched (a spoiler switch in ⚙)
		whatIfs: sourceWhatIfs(
			b,
			[...onOffer].map((k) => `tech:${k}`)
		),
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
					progress: queued[k] ?? kept?.[k] ?? null,
					kept: queued[k] === undefined && kept?.[k] !== undefined
				}))
			])
		),
		permanentKnown: permanent !== null,
		keptKnown: kept !== null,
		// every tech holding kept progress, on offer now or not: a card that may come back
		kept: Object.entries(kept ?? {})
			.filter(([k]) => !researched.includes(k))
			.map(([k, points]) => ({
				...tech(k),
				area: techs[k]?.area ?? '',
				points,
				onOffer: onOffer.has(k)
			}))
			.sort((a, b) => a.area.localeCompare(b.area) || b.points - a.points),
		stored,
		offers: offers.map((o) => ({ ...o, cards: o.cards.map(tech) })),
		researched: researched.map(tech).map((t) => ({ ...t, area: techs[t.key]?.area ?? '' })),
		tiers: techTiers(researched, techs),
		...techTree(snaps, researched),
		bonuses: researchBonuses(snaps, getGameData(), getExplanations()),
		explain: pick(
			getExplanations(),
			[
				...researched,
				...Object.values(options).flat(),
				...offers.flatMap((o) => o.cards),
				...Object.keys(kept ?? {}),
				...(progress?.research ?? []).map((r) => r.tech)
			].map((k) => `tech:${k}`)
		)
	};
}

/**
 * The tech tree's input (#lib/techTree.ts): every tech this empire can still get — one whose
 * `potential` the save rules out is left out (lists follow the playthrough, AGENTS.md), unknown
 * ones stay — and what is within reach now.
 */
function techTree(snaps: Snapshot[], researched: string[]) {
	const data = getGameData();
	const save = snaps.findLast((s) => s.kind === 'save');
	const f = save ? facts(save, data.scriptedTriggers, { shipKinds: data.shipKinds }) : null;
	const possible = (p: Parameters<typeof evaluate>[0]) => (f ? evaluate(p, f) : null);
	const done = new Set(researched);
	const tree: TreeTech[] = Object.entries(data.techs).flatMap(([key, t]) => {
		const req = data.techRequirements[key];
		if (!done.has(key) && req && possible(req.potential) === false) return [];
		return [
			{
				key,
				name: t.name,
				area: t.area,
				tier: t.tier,
				cost: t.cost,
				category: t.category ?? null,
				rare: req?.rare ?? t.rare ?? false,
				dangerous: req?.dangerous ?? false,
				needs: req?.prerequisites ?? [],
				anyOf: req?.anyOf ?? []
			}
		];
	});
	return {
		tree,
		reach: inReach(researched, data.techs, data.techRequirements, possible)
	};
}
