import { error } from '@sveltejs/kit';
import { firstSeen, mapMarkers } from '#lib/mapLayers.ts';
import { entryDetail, firstEntries } from '#lib/systemEvents.ts';
import { discovered, mapView } from '#lib/situations.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { campaignGalaxy, reveal, territoriesOf } from '#lib/server/mapSystems.ts';
import { display, mapFilter } from '#lib/server/settings.ts';
import { mergeSightings } from '#lib/territories.ts';
import { plannedSystems } from '#lib/server/planner.ts';

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
	return {
		...rest,
		seenAt: s?.date ?? null,
		filter: mapFilter(),
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
			contacts: s?.firstContacts ?? [],
			anomalies: s?.anomalies ?? [],
			digSites: s?.digSites ?? [],
			projects: (s?.specialProjects ?? []).map((p) => ({
				...p,
				name: data.projects[p.key]?.name ?? p.key
			})),
			anomalyNames: Object.fromEntries(
				Object.entries(data.anomalyCategories).map(([k, v]) => [k, v.name])
			),
			seen: mergeSightings(snaps),
			// when the saves first show each thing, and how hard an anomaly is (its category's level)
			firstSeen: firstSeen(snaps.filter((x) => x.kind === 'save')),
			anomalyLevels: Object.fromEntries(
				Object.entries(data.anomalyCategories).map(([k, v]) => [k, v.level])
			)
		})
			.concat(
				// the planner's goals at this node, one marker per system
				Object.entries(plannedSystems(snaps, b.tip)).map(([id, goals]) => ({
					layer: 'planned' as const,
					systemId: Number(id),
					label: goals.join('; '),
					detail: `${goals.length} goal${goals.length === 1 ? '' : 's'} in the planner`
				}))
			)
			.map((m, id) => ({ ...m, id }))
	};
}
