import type { GameData, SpeciesInfo } from './types.ts';

// The trait budget of a species: its archetype's points and picks (species_archetype) minus what
// its traits use. Traits costing 0 (the archetype's base trait, climate preference) take no pick.
// Base values only — techs such as gene modification raise them, and the save does not say by how much.

export type TraitBudget = { points: number; picks: number; maxPoints: number; maxPicks: number };

export function traitBudget(species: SpeciesInfo, data: GameData): TraitBudget | null {
	const archetype = data.archetypes[data.speciesClasses[species.cls]?.archetype ?? ''];
	if (!archetype) return null;
	const costs = species.traits.map((t) => data.traits[t]?.cost ?? 0);
	return {
		maxPoints: archetype.points,
		maxPicks: archetype.maxTraits,
		points: archetype.points - costs.reduce((a, b) => a + b, 0),
		picks: archetype.maxTraits - costs.filter((c) => c !== 0).length
	};
}
