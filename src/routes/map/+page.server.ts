import { error } from '@sveltejs/kit';
import { mapMarkers } from '#lib/mapLayers.ts';
import { discovered, mapView } from '#lib/situations.ts';
import { getDb, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { galaxyOf } from '#lib/server/db.ts';
import { reveal, territoriesOf } from '#lib/server/mapSystems.ts';
import { mapFilter } from '#lib/server/settings.ts';
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
	const g = s ? (galaxyOf(getDb(), s.campaign)?.systems ?? []) : [];
	const contactSites = (s?.firstContacts ?? []).map((c) => c.systemId);
	const capital = snaps.findLast((x) => x.knownSystems)?.knownSystems?.find((k) => k.capital)?.id;
	return {
		...rest,
		seenAt: s?.date ?? null,
		filter: mapFilter(),
		systems: mapView(g, reveal(), contactSites).map((x) => ({
			...x,
			capital: x.id === capital
		})),
		territories: territoriesOf(snaps),
		markers: mapMarkers({
			// what was discovered only: a marker's place is never a spoiler
			galaxy: discovered(g, { whole: false, stars: false }, contactSites),
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
			seen: mergeSightings(snaps)
		}).map((m, id) => ({ ...m, id }))
	};
}
