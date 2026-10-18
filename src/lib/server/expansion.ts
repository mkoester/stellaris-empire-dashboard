import type { ExpansionRow } from '#lib/expansion.ts';
import { pretty } from '#lib/format.ts';
import type { ExpansionPlanet } from '#lib/types.ts';
import { getGameData } from './app.ts';
import { planetDetails } from './planets.ts';

/** Expansion candidates named and judged from the game data, with their planet details. */
export function expansionRows(planets: ExpansionPlanet[]): ExpansionRow[] {
	const data = getGameData();
	return planets.map((p) => ({
		...p,
		className: data.planetClasses[p.planetClass]?.name ?? pretty(p.planetClass),
		colonizable: data.planetClasses[p.planetClass]?.colonizable ?? false,
		details: p.planet
			? planetDetails(p.planet, {
					size: p.size,
					planetClass: p.planetClass,
					buildings: [],
					built: {}
				})
			: null
	}));
}
