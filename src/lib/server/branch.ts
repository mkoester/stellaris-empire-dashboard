import { expiries, rolls, timedOut, upcoming, toDays } from '#lib/events.ts';
import { jobRows, jobSources, netFlows, withFlows, workedJobs } from '#lib/jobs.ts';
import { getDb, getExplanations, getGameData } from './app.ts';
import { headId, history, nodes } from './db.ts';
import { pick } from './explain.ts';
import { dismissed } from './campaigns.ts';
import { idles, withIdleShips } from '#lib/idle.ts';
import { display } from './settings.ts';
import { empireColors } from '#lib/contacts.ts';
import { milestones } from '#lib/milestones.ts';
import { path } from '#lib/timeline.ts';

/**
 * The branch a page shows: ending at ?node=<id>, or at the head (the state last seen from the
 * game). Null before the first save.
 */
export function branch(url: URL) {
	const db = getDb();
	const all = nodes(db);
	const requested = Number(url.searchParams.get('node'));
	const tip = all.some((n) => n.id === requested) ? requested : headId(db);
	if (tip === null) return null;
	const snaps = history(db, tip);
	const campaign = all.find((n) => n.id === tip)?.campaign ?? '';
	const title = (ref: string) => getExplanations()[ref]?.title;
	// Events come from the latest full save; the one before it gives the rates.
	const saves = snaps.filter((s) => s.progress !== null);
	const last = saves.at(-1);
	// Rates need time to have passed: the latest save before the last one's date (a manual save
	// right after the autosave of the same day would give none).
	const previous = saves.findLast((s) => last !== undefined && s.date < last.date) ?? null;
	// what sits idle, each since its idle spell began, without the dismissed (#lib/idle.ts)
	const idle = idles(saves, getGameData().leaderCap, dismissed(db, campaign));
	// Jobs worked, per colony and summed over the empire, at the latest full save, with what each
	// job produces and uses (the budget's per-job sources; a planet gets its pops share).
	const info = getGameData().jobs;
	const colonies = last?.colonies ?? [];
	const sources = jobSources(last?.planetBudget ?? [], info, workedJobs(colonies));
	const flows = netFlows(sources);
	const shared = new Set(Object.keys(sources).filter((j) => sources[j].shared));
	const empireJobs = withFlows(
		jobRows(
			colonies.flatMap((c) => c.jobs),
			info
		),
		flows,
		undefined,
		shared
	);
	const empirePops = Object.fromEntries(empireJobs.map((r) => [r.type, r.pops]));
	const held = colonies.flatMap((c) => [
		...c.buildQueue.map((q) => q.name),
		...c.deposits,
		...c.districtList.flatMap((d) => [d.type, ...d.zones.flatMap((z) => [z.type, ...z.buildings])])
	]);
	return {
		// the campaign's bigger events along this branch, for charts and the events panel
		milestones: milestones(snaps, getGameData()),
		upcoming: last
			? [
					...withIdleShips(upcoming(last, previous, getGameData(), saves.slice(0, -1)), idle.ships),
					...idle.rows,
					...expiries(last, getGameData(), title, display().hiddenTimers),
					...timedOut(saves, getGameData(), title, dismissed(db, campaign)),
					...rolls(last)
				].sort((a, b) => toDays(a.date) - toDays(b.date) || a.what.localeCompare(b.what))
			: [],
		// Display names of what the colonies hold: queue items, districts, zones, buildings.
		names: pick(getGameData().names, held),
		// and the districts' colours in game
		colors: pick(getGameData().districtColors, held),
		jobs: Object.fromEntries(
			colonies.map((c) => [c.planetId, withFlows(jobRows(c.jobs, info), flows, empirePops, shared)])
		),
		empireJobs,
		// what each building on our colonies or in their queues is, for BuildingName on every page
		buildings: pick(
			getExplanations(),
			held.map((k) => `building:${k}`)
		),
		// what each colony's designation does, for the Designation popup on every page
		designations: pick(
			getExplanations(),
			colonies.map((c) => `designation:${c.designation}`)
		),
		blockers: getGameData().blockers.filter((k) => colonies.some((c) => c.deposits.includes(k))),
		// every known empire's map colour by name, for EmpireName
		empireColors: empireColors(
			snaps.findLast((s) => s.countries !== null),
			getGameData().flagColors
		),
		tip,
		isHead: tip === headId(db),
		snaps,
		latest: snaps[snaps.length - 1],
		guessedLinks: path(all, tip).filter((n) => n.ambiguous).length
	};
}
