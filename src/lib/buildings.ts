import type { ColonyDistrict } from './types.ts';

// A building the player disabled (`buildings.<id>.disabled=yes`, 4.5.2) stays in its slot but
// does nothing: disabling the arkship's Holo Theatres (2201.05.01) removed its Entertainer jobs
// and 3,695 amenities. Whatever reads a colony's buildings for their effects takes the active
// ones; what asks whether one exists (built before, a Ranger Lodge, popups) takes them all. Pure.

type Zone = ColonyDistrict['zones'][number];

/** A zone's buildings that work: those built, each disabled one taken out once. */
export function activeBuildings(z: Zone): string[] {
	const off = [...(z.disabled ?? [])];
	return z.buildings.filter((b) => {
		const i = off.indexOf(b);
		if (i < 0) return true;
		off.splice(i, 1);
		return false;
	});
}

/** A colony's working buildings, over all its districts' zones. */
export const colonyActiveBuildings = (districts: ColonyDistrict[]): string[] =>
	districts.flatMap((d) => d.zones.flatMap(activeBuildings));
