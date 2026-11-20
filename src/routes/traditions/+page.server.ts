import { error } from '@sveltejs/kit';
import { totalEffects } from '#lib/effects.ts';
import { adoptedTrees } from '#lib/traditions.ts';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { sourceWhatIfs } from '#lib/server/whatIfs.ts';
import { facts } from '#lib/government.ts';
import { evaluate } from '#lib/triggers.ts';
import { NO_SWAPS, swapExplanations, swapLookup } from '#lib/swaps.ts';

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
	const save = snaps.findLast((s) => s.kind === 'save');
	const f = save ? facts(save, data.scriptedTriggers, { shipKinds: data.shipKinds }) : null;
	// a nomad's, a gestalt's or a DLC's variant of a tradition or perk in place of the owner's
	const swaps = f ? swapLookup(data.traditionSwaps, f) : NO_SWAPS;
	const all = getExplanations();
	const explain = swapExplanations(
		pick(all, [
			...Object.values(data.traditionTrees).flatMap((t) =>
				t.traditions.map((x) => `tradition:${x.key}`)
			),
			...Object.keys(data.perks).map((k) => `perk:${k}`)
		]),
		all,
		swaps
	);
	const swapped = (id: string) => {
		const [kind, key] = id.split(':', 2);
		return `${kind}:${swaps.shown(key)}`;
	};
	// the flat modifiers summed; what has only a text (conditions, unlocks) is listed apart
	const effects = (ids: string[], kind: 'tradition' | 'perk') => {
		const parts = ids.flatMap((id) => (explain[id] ? [explain[id]] : []));
		return {
			totals: totalEffects(parts.map((e) => ({ name: e.title, modifiers: e.modifiers, kind }))),
			texts: parts
				.filter((e) => e.modifiers.length === 0 && e.text)
				.map((e) => ({ name: e.title, text: e.text! }))
		};
	};
	// ≈ what each tradition not taken in an adopted tree, each other tree's adoption and each perk
	// not ruled out would do if taken now (a spoiler switch in ⚙)
	const allowed = (key: string) => {
		const r = data.perkRules[key];
		return !f || !r || (evaluate(r.potential, f) !== false && evaluate(r.possible, f) !== false);
	};
	const whatIfs = sourceWhatIfs(
		b,
		[
			...trees.flatMap((t) => t.all.filter((x) => !x.active).map((x) => `tradition:${x.key}`)),
			...Object.entries(data.traditionTrees)
				.filter(([key]) => !taken.has(key))
				.flatMap(([, t]) =>
					t.traditions.filter((x) => x.role === 'adopt').map((x) => `tradition:${x.key}`)
				),
			...Object.keys(data.perks)
				.filter((k) => !perks.includes(k) && allowed(k))
				.map((k) => `perk:${k}`)
		],
		swapped
	);
	const named = <T extends { key: string; name: string }>(x: T): T => ({
		...x,
		name: explain[`tradition:${x.key}`]?.title ?? x.name
	});
	return {
		...rest,
		whatIfs,
		// each tradition under the name this empire's variant has (Arkship Armada for a nomad)
		trees: trees.map((t) => ({ ...t, picked: t.picked.map(named), all: t.all.map(named) })),
		otherTrees: Object.entries(data.traditionTrees)
			.filter(([key]) => !taken.has(key))
			.map(([key, t]) => ({
				key,
				name: t.name,
				color: t.color,
				// adopting it is its `adopt` tradition: the planner's goal for the tree
				adopt: t.traditions.find((x) => x.role === 'adopt')?.key ?? null
			})),
		perks: Object.entries(data.perks).map(([key, name]) => ({
			key,
			name: explain[`perk:${key}`]?.title ?? name,
			taken: perks.includes(key)
		})),
		next: rest.upcoming.find((u) => u.kind === 'tradition') ?? null,
		traditionEffects: effects(
			owned.map((k) => `tradition:${k}`),
			'tradition'
		),
		perkEffects: effects(
			perks.map((k) => `perk:${k}`),
			'perk'
		),
		explain
	};
}
