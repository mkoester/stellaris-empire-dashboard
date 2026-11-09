import { iconFor } from './icons/icons.ts';
import type { ColonyDistrict } from './types.ts';

// The colony page's district cards in two rows (the user's ask 2026-11-09): the city district
// with its first zone (the government zone) and, as a second tile, its other zones; below, the
// special districts — usually generator, mining and agriculture — including those the planet
// allows but has none of yet (from its district caps). Five tiles on a regular planet. Pure.

type Zone = ColonyDistrict['zones'][number];

export type LayoutRows = {
	city: ColonyDistrict | null; // with its first zone only
	cityZones: Zone[]; // the city district's other zones
	special: ColonyDistrict[];
};

/** The city district: the one named like a city (city, hive, nexus, housing …), else uncapped. */
function cityIndex(districts: ColonyDistrict[], caps: Record<string, number | null>): number {
	const named = districts.findIndex((d) => iconFor(d.type) === 'city');
	if (named >= 0) return named;
	return districts.findIndex((d) => caps[d.type] === null);
}

export function layoutRows(
	districts: ColonyDistrict[],
	caps: Record<string, number | null>
): LayoutRows {
	const i = cityIndex(districts, caps);
	const city = i >= 0 ? districts[i] : null;
	const rest = districts.filter((_, j) => j !== i);
	// districts the planet has room for but none built yet: shown empty, after the built ones
	const missing = Object.keys(caps)
		.filter((k) => caps[k] !== null && !districts.some((d) => d.type === k))
		.filter((k) => !city || k !== city.type)
		.map((type): ColonyDistrict => ({ type, built: 0, zones: [] }));
	return {
		city: city ? { ...city, zones: city.zones.slice(0, 1) } : null,
		cityZones: city ? city.zones.slice(1) : [],
		special: [...rest, ...missing]
	};
}
