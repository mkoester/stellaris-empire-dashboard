import { sectorColors } from '#lib/colonyTable.ts';
import { knownIds, mapView, surveyView } from '#lib/situations.ts';
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
	const g = last ? campaignGalaxy(last.campaign) : null;
	const capital = capitalId(snaps);
	if (!g) return known.map((s) => ({ ...s, capital: s.id === capital }));
	return mapView(g.systems, reveal()).map((s) => ({ ...s, capital: s.id === capital }));
}

/**
 * The capital's system for the maps' "capital" button: a nomad's capital arkship where it is now
 * (`Snapshot.arkships`, READER 41), else the system `knownSystems` marks.
 */
export function capitalId(snaps: Snapshot[]): number | undefined {
	const ark = snaps.findLast((s) => s.arkships)?.arkships?.find((a) => a.capital)?.systemId;
	return ark ?? snaps.findLast((x) => x.knownSystems)?.knownSystems?.find((k) => k.capital)?.id;
}

/** Our arkships, as the latest save that read them holds them (none for a settled empire). */
export const arkshipsOf = (snaps: Snapshot[]) => snaps.findLast((s) => s.arkships)?.arkships ?? [];

/**
 * The campaign's galaxy as the viewer may see it: bodies of the systems visited, or of all with
 * the surveyAll spoiler (`surveyView`); and the expansion and habitat lists as if surveyed.
 */
export function campaignGalaxy(campaign: string) {
	const g = galaxyOf(getDb(), campaign);
	return g ? { ...g, systems: surveyView(g.systems, display().surveyAll) } : null;
}

/** The display switches that decide what a map reveals. */
export const reveal = () => {
	const d = display();
	return {
		whole: d.wholeGalaxy,
		stars: d.unknownStars,
		wormholes: d.wormholeLinks,
		wormholePairs: d.wormholePairs,
		lgates: d.lgates
	};
};

/**
 * The empires' territories on the discovered systems, as far as the viewer may know their owners
 * (`#lib/territories.ts`; the contactStations switch names them all).
 */
export function territoriesOf(snaps: Snapshot[]): Territory[] {
	const last = snaps.findLast((s) => s.countries !== null);
	const g = last ? campaignGalaxy(last.campaign) : null;
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
