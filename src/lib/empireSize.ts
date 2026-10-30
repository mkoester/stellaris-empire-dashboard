import type { Modifier, Snapshot } from './types.ts';

// Empire size as the game counts it before its floor — pure. The save stores `empire_size` already
// raised to EMPIRE_SIZE_FLOOR (50: "Empire Size is never treated as under this", 4.5.2 defines), so
// while the empire is smaller the save tells nothing. The parts and their weights are the defines'
// EMPIRE_SIZE_FROM_*: colonies 20, systems 1, districts 0.5, pops 0.005 (branch offices 5, not
// counted here), each scaled by its `empire_size_<part>_mult`, the total by `empire_size_mult`.
// Only the modifiers the dashboard can read count — civics, ethics, authority, origin, traditions,
// perks, techs, timed modifiers, species traits — so it is an estimate.

export type SizeParts = {
	colonies: number;
	systems: number;
	districts: number;
	pops: { pops: number; mult: number }[]; // per species, with its traits' pops modifier
};

const DEFAULTS: Record<string, number> = {
	EMPIRE_SIZE_FLOOR: 50,
	EMPIRE_SIZE_FROM_COLONIES: 20,
	EMPIRE_SIZE_FROM_SYSTEMS: 1,
	EMPIRE_SIZE_FROM_DISTRICTS: 0.5,
	EMPIRE_SIZE_FROM_POPS: 0.005
};

export const sizeFloor = (defines: Record<string, number>) =>
	defines.EMPIRE_SIZE_FLOOR ?? DEFAULTS.EMPIRE_SIZE_FLOOR;

/** The `empire_size*` modifiers summed by key (`empire_size_penalty_mult` is not about size). */
export function sizeModifiers(modifiers: Modifier[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const m of modifiers)
		if (/^(species_)?empire_size_\w*mult$/.test(m.key) && m.key !== 'empire_size_penalty_mult')
			out[m.key] = (out[m.key] ?? 0) + m.value;
	return out;
}

/** A species' own pops modifier from its traits' modifiers. */
export const speciesSizeMult = (traitModifiers: Modifier[]) => {
	const m = sizeModifiers(traitModifiers);
	return (
		(m.empire_size_pops_mult ?? 0) + (m.species_empire_size_mult ?? 0) + (m.empire_size_mult ?? 0)
	);
};

/** What the snapshot holds of the parts; null without the owned systems (older snapshots). */
export function sizeParts(s: Snapshot, speciesMult: (id: string) => number): SizeParts | null {
	if (!s.knownSystems || !s.species) return null;
	const colonies = s.colonies;
	return {
		colonies: colonies.length,
		systems: s.knownSystems.filter((k) => k.owned).length,
		districts: colonies.reduce((n, c) => n + c.districts, 0),
		pops: s.species.map((sp) => ({ pops: sp.pops, mult: speciesMult(sp.id) }))
	};
}

/** The unfloored size from its parts and the empire-wide modifiers (`sizeModifiers`). */
export function empireSizeEstimate(
	parts: SizeParts,
	mods: Record<string, number>,
	defines: Record<string, number>
): number {
	const w = (k: string) => defines[k] ?? DEFAULTS[k];
	const m = (k: string) => mods[k] ?? 0;
	const pops = parts.pops.reduce(
		(n, p) => n + p.pops * w('EMPIRE_SIZE_FROM_POPS') * (1 + m('empire_size_pops_mult') + p.mult),
		0
	);
	return (
		(parts.colonies * w('EMPIRE_SIZE_FROM_COLONIES') * (1 + m('empire_size_colonies_mult')) +
			parts.systems * w('EMPIRE_SIZE_FROM_SYSTEMS') * (1 + m('empire_size_systems_mult')) +
			parts.districts * w('EMPIRE_SIZE_FROM_DISTRICTS') * (1 + m('empire_size_districts_mult')) +
			pops) *
		(1 + m('empire_size_mult'))
	);
}
