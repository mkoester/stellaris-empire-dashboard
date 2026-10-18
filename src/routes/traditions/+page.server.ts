import { error } from '@sveltejs/kit';
import { adoptedTrees } from '#lib/traditions.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';

// Traditions and ascension perks: the trees taken with their picks, the others, the perks.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const owned = snaps.findLast((s) => s.traditions !== null)?.traditions ?? [];
	const perks = snaps.findLast((s) => s.ascensionPerks !== null)?.ascensionPerks ?? [];
	const trees = adoptedTrees(owned, data);
	const taken = new Set(trees.map((t) => t.key));
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
		explain: pick(getExplanations(), [
			...Object.values(data.traditionTrees).flatMap((t) =>
				t.traditions.map((x) => `tradition:${x.key}`)
			),
			...Object.keys(data.perks).map((k) => `perk:${k}`)
		])
	};
}
