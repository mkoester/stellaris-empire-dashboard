import type { CapEffect, GameData, PlanetState, Resources } from './types.ts';

// What clearing each blocker on the colonies would give, and what stops it. Clearing raises the
// planet's district limit by what the blocker took (1 or 2); the feature it hides is already in the
// district caps (see districtCaps.ts), so the limit is the gain. Worth most where a colony has hit
// its limit; city districts have no cap of their own, so the room is always usable.

export type BlockerHint = {
	planetId: number;
	colony: string;
	blocker: string;
	feature: string | null; // the feature it hides
	districts: number; // the planet's limit rises by this
	atLimit: boolean; // the colony cannot build another district until something is cleared
	days: number | null;
	cost: Resources;
	missing: string[]; // techs it needs that are not researched
	lodge: boolean; // natural blocker on a planet with a Ranger Lodge: cannot be cleared
	clearing: boolean; // in the build queue already
};

export function blockerHints(
	colonies: {
		planetId: number;
		name: string;
		planet: PlanetState;
		room: number | null; // districts left under the limit; null = unknown (habitats)
		buildings: string[];
		queued: string[]; // blockers in the build queue
	}[],
	info: GameData['blockerInfo'],
	effects: Record<string, CapEffect[]>,
	researched: string[]
): BlockerHint[] {
	return colonies
		.flatMap((c) =>
			c.planet.deposits
				.filter((d) => info[d.key])
				.map((d) => ({
					planetId: c.planetId,
					colony: c.name,
					blocker: d.key,
					feature: d.swap,
					districts: -(effects[`deposit:${d.key}`] ?? [])
						.filter((e) => e.key === 'planet_max_districts_add')
						.reduce((a, e) => a + e.value, 0),
					atLimit: c.room === 0,
					days: info[d.key].days,
					cost: info[d.key].cost,
					missing: info[d.key].prerequisites.filter((t) => !researched.includes(t)),
					lodge: info[d.key].natural && c.buildings.includes('building_ranger_lodge'),
					clearing: c.queued.includes(d.key)
				}))
		)
		.sort(
			(a, b) =>
				Number(a.clearing) - Number(b.clearing) ||
				Number(blocked(a)) - Number(blocked(b)) ||
				Number(b.atLimit) - Number(a.atLimit) ||
				b.districts - a.districts ||
				(a.days ?? 0) - (b.days ?? 0)
		);
}

/** Cannot be cleared now: a tech is missing or a Ranger Lodge protects it. */
export const blocked = (h: BlockerHint) => h.missing.length > 0 || h.lodge;
