import { error } from '@sveltejs/kit';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { traitBudget } from '#lib/species.ts';

// The species with pops in the empire: class, traits, pops, trait budget.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const species = snaps.findLast((s) => s.species !== null)?.species ?? [];
	return {
		...rest,
		species: species.map((s) => ({
			...s,
			className: data.speciesClasses[s.cls]?.name ?? s.cls,
			budget: traitBudget(s, data)
		})),
		explain: pick(
			getExplanations(),
			species.flatMap((s) => s.traits.map((t) => `trait:${t}`))
		)
	};
}
