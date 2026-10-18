import type { GameData, PlanetState } from './types.ts';

// A species' habitability on a planet, estimated as the game builds it from the files: its
// traits' `pc_<class>_habitability` (climate preferences: 80 / 60 / 20 %), or 100 % on an
// `ideal` class (Gaia, ring world, ecumenopolis …) unless a trait sets that class itself (hive
// worlds), plus `pop_environment_tolerance` from its traits (Adaptive +10 %) and from the
// planet's features and modifiers — only where the class gives it any —, at least its
// `habitability_floor_add`, within 0–100 %. Checked against the game's Expansion Planner at
// 2207.03.10: Mars 0 %, Arid / Savanna 30 %, Tundra with Atmospheric Aphrodisiac 35 %.
// Not counted: empire-wide modifiers (techs, traditions, civics) and capital bonuses — the save's
// own value, where the species lives, is exact (Earth 2207.03.10: 100 % in game, 90 % here).

export type Habitability = { value: number; exact: boolean };
type Data = Pick<GameData, 'habitability' | 'planetClasses'>;

export function estimate(
	planetClass: string,
	traits: string[],
	planet: PlanetState | null,
	data: Data
): number {
	const mods = traits.map((t) => data.habitability.traits[t] ?? {});
	const sum = (key: string) => mods.reduce((n, m) => n + (m[key] ?? 0), 0);
	const own = mods.some((m) => `${planetClass}_habitability` in m);
	const base =
		!own && data.planetClasses[planetClass]?.ideal ? 1 : sum(`${planetClass}_habitability`);
	const planetTolerance = [
		...(planet?.deposits ?? []).map((d) => data.habitability.planet[`deposit:${d.key}`] ?? 0),
		...(planet?.modifiers ?? []).map((m) => data.habitability.planet[`modifier:${m.key}`] ?? 0)
	].reduce((a, b) => a + b, 0);
	// tolerance improves a planet the species can live on, not one it cannot (Mars: 0 % in game)
	const value = Math.max(
		sum('habitability_floor_add'),
		base > 0 ? base + sum('pop_environment_tolerance') + planetTolerance : 0
	);
	return Math.min(1, Math.max(0, value));
}

/** Species habitability means anything to: those with a climate preference or similar. */
export const livesOnPlanets = (traits: string[], data: Pick<GameData, 'habitability'>) =>
	traits.some((t) =>
		Object.keys(data.habitability.traits[t] ?? {}).some((k) => k.endsWith('_habitability'))
	);

/**
 * The game's colour for it: green, yellow below `HABITABILITY_WRONG_PLANET` (0.7), red below
 * `HABITABILITY_OPPOSITE_PLANET` (0.4).
 */
export function habitabilityTier(
	value: number,
	defines: Record<string, number>
): 'good' | 'wrong' | 'opposite' {
	if (value < (defines.HABITABILITY_OPPOSITE_PLANET ?? 0.4)) return 'opposite';
	if (value < (defines.HABITABILITY_WRONG_PLANET ?? 0.7)) return 'wrong';
	return 'good';
}
export const TIER_CLASS = {
	good: 'text-green-600',
	wrong: 'text-amber-600',
	opposite: 'text-red-600'
} as const;

/** "90%", or "≈ 80%" for an estimate. */
export const habitabilityLabel = (h: Habitability) =>
	`${h.exact ? '' : '≈ '}${Math.round(h.value * 100)}%`;
