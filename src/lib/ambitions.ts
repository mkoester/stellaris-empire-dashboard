// The ambitions tab (4.6): our ambition, the ones the game revealed (`ambitionsRevealed`) and
// every empire's (`ambitionsAll`). Pure.
import type { AmbitionPath, AmbitionRow } from './types.ts';

/**
 * The AI personalities an ambition gives, which the diplomacy screen shows to empires that talk to
 * it (common/personalities/00_personalities.txt, `allow`; seen in game 2026-11-24: "Crisis
 * Aspirant" a month after the perk). Force of Will's only from its level 2. Defender, Behemoths and
 * Cosmogenesis have none.
 */
export const REVEALING: Record<string, string> = {
	became_the_crisis: 'nemesis_path',
	hyperthermia_empire: 'hyperthermia_path',
	utopian_missionaries: 'force_of_will_path'
};

/** Whether the game has told us of this ambition: we talk to the empire and its personality names it. */
export const isRevealed = (a: AmbitionRow, talking: Set<number>): boolean =>
	talking.has(a.countryId) && a.personality !== null && REVEALING[a.personality] === a.path;

/** The 1-based level reached, 0 before the first. */
export const levelOf = (a: Pick<AmbitionRow, 'level'>, path: AmbitionPath | undefined): number =>
	path?.levels.find((l) => l.key === a.level)?.level ?? 0;

/** Why the tab has nothing to show without a spoiler or cheat, or null when it has. */
export function ambitionsWhy(
	rows: AmbitionRow[] | null | undefined,
	countryId: number | null
): string | null {
	if (!rows) return 'no ambition read yet';
	return rows.some((a) => a.countryId === countryId) ? null : 'no ambition taken yet';
}

/** Ambition perks need more than two ascension perks first (each perk's `possible`). */
export const PERKS_BEFORE = 3;
