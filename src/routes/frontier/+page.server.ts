import { contractMarksAt } from '#lib/server/contracts.ts';
import { error } from '@sveltejs/kit';
import { pretty } from '#lib/format.ts';
import { contactRows, gone, mapView, situationRows, stationOwners } from '#lib/situations.ts';
import { getGameData } from '#lib/server/app.ts';
import { branch } from '#lib/server/branch.ts';
import { campaignGalaxy, territoriesOf } from '#lib/server/mapSystems.ts';
import { display } from '#lib/server/settings.ts';
import { outcomeNow, outcomeTrees } from '#lib/server/outcomes.ts';
import { planSummary } from '#lib/server/planner.ts';
import { valuesOf } from '#lib/server/unitCosts.ts';
import { facts } from '#lib/government.ts';
import { gainRows, type GainRow, type GainSource } from '#lib/outcomeGains.ts';
import { digDays, researchDays, type Time } from '#lib/frontierTime.ts';
import { anomalyDays } from '#lib/ships.ts';
import { techCost } from '#lib/events.ts';
import { nowTable, prune, resolve, type OutcomeNode } from '#lib/outcomes.ts';
import { mergeSightings, seenRows } from '#lib/territories.ts';
import { inferDone, uniqueMarks, type Evidence } from '#lib/inferDone.ts';
import type { AnomalyInfo, DigSite, ProjectInfo } from '#lib/types.ts';

