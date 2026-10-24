import { growthRows, queuedDistricts } from '#lib/growth.ts';
import type { Snapshot } from '#lib/types.ts';
import { getGameData } from './app.ts';
import { colonyDetails } from './planets.ts';

/**
 * Pop growth per colony as measured at the branch's latest save, with what feeds the game's planet
 * capacity, and the defines the projection needs (#lib/growthProjection.ts) — for the growth tab
 * and the colony page.
 */
export function growthData(snaps: Snapshot[]) {
	const latest = snaps.findLast((s) => s.kind === 'save') ?? null;
	return {
		rows: latest
			? growthRows(snaps, latest, (c) => {
					const caps = colonyDetails(c, latest)?.caps;
					if (!caps || caps.limit === null) return { free: null, blocked: null };
					return {
						free: Math.max(0, caps.limit - caps.built - queuedDistricts(c)),
						blocked: caps.limitCleared === null ? null : caps.limitCleared - caps.limit
					};
				})
			: [],
		housingKnown: latest?.colonies.some((c) => c.housing !== null) ?? false,
		growthDate: latest?.date ?? null,
		defines: Object.fromEntries(
			Object.entries(getGameData().defines).filter(([k]) => /^(LOGISTIC_|OVERCROWDING_)/.test(k))
		)
	};
}
