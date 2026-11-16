import { contractMarksAt } from '#lib/server/contracts.ts';
import { error } from '@sveltejs/kit';
import { pretty } from '#lib/format.ts';
import { contactRows, gone, mapView, situationRows, stationOwners } from '#lib/situations.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { campaignGalaxy, territoriesOf } from '#lib/server/mapSystems.ts';
import { display } from '#lib/server/settings.ts';
import { outcomeTrees } from '#lib/server/outcomes.ts';
import { mergeSightings, seenRows } from '#lib/territories.ts';
import type { AnomalyInfo, DigSite, ProjectInfo } from '#lib/types.ts';

// The frontier tab (the situations tab until 2026-11-15): first contacts and stations seen,
// situations, anomalies, dig sites and special projects, at the branch's latest save that has
// them, with the first-contact map over the campaign's galaxy. What earlier saves of the branch had
// and that one no longer has follows each list, greyed (`gone()`: finished or lost).
// Outcomes and other empires' stations only with their display switches (spoilers).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const opts = display();
	const trees = outcomeTrees(data, opts);
	const s = snaps.findLast((x) => x.firstContacts !== null);
	const galaxy = s ? (campaignGalaxy(s.campaign)?.systems ?? []) : [];
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
	const territories = territoriesOf(snaps);
	const anomaly = (a: AnomalyInfo) => {
		const cat = data.anomalyCategories[a.category];
		return {
			...a,
			system: system(a.systemId),
			name: cat?.name ?? a.category,
			level: cat?.level ?? null,
			outcomes: opts.anomalySpoilers ? (cat?.outcomes ?? []) : null,
			tree: trees.anomaly(a.category)
		};
	};
	const project = (p: ProjectInfo) => {
		const info = data.projects[p.key];
		return {
			...p,
			system: system(p.systemId),
			name: info?.name ?? p.key,
			department: info?.department ?? null,
			days: info?.days ?? null,
			outcomes: opts.projectSpoilers ? (info?.outcomes ?? []) : null,
			tree: trees.project(p.key)
		};
	};
	const dig = (d: DigSite) => ({
		...d,
		system: system(d.systemId),
		name: data.digSiteTypes[d.type]?.name ?? pretty(d.type.replace(/^site_/, '')),
		stages: data.digSiteTypes[d.type]?.stages ?? null,
		tree: trees.digSite(d.type)
	});
	// each with the date of the last save that had it
	const dated =
		<T, R>(row: (t: T) => R) =>
		(t: T & { lastSeen: string }) => ({ ...row(t), lastSeen: t.lastSeen });
	return {
		...rest,
		territories,
		contractMarks: contractMarksAt(snaps, opts),
		seen: seenRows(mergeSightings(snaps), territories, system),
		seenAt: s?.date ?? null,
		opts,
		contacts: s
			? contactRows(s.firstContacts ?? [], galaxy, s.relations ?? [], s.countries ?? [], s.date)
			: [],
		// the map: every system, the contacts' places, other empires' stations if switched on
		wholeGalaxy: opts.wholeGalaxy,
		systems: mapView(
			galaxy,
			{
				whole: opts.wholeGalaxy,
				stars: opts.unknownStars,
				wormholes: opts.wormholeLinks,
				wormholePairs: opts.wormholePairs,
				lgates: opts.lgates
			},
			(s?.firstContacts ?? []).map((c) => c.systemId)
		),
		owners: opts.contactStations ? owners : [],
		situations: situationRows(s?.situations ?? [], data.situationTypes),
		anomalies: (s?.anomalies ?? []).map(anomaly),
		projects: (s?.specialProjects ?? []).map(project),
		digSites: (s?.digSites ?? []).map(dig),
		// no longer in the save: finished, or lost — kept for what they were (and their outcomes)
		gone: {
			situations: situationRows(
				gone(
					snaps,
					s,
					(x) => x.situations,
					(x) => x.id
				),
				data.situationTypes
			),
			anomalies: gone(
				snaps,
				s,
				(x) => x.anomalies,
				(a) => `${a.planetId}:${a.category}`
			).map(dated(anomaly)),
			projects: gone(
				snaps,
				s,
				(x) => x.specialProjects,
				(p) => p.id
			).map(dated(project)),
			digSites: gone(
				snaps,
				s,
				(x) => x.digSites,
				(d) => d.id
			).map(dated(dig))
		}
	};
}