// The frontier tab (the situations tab until 2026-11-15): first contacts and stations seen,
// situations, anomalies, dig sites and special projects, at the branch's latest save that has
// them, with the first-contact map over the campaign's galaxy. What earlier saves of the branch had
// and that one no longer has follows each list, greyed (`gone()`: finished or lost).
// Outcomes and other empires' stations only with their display switches (spoilers). Outcomes are
// read against the empire (`resolve()`: what it cannot get greyed), and what the open ones can
// still bring is summed (`gainRows()`, "Still to gain"). A gone anomaly, project or dig site is
// marked finished where the save has an effect only it gives (`inferDone()`).
export function load({ url }) {
	const b = branch(url);
	if (!b) error(404, 'no save yet');
	const { snaps, ...rest } = b;
	const data = getGameData();
	const opts = display();
	const trees = outcomeTrees(data, opts);
	const save = snaps.findLast((x) => x.kind === 'save') ?? null;
	const f = save ? facts(save, data.scriptedTriggers, { shipKinds: data.shipKinds }) : null;
	const read = (tree: OutcomeNode[] | null) =>
		tree && f ? resolve(tree, f, data.identityNames) : tree;
	// nothing this empire can get from it: greyed in its table
	const closed = (tree: OutcomeNode[] | null) => !!tree?.length && !prune(tree).length;
	const values = valuesOf(snaps);
	// how long each takes, before speed bonuses: with our best scientist on a science ship
	const sci = Math.max(
		...(save?.civilianShips ?? [])
			.filter((c) => c.kind === 'science_ship' && c.leaderLevel !== null)
			.map((c) => c.leaderLevel!),
		-Infinity
	);
	const scientist = Number.isFinite(sci) ? sci : null;
	const withScientist = `your best scientist on a science ship (level ${scientist ?? '?'}), before speed bonuses`;
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
		const tree = read(trees.anomaly(a.category));
		return {
			closed: closed(tree),
			...a,
			system: system(a.systemId),
			name: cat?.name ?? a.category,
			level: cat?.level ?? null,
			time:
				cat?.level != null && scientist !== null
					? ({
							days: anomalyDays(cat.level, scientist),
							approx: false,
							note: `level ${cat.level} anomaly, ${withScientist}`
						} satisfies Time)
					: null,
			outcomes: opts.anomalySpoilers ? (cat?.outcomes ?? []) : null,
			tree
		};
	};
	const project = (p: ProjectInfo) => {
		const info = data.projects[p.key];
		const tree = read(trees.project(p.key));
		return {
			closed: closed(tree),
			...p,
			system: system(p.systemId),
			name: info?.name ?? p.key,
			department: info?.department ?? null,
			time: projectTime(info),
			outcomes: opts.projectSpoilers ? (info?.outcomes ?? []) : null,
			tree
		};
	};
	const projectTime = (info: (typeof data.projects)[string] | undefined): Time | null => {
		if (info?.days)
			return { days: info.days, approx: false, note: 'a ship’s project, before speed bonuses' };
		const days = info?.cost ? researchDays(info.cost, info.department, save?.income ?? null) : null;
		return days === null
			? null
			: {
					days,
					approx: true,
					note: `${info!.cost} research at your current monthly ${pretty(info!.department ?? '')}; the field halts meanwhile`
				};
	};
	const dig = (d: DigSite) => {
		const tree = read(trees.digSite(d.type));
		const next = d.chapter ?? 1;
		// the remaining chapters' difficulties where the tree knows them, else the next one's
		const later = (tree ?? []).flatMap((n) =>
			n.t === 'chapter' && n.n > next && n.difficulty !== null ? [n.difficulty] : []
		);
		const days =
			scientist === null
				? null
				: digDays(scientist, [d.difficulty, ...later], d.clues, d.excavating ? d.daysLeft : null);
		return {
			...d,
			system: system(d.systemId),
			name: data.digSiteTypes[d.type]?.name ?? pretty(d.type.replace(/^site_/, '')),
			stages: data.digSiteTypes[d.type]?.stages ?? null,
			time:
				days === null
					? null
					: ({
							days,
							approx: true,
							note: `expected, ${later.length ? `chapters ${next}–${next + later.length}` : `chapter ${next}`}: a roll every 90 days, d10 + skill + clues − difficulty, 14 finishes; ${withScientist}`
						} satisfies Time),
			tree
		};
	};
	// what the save has that only one anomaly, project or dig site gives: it got that far
	const marks = uniqueMarks(data.outcomeTrees, data.outcomeFlags);
	const colonies = s?.colonies ?? [];
	const evidence: Evidence = {
		flags: new Set(s?.countryFlags ?? []),
		modifiers: new Set([
			...(s?.countryModifiers ?? []).map((m) => m.key),
			...colonies.flatMap((c) => c.planet?.modifiers.map((m) => m.key) ?? [])
		]),
		deposits: new Map([
			...galaxy.flatMap((g) => (g.bodies ?? []).map((b) => [b.id, new Set(b.deposits)] as const)),
			...colonies.map((c) => [c.planetId, new Set(c.deposits)] as const)
		])
	};
	// each with the date of the last save that had it
	const dated =
		<T, R>(row: (t: T) => R) =>
		(t: T & { lastSeen: string }) => ({ ...row(t), lastSeen: t.lastSeen });
	const anomalies = (s?.anomalies ?? []).map(anomaly);
	const projects = (s?.specialProjects ?? []).map(project);
	const digSites = (s?.digSites ?? []).map(dig);
	const techNames = Object.fromEntries(Object.entries(data.techs).map(([k, v]) => [k, v.name]));
	// what the open ones can still bring, as far as their spoilers are on
	const researched = new Set(save?.progress?.researched ?? []);
	type Source = Parameters<typeof gainRows>[0][number];
	const all: Source[] = [
		...anomalies.map((a) => ({
			name: a.name,
			kind: 'anomaly' as const,
			tree: a.tree,
			time: a.time
		})),
		...projects.map((p) => ({
			name: p.name,
			kind: 'project' as const,
			tree: p.tree,
			time: p.time
		})),
		...digSites.map((d) => ({
			name: d.name,
			kind: 'dig site' as const,
			time: d.time,
			tree: d.tree,
			next: d.chapter
		}))
	].flatMap((x) => (x.tree ? [{ ...x, tree: prune(x.tree) }] : []));
	// the plan's techs, wanted ones' prerequisites included: what an outcome helps with
	const planned = new Map(
		planSummary(b.tip).plannedTechs.map(([k, v]) => [k, { stance: v.stance, note: v.note }])
	);
	const permanent = new Set(save?.techPermanent ?? []);
	const withTech = (g: GainRow): GainRow => {
		const k = g.key.slice(g.key.indexOf(':') + 1);
		const t = g.kind === 'tech' || g.kind === 'option' ? data.techs[k] : undefined;
		return t
			? {
					...g,
					tech: {
						tier: t.tier,
						cost: save ? techCost(k, save, data) : null,
						area: t.area,
						researched: researched.has(k),
						permanent: permanent.has(k),
						plan: planned.get(k) ?? null
					}
				}
			: g;
	};
	// one list per kind of source, merged on the page as its filters say (`mergeGainRows()`)
	const gains = Object.fromEntries(
		(['anomaly', 'project', 'dig site'] as const).map((kind) => [
			kind,
			gainRows(
				all.filter((x) => x.kind === kind),
				{ income: save?.income ?? null, values },
				techNames
			).map(withTech)
		])
	) as Record<GainSource['kind'], GainRow[]>;
	return {
		...rest,
		gains,
		values,
		// what months of income and tech progress come to now (#lib/Outcome.svelte); a function
		// does not serialise, so its techs go along as a table
		now: nowTable(outcomeNow(save, data, planned), [
			...Object.values(data.outcomeTrees.anomaly),
			...Object.values(data.outcomeTrees.project),
			...Object.values(data.outcomeTrees.dig_site)
		]),
		territories,
		contractMarks: contractMarksAt(snaps, opts),
		seen: seenRows(
			mergeSightings(snaps),
			territories,
			system,
			new Set((s?.relations ?? []).filter((r) => r.communications).map((r) => r.countryId))
		),
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
		anomalies,
		projects,
		digSites,
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
			)
				.map(dated(anomaly))
				.map((a) => ({
					...a,
					inferred: inferDone(marks.get(`anomaly:${a.category}`), evidence, a.planetId)
				})),
			projects: gone(
				snaps,
				s,
				(x) => x.specialProjects,
				(p) => p.id
			)
				.map(dated(project))
				.map((p) => ({
					...p,
					inferred: inferDone(marks.get(`project:${p.key}`), evidence, p.planetId)
				})),
			digSites: gone(
				snaps,
				s,
				(x) => x.digSites,
				(d) => d.id
			)
				.map(dated(dig))
				.map((d) => ({
					...d,
					inferred: inferDone(marks.get(`dig_site:${d.type}`), evidence, d.planetId, d.stages)
				}))
		}
	};
}
