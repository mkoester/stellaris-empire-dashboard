import { districtCaps, type PlanetDetailsData } from '#lib/districtCaps.ts';
import type { PlanetState } from '#lib/types.ts';
import { getExplanations, getGameData } from './app.ts';
import { pick } from './explain.ts';

/**
 * A planet's details for `PlanetDetails.svelte`: district caps, plus the popups and display names
 * its deposits, modifiers, districts and buildings need.
 */
export function planetDetails(
	planet: PlanetState,
	p: { size: number; planetClass: string; buildings: string[]; built: Record<string, number> }
): PlanetDetailsData {
	const data = getGameData();
	const caps = districtCaps(
		{ ...planet, size: p.size, habitat: p.planetClass === 'pc_habitat', buildings: p.buildings },
		p.built,
		data.capEffects
	);
	const keys = [
		...caps.types.map((t) => t.district),
		...p.buildings,
		...planet.deposits.flatMap((d) => [d.key, ...(d.swap ? [d.swap] : [])])
	];
	return {
		planet,
		caps,
		blockers: data.blockers.filter((b) => planet.deposits.some((d) => d.key === b)),
		names: Object.fromEntries(keys.filter((k) => data.names[k]).map((k) => [k, data.names[k]])),
		explain: pick(getExplanations(), [
			...planet.deposits.flatMap((d) => [
				`deposit:${d.key}`,
				...(d.swap ? [`deposit:${d.swap}`] : [])
			]),
			...planet.modifiers.map((m) => `modifier:${m.key}`)
		])
	};
}
