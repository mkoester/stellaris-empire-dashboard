import type { GameData } from './types.ts';

// Researched techs per field and tier. A tier opens once 6 techs of the tier below are researched
// (`previously_unlocked = 6` for tiers 2–5, 0 for tier 1: common/technology/tier/00_tier.txt,
// 4.5.2); per field, as the wiki says and research alternatives show. Totals are the techs the
// game files define — not every empire can get all of them (DLC, civics, events).

export const TIERS = [0, 1, 2, 3, 4, 5];
export const AREAS = ['physics', 'society', 'engineering'];
const PREVIOUSLY_UNLOCKED = 6;

export type TierCell = { done: number; total: number; open: boolean; needs: number };

export function techTiers(
	researched: string[],
	techs: GameData['techs']
): Record<string, TierCell[]> {
	const count = (area: string, tier: number, keys: string[]) =>
		keys.filter((k) => techs[k]?.area === area && techs[k]?.tier === tier).length;
	const all = Object.keys(techs);
	return Object.fromEntries(
		AREAS.map((area) => [
			area,
			TIERS.map((tier) => {
				const below = tier <= 1 ? PREVIOUSLY_UNLOCKED : count(area, tier - 1, researched);
				return {
					done: count(area, tier, researched),
					total: count(area, tier, all),
					open: below >= PREVIOUSLY_UNLOCKED,
					needs: Math.max(PREVIOUSLY_UNLOCKED - below, 0)
				};
			})
		])
	);
}

/**
 * Techs within reach: not researched, every prerequisite researched, their tier open in their
 * field, and not ruled out for this empire (`potential` false; unknown counts as possible — the
 * save cannot answer every condition). Rare and dangerous ones included: they are within reach
 * too, only offered less often.
 */
export function inReach(
	researched: string[],
	techs: GameData['techs'],
	requirements: GameData['techRequirements'],
	possible: (
		potential: NonNullable<GameData['techRequirements'][string]>['potential']
	) => boolean | null
): string[] {
	const done = new Set(researched);
	const tiers = techTiers(researched, techs);
	return Object.keys(techs)
		.filter((k) => {
			const t = techs[k];
			const req = requirements[k];
			return (
				!done.has(k) &&
				req !== undefined &&
				req.prerequisites.every((p) => done.has(p)) &&
				(t.tier === null || tiers[t.area]?.[t.tier]?.open !== false) &&
				possible(req.potential) !== false
			);
		})
		.sort();
}
