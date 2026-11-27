// The ideologies tab (4.6): our ideology and the ones we know, as the game's Ideologies view shows
// them; with the `ideologiesAll` cheat every ideology. Pure.
import type { Ideology, IdeologyReading, IdeologyStand } from './types.ts';

/** Our stand: what our ideology module holds. */
export const ownStand = (r: IdeologyReading, countryId: number | null): IdeologyStand | null =>
	r.stands.find((s) => s.countryId === countryId) ?? null;

/**
 * The ideologies we know: the keys of our module's `intel` (contact with a custodian gives 15,
 * our own 100 — throwaway 2026-11-24, docs/save-format.md), and the one we adopted.
 */
export function knownIds(r: IdeologyReading, countryId: number | null): Set<number> {
	const own = ownStand(r, countryId);
	return new Set([
		...Object.keys(own?.intel ?? {}).map(Number),
		...(own?.adopted !== null && own?.adopted !== undefined ? [own.adopted] : [])
	]);
}

/** What every page may see: our stand and the ideologies we know (`pageLatest()`). */
export function ownIdeologies(r: IdeologyReading, countryId: number | null): IdeologyReading {
	const known = knownIds(r, countryId);
	return {
		enabled: r.enabled,
		ideologies: r.ideologies.filter((i) => known.has(i.id)),
		stands: r.stands.filter((s) => s.countryId === countryId)
	};
}

/** Why the tab has nothing to show without its cheat, or null when it has. */
export function ideologiesWhy(
	r: IdeologyReading | null | undefined,
	countryId: number | null
): string | null {
	if (!r) return 'no ideology read yet';
	if (!r.enabled) return 'ideologies are off in this galaxy';
	return knownIds(r, countryId).size ? null : 'no ideology adopted or known yet';
}

/** Strength levels: the bands' starts (data DB `ideology_strength_level`, the save's `stage_durations`). */
export const LEVEL_STARTS = [0, 250, 500, 750] as const;
export const MAX_STRENGTH = 1000;

/** Progress within the current band, 0–1, and the strength the next level starts at. */
export function levelProgress(strength: number): {
	level: number;
	next: number | null;
	share: number;
} {
	const level = LEVEL_STARTS.findLastIndex((s) => strength >= s);
	const start = LEVEL_STARTS[level];
	const next = LEVEL_STARTS[level + 1] ?? null;
	const end = next ?? MAX_STRENGTH;
	return { level, next, share: Math.min(1, Math.max(0, (strength - start) / (end - start))) };
}

/** The slot a choice on offer fills: the next after those codified (tier = slot = Intensity). */
export const offeredTier = (i: Pick<Ideology, 'tenets'>, index: number): number =>
	i.tenets.length + index + 1;
