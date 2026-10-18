import { profile } from '#lib/colonyProfile.ts';
import type { ExpansionRow, SpeciesChoice } from '#lib/expansion.ts';
import { pretty } from '#lib/format.ts';
import { estimate, livesOnPlanets } from '#lib/habitability.ts';
import type { ExpansionPlanet, SpeciesInfo } from '#lib/types.ts';
import { getExplanations, getGameData } from './app.ts';
import { pick } from './explain.ts';
import { planetDetails } from './planets.ts';

/**
 * The empire's species habitability applies to (a climate preference or the like), the main one —
 * the most pops — first. Pickers on the colonies and expansion tabs choose from these.
 */
export function speciesChoices(species: SpeciesInfo[]): (SpeciesChoice & { traits: string[] })[] {
	const data = getGameData();
	return species
		.filter((s) => livesOnPlanets(s.traits, data))
		.sort((a, b) => b.pops - a.pops)
		.map((s) => ({ id: s.id, name: s.name, traits: s.traits }));
}

/**
 * Expansion candidates named and judged from the game data: their planet details, the effects of
 * their features and modifiers, and their habitability for each of `species`.
 */
export function expansionRows(
	planets: ExpansionPlanet[],
	species: { id: string; traits: string[] }[]
): ExpansionRow[] {
	const data = getGameData();
	const explain = getExplanations();
	return planets.map((p) => {
		const refs = [
			...(p.planet?.deposits ?? []).map((d) => `deposit:${d.key}`),
			...(p.planet?.modifiers ?? []).map((m) => `modifier:${m.key}`)
		];
		const { pros, cons } = profile({
			colony: { designation: '', habitability: null, planet: p.planet },
			caps: null,
			hints: [],
			explain: pick(explain, refs),
			names: {}
		});
		return {
			...p,
			className: data.planetClasses[p.planetClass]?.name ?? pretty(p.planetClass),
			colonizable: data.planetClasses[p.planetClass]?.colonizable ?? false,
			details: p.planet
				? planetDetails(p.planet, {
						size: p.size,
						planetClass: p.planetClass,
						buildings: [],
						built: {}
					})
				: null,
			effects: { pros, cons },
			hab: Object.fromEntries(
				species.map((s) => [s.id, estimate(p.planetClass, s.traits, p.planet, data)])
			)
		};
	});
}
