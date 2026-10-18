import { error } from '@sveltejs/kit';
import { contactRows, mapView, situationRows, stationOwners } from '#lib/situations.ts';
import { getDb, getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { galaxyOf } from '#lib/server/db.ts';
import { display } from '#lib/server/settings.ts';

// The game's situation log: first contacts (table and map), situations, anomalies, special
// projects and dig sites, at the branch's latest save that has them, over the campaign's galaxy.
// Outcomes and other empires' stations only with their display switches (spoilers).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const opts = display();
	const s = snaps.findLast((x) => x.firstContacts !== null);
	const galaxy = s ? (galaxyOf(getDb(), s.campaign)?.systems ?? []) : [];
	const nameOf = new Map(galaxy.map((g) => [g.id, g.name]));
	const system = (id: number | null) => (id === null ? '–' : (nameOf.get(id) ?? String(id)));
	const owners = s
		? stationOwners(
				galaxy,
				s.countryId,
				s.relations ?? [],
				s.countries ?? [],
				s.firstContacts ?? []
			)
		: [];
	return {
		...rest,
		seenAt: s?.date ?? null,
		opts,
		contacts: s
			? contactRows(s.firstContacts ?? [], galaxy, s.relations ?? [], s.countries ?? [], s.date)
			: [],
		// the map: every system, the contacts' places, other empires' stations if switched on
		wholeGalaxy: opts.wholeGalaxy,
		systems: mapView(
			galaxy,
			{ whole: opts.wholeGalaxy, stars: opts.unknownStars },
			(s?.firstContacts ?? []).map((c) => c.systemId)
		),
		owners: opts.contactStations ? owners : [],
		situations: situationRows(s?.situations ?? [], data.situationTypes),
		anomalies: (s?.anomalies ?? []).map((a) => {
			const cat = data.anomalyCategories[a.category];
			return {
				...a,
				system: system(a.systemId),
				name: cat?.name ?? a.category,
				level: cat?.level ?? null,
				outcomes: opts.anomalySpoilers ? (cat?.outcomes ?? []) : null
			};
		}),
		projects: (s?.specialProjects ?? []).map((p) => {
			const info = data.projects[p.key];
			return {
				...p,
				system: system(p.systemId),
				name: info?.name ?? p.key,
				department: info?.department ?? null,
				days: info?.days ?? null,
				outcomes: opts.projectSpoilers ? (info?.outcomes ?? []) : null
			};
		}),
		digSites: (s?.digSites ?? []).map((d) => ({ ...d, system: system(d.systemId) }))
	};
}
