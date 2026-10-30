import type { Modifier, Snapshot } from './types.ts';

// Empire size as the game counts it before its floor — pure. The save stores `empire_size` already
// raised to EMPIRE_SIZE_FLOOR (50: "Empire Size is never treated as under this", 4.5.2 defines), so
// while the empire is smaller the save tells nothing. The parts and their weights are the defines'
// EMPIRE_SIZE_FROM_*: colonies 20, systems 1, districts 0.5, pops 0.005 (branch offices 5, not
// counted here), each scaled by its `empire_size_<part>_mult`, the total by `empire_size_mult`.
// Each colony's share then shrinks by its ascension tier (PLANET_ASCENSION_SPRAWL_MODIFIER −5 % a
// tier, raised by `planetary_ascension_effect_mult`) on all three parts, and by its governor
// (`species_empire_size_mult = @planet_empire_size`, −2 % a skill level) on the colony and its pops —
// the game's tooltip for Peshnab (2203.02.01: tier 1 with Ascensionists, governor skill 2, nomadic
// +100 % on colonies and districts): districts 7.5, colony 36.0, pops 24.8, i.e. 4 × 2 × 0.9375,
// 20 × 2 × 0.9375 × 0.96, 27.57 × 0.9375 × 0.96. Their sum 68.31 shows as 69: rounded up.
// Only the modifiers the dashboard can read count — civics, ethics, authority, origin, traditions,
// perks, techs, timed modifiers, species traits — so it is an estimate.

export type SizeParts = {
	colonies: { districts: number; pops: number; tier: number; governorSkill: number }[];
	systems: number;
	pops: { pops: number; mult: number }[]; // per species, with its traits' pops modifier
};

const DEFAULTS: Record<string, number> = {
	EMPIRE_SIZE_FLOOR: 50,
	EMPIRE_SIZE_FROM_COLONIES: 20,
	EMPIRE_SIZE_FROM_SYSTEMS: 1,
	EMPIRE_SIZE_FROM_DISTRICTS: 0.5,
	EMPIRE_SIZE_FROM_POPS: 0.005,
	PLANET_ASCENSION_SPRAWL_MODIFIER: -0.05 // not in the data DB's defines (4.5.2)
};

const GOVERNOR_STEP = -0.02; // @planet_empire_size, a scripted variable the data DB lacks

export const sizeFloor = (defines: Record<string, number>) =>
	defines.EMPIRE_SIZE_FLOOR ?? DEFAULTS.EMPIRE_SIZE_FLOOR;

/**
 * The `empire_size*` modifiers summed by key (`empire_size_penalty_mult` is not about size), and
 * `planetary_ascension_effect_mult`.
 */
export function sizeModifiers(modifiers: Modifier[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const m of modifiers)
		if (
			(/^(species_)?empire_size_\w*mult$/.test(m.key) && m.key !== 'empire_size_penalty_mult') ||
			m.key === 'planetary_ascension_effect_mult'
		)
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
	return {
		colonies: s.colonies.map((c) => ({
			districts: c.districts,
			pops: c.pops,
			tier: c.ascensionTier ?? 0,
			governorSkill: c.governorSkill ?? 0
		})),
		systems: s.knownSystems.filter((k) => k.owned).length,
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
	const step = w('PLANET_ASCENSION_SPRAWL_MODIFIER') * (1 + m('planetary_ascension_effect_mult'));
	const colonies = parts.colonies.map((c) => ({
		...c,
		ascension: Math.max(0, 1 + c.tier * step),
		governor: Math.max(0, 1 + c.governorSkill * GOVERNOR_STEP)
	}));
	const sum = (f: (c: (typeof colonies)[number]) => number) =>
		colonies.reduce((n, c) => n + f(c), 0);
	// the species' pops are not split by colony: they shrink by the colonies' pop-weighted factor
	const colonyPops = sum((c) => c.pops);
	const popShare = colonyPops > 0 ? sum((c) => c.pops * c.ascension * c.governor) / colonyPops : 1;
	const pops = parts.pops.reduce(
		(n, p) =>
			n +
			p.pops * w('EMPIRE_SIZE_FROM_POPS') * (1 + m('empire_size_pops_mult') + p.mult) * popShare,
		0
	);
	return (
		(sum((c) => c.ascension * c.governor) *
			w('EMPIRE_SIZE_FROM_COLONIES') *
			(1 + m('empire_size_colonies_mult')) +
			parts.systems * w('EMPIRE_SIZE_FROM_SYSTEMS') * (1 + m('empire_size_systems_mult')) +
			sum((c) => c.districts * c.ascension) *
				w('EMPIRE_SIZE_FROM_DISTRICTS') *
				(1 + m('empire_size_districts_mult')) +
			pops) *
		(1 + m('empire_size_mult'))
	);
}
