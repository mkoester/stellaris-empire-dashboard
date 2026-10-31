import { error } from '@sveltejs/kit';
import {
	anomalyKey,
	contactDone,
	firstSeen,
	mapMarkers,
	ownOnMap,
	tracked
} from '#lib/mapLayers.ts';
import { entryDetail, firstEntries } from '#lib/systemEvents.ts';
import { discovered, mapView } from '#lib/situations.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { campaignGalaxy, reveal, territoriesOf } from '#lib/server/mapSystems.ts';
import { display, mapFilter } from '#lib/server/settings.ts';
import { mergeSightings } from '#lib/territories.ts';

// The galaxy as the empire has discovered it: borders, first contacts, stations seen, anomalies,
// dig sites, special projects, wormholes, gateways, megastructures and their ruins — each a layer
// the profile's mapFilter can hide.
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const s = snaps.findLast((x) => x.firstContacts !== null);
	const g = s ? (campaignGalaxy(s.campaign)?.systems ?? []) : [];
	const contactSites = (s?.firstContacts ?? []).map((c) => c.systemId);
	const capital = snaps.findLast((x) => x.knownSystems)?.knownSystems?.find((k) => k.capital)?.id;
	// Wanderlust's targets once we have the perk; every one, revealed, with the spoiler
	const wanderlust = snaps.findLast((x) => x.wanderlust)?.wanderlust ?? null;
	const allTargets = wanderlust !== null && display().wanderlustAll;
	const spoiled = (x: (typeof g)[number]) =>
		!x.visited &&
		!x.owned &&
		((display().lgates && x.lgate) || (allTargets && (x.wanderlust?.length ?? 0) > 0));
	const entries = firstEntries(
		snaps.map((x) => ({ entries: x.entryEvents, flags: x.countryFlags }))
	);
	const entriesStart = snaps.findIndex((x) => x.entryEvents);
	// everything the branch's saves listed, the resolved with the save that first showed it so
	const saves = snaps.filter((x) => x.kind === 'save');
	const along = <T, K>(
		list: (x: (typeof saves)[number]) => T[] | null | undefined,
		key: (t: T) => K,
		isDone?: (t: T) => boolean
	) =>
		tracked(
			saves.map((x) => ({ date: x.date, list: list(x) })),
			key,
			isDone
		);
	return {
		...rest,
		seenAt: s?.date ?? null,
		filter: mapFilter(),
		// our stations and ships, for the fit buttons and the ships drawn
		own: ownOnMap(b.latest),
		wanderlust,
		systems: mapView(g, { ...reveal(), wanderlust: allTargets }, contactSites).map((x) => ({
			...x,
			capital: x.id === capital
		})),
		territories: territoriesOf(snaps),
		markers: mapMarkers({
			// what was discovered only: a marker's place is never a spoiler
			galaxy: [
				...new Map(
					[
						...discovered(g, { whole: false, stars: false }, contactSites),
						...g.filter(spoiled)
					].map((x) => [x.id, x])
				).values()
			],
			wanderlust: wanderlust && { progress: wanderlust, all: allTargets },
			// entry popups (#lib/systemEvents.ts): the start of the first one's text
			entries: entries.map((e) => ({
				...e,
				seen: { date: snaps[e.at].date, by: e.at === entriesStart },
				detail: entryDetail(data.entryEvents.find((x) => x.id === e.events[0]?.id)?.description)
			})),
			contacts: along(
				(x) => x.firstContacts,
				(c) => c.id,
				contactDone
			),
			anomalies: along((x) => x.anomalies, anomalyKey),
			digSites: along(
				(x) => x.digSites,
				(d) => d.id
			),
			projects: along(
				(x) => x.specialProjects,
				(p) => p.id
			).map((p) => ({
				...p,
				name: data.projects[p.key]?.name ?? p.key
			})),
			anomalyNames: Object.fromEntries(
				Object.entries(data.anomalyCategories).map(([k, v]) => [k, v.name])
			),
			seen: mergeSightings(snaps),
			// when the saves first show each thing, and how hard an anomaly is (its category's level)
			firstSeen: firstSeen(saves),
			anomalyLevels: Object.fromEntries(
				Object.entries(data.anomalyCategories).map(([k, v]) => [k, v.level])
			)
		}).map((m, id) => ({ ...m, id }))
	};
}
