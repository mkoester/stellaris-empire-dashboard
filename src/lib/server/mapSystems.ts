import { sectorColors } from '#lib/colonyTable.ts';
import { knownIds, mapView } from '#lib/situations.ts';
import { mergeSightings, territories, type Territory } from '#lib/territories.ts';
import type { KnownSystem, Snapshot } from '#lib/types.ts';
import { getDb, getGameData } from './app.ts';
import { galaxyOf } from './db.ts';
import { display } from './settings.ts';

/**
 * The systems a map draws (`mapView`): the discovered ones (`knownSystems`: visited or own) with
 * the lanes out of them, plus with the `unknownStars` switch every other star, or with
 * `wholeGalaxy` everything; explored wormholes with `wormholeLinks`, all with `wormholePairs`. Without a galaxy reading,
 * the snapshot's known systems.
 */
export function mapSystems(snaps: Snapshot[]): (KnownSystem & { known?: boolean })[] {
	const known = snaps.findLast((s) => s.knownSystems)?.knownSystems ?? [];
	const last = snaps.at(-1);
	const g = last ? galaxyOf(getDb(), last.campaign) : null;
	if (!g) return known;
	const capital = known.find((k) => k.capital)?.id;
	return mapView(g.systems, reveal()).map((s) => ({ ...s, capital: s.id === capital }));
}

/** The display switches that decide what a map reveals. */
export const reveal = () => {
	const d = display();
	return {
		whole: d.wholeGalaxy,
		stars: d.unknownStars,
		wormholes: d.wormholeLinks,
		wormholePairs: d.wormholePairs
	};
};

/**
 * The empires' territories on the discovered systems, as far as the viewer may know their owners
 * (`#lib/territories.ts`; the contactStations switch names them all).
 */
export function territoriesOf(snaps: Snapshot[]): Territory[] {
	const last = snaps.findLast((s) => s.countries !== null);
	const g = last ? galaxyOf(getDb(), last.campaign) : null;
	if (!last || !g) return [];
	const ids = knownIds(g.systems);
	return territories({
		galaxy: g.systems.filter((s) => ids.has(s.id)),
		ownId: last.countryId,
		ownName: last.empireName,
		countries: last.countries ?? [],
		relations: last.relations ?? [],
		seen: mergeSightings(snaps),
		flagColors: getGameData().flagColors,
		spoiler: display().contactStations,
		sectorColors: sectorColors(snaps.findLast((s) => s.colonies.length)?.colonies ?? [])
	});
}
