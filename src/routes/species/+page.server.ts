import { error } from '@sveltejs/kit';
import { getExplanations, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { pick } from '#lib/server/explain.ts';
import { traitBudget } from '#lib/species.ts';
import { facts } from '#lib/government.ts';
import { rightRows } from '#lib/rights.ts';

// The species with pops in the empire: class, traits, pops, trait budget.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const last = snaps.findLast((s) => s.species !== null);
	const species = last?.species ?? [];
	const f = last ? facts(last, data.scriptedTriggers) : null;
	return {
		...rest,
		species: species.map((s) => ({
			...s,
			className: data.speciesClasses[s.cls]?.name ?? s.cls,
			budget: traitBudget(s, data),
			rights:
				f && last?.speciesRights?.[s.id]
					? rightRows(data.speciesRights, last.speciesRights[s.id], { ...f, traits: s.traits })
					: []
		})),
		explain: pick(
			getExplanations(),
			species.flatMap((s) => s.traits.map((t) => `trait:${t}`))
		)
	};
}
