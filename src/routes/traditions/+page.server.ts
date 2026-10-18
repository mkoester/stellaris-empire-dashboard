import { error } from '@sveltejs/kit';
import { totalEffects } from '#lib/effects.ts';
import { adoptedTrees } from '#lib/traditions.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';

// Traditions and ascension perks: the trees taken with every tradition (picked or not), the
// others, the perks, and what the picked ones and the perks taken add up to.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const owned = snaps.findLast((s) => s.traditions !== null)?.traditions ?? [];
	const perks = snaps.findLast((s) => s.ascensionPerks !== null)?.ascensionPerks ?? [];
	const trees = adoptedTrees(owned, data);
	const taken = new Set(trees.map((t) => t.key));
	const explain = pick(getExplanations(), [
		...Object.values(data.traditionTrees).flatMap((t) =>
			t.traditions.map((x) => `tradition:${x.key}`)
		),
		...Object.keys(data.perks).map((k) => `perk:${k}`)
	]);
	// the flat modifiers summed; what has only a text (conditions, unlocks) is listed apart
	const effects = (ids: string[]) => {
		const parts = ids.flatMap((id) => (explain[id] ? [explain[id]] : []));
		return {
			totals: totalEffects(parts.map((e) => ({ name: e.title, modifiers: e.modifiers }))),
			texts: parts
				.filter((e) => e.modifiers.length === 0 && e.text)
				.map((e) => ({ name: e.title, text: e.text! }))
		};
	};
	return {
		...rest,
		trees,
		otherTrees: Object.entries(data.traditionTrees)
			.filter(([key]) => !taken.has(key))
			.map(([key, t]) => ({ key, name: t.name })),
		perks: Object.entries(data.perks).map(([key, name]) => ({
			key,
			name,
			taken: perks.includes(key)
		})),
		next: rest.upcoming.find((u) => u.kind === 'tradition') ?? null,
		traditionEffects: effects(owned.map((k) => `tradition:${k}`)),
		perkEffects: effects(perks.map((k) => `perk:${k}`)),
		explain
	};
}
