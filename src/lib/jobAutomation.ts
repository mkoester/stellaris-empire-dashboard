import type { Costs, Resources } from './types.ts';

// District automation (the colony what-ifs, a spoiler): what building the next automation
// building would do on a colony, ≈. From 4.5.4's files:
// - `common/buildings/01_pop_assembly_buildings.txt`: `building_automation_<job>_1` sets
//   `job_<job>_automated_workforce_mult` (and the drone job's) to 0.25, its upgrade `_2` to 0.50,
//   one each per planet — farmers, miners and technicians only, so farming, mining and generator
//   districts; Tankbound and wilderness empires cannot build them (Tankbound has them at 1.0);
// - `common/pop_categories/*` `automation_resources`: each automated job (100 workforce) costs its
//   stratum's energy a month (worker 4, simple drone 4, …; budget `planet_automated_jobs`), on top
//   of the building's own upkeep — so the bill grows with the districts automated. Measured on the
//   2200.01.01 save of 4.5.4: one empire's automated workforce × rate ÷ 100 = 1519.6 energy, the
//   budget booked 1527.8.
// The save's `automated_workforce` is part of a job's `workforce` (READER 54). Seen in game
// 2026-11-12 (docs/open-checks.md 35): the share applies to the job's positions (1200 → 300 at
// 25 %), automation takes the open positions first, then those pops work (they move to other
// jobs); job efficiency's bonus workforce counts pops only, automated workforce produces as theirs.

/** A building that automates a share of some jobs: `jobs` job → share. */
export type AutomationBuilding = {
	key: string;
	name: string;
	jobs: Record<string, number>;
	techs: string[]; // what unlocks it (data DB `technology_unlock`; empty without the table)
};

export type JobAutomation = {
	buildings: AutomationBuilding[];
	rates: Record<string, Resources>; // stratum → what one automated job costs a month
};

export const NO_JOB_AUTOMATION: JobAutomation = { buildings: [], rates: {} };

const AUTOMATED = /^job_(\w+)_automated_workforce_mult$/;

/**
 * The automation buildings among `mods` (building → its planet modifiers): those whose every
 * modifier is a job's automated workforce — so not a farm that also automates its farmers.
 */
export function automationBuildingsOf(
	mods: Record<string, { key: string; value: number }[]>,
	names: Record<string, string>,
	techs: Record<string, string[]>
): AutomationBuilding[] {
	return Object.entries(mods).flatMap(([key, ms]) => {
		if (!ms.length || !ms.every((m) => AUTOMATED.test(m.key) && m.value > 0)) return [];
		const jobs = Object.fromEntries(ms.map((m) => [m.key.match(AUTOMATED)![1], m.value]));
		return [{ key, name: names[key] ?? key, jobs, techs: techs[key] ?? [] }];
	});
}

/** Buildings automating the same jobs, each line lowest share first (Automation → Optimization). */
export function automationLines(buildings: AutomationBuilding[]): AutomationBuilding[][] {
	const lines = new Map<string, AutomationBuilding[]>();
	for (const b of buildings) {
		const id = Object.keys(b.jobs).sort().join(',');
		lines.set(id, [...(lines.get(id) ?? []), b]);
	}
	const top = (b: AutomationBuilding) => Math.max(...Object.values(b.jobs));
	return [...lines.values()].map((l) =>
		l.sort((a, b) => top(a) - top(b) || a.key.localeCompare(b.key))
	);
}

/** One job of a colony as the step needs it (a job row: workforce, positions, output). */
export type AutomationJob = {
	type: string;
	name?: string;
	category: string; // stratum
	filled: number; // workforce, the automated part included
	positions: number | null;
	automated?: number;
	bonus?: number; // job efficiency's extra workforce, the pops' only
	flows?: Resources; // its output − inputs a month
	// what the job itself produces (data DB `job_resource`); the rest of its flows is its pops'
	// stratum's (workers' trade: "Human Workers … Production"), which automation does not make and
	// pops take along. Undefined: every positive flow counts.
	produces?: string[];
};

export type AutomationStep = {
	job: string;
	name: string; // the job's, as the game shows it
	automated: number; // workforce automated after
	added: number; // workforce automated on top of today's
	freed: number; // workforce pops work today that automation takes over
	filled: number; // workforce added to the job (open positions automation fills)
	autoOutput: Resources; // what the added automated workforce makes a month
	freedOutput: Resources; // what the freed pops' work makes in this job today
	output: Resources; // the job's output change a month: autoOutput − freedOutput
	upkeep: Resources; // what the added automated jobs cost a month
};

const sum = (rs: Resources[]): Resources => {
	const out: Resources = {};
	for (const r of rs) for (const [k, v] of Object.entries(r)) out[k] = (out[k] ?? 0) + v;
	return out;
};

const scaled = (r: Resources, k: number): Resources =>
	Object.fromEntries(Object.entries(r).map(([res, v]) => [res, v * k]));

/** What `share` more of a job's positions automated would do (null: nothing to automate). */
export function automationStep(
	job: AutomationJob,
	share: number,
	rates: Record<string, Resources>
): AutomationStep | null {
	const limit = job.positions ?? 0;
	if (limit <= 0 || share <= 0) return null;
	const auto = Math.min(job.automated ?? 0, limit);
	const popW = Math.max(job.filled - auto, 0);
	const after = Math.min(limit, auto + share * limit);
	const added = after - auto;
	if (added <= 0) return null;
	const popAfter = Math.min(popW, limit - after);
	const filled = after + popAfter - job.filled;
	// One rate per workforce for pops and automation alike (base × the colony's multipliers); pops
	// add job efficiency's bonus workforce on top of their own, automation does not (seen in game
	// 2026-11-12: 900 pops + 90 bonus + 300 automated, every multiplier on the whole 1290).
	const made = Object.fromEntries(
		Object.entries(job.flows ?? {}).filter(
			([k, v]) => v > 0 && (job.produces === undefined || job.produces.includes(k))
		)
	);
	const total = job.filled + (job.bonus ?? 0);
	const rate = total > 0 ? 1 / total : 0;
	const perPop = popW > 0 ? 1 + (job.bonus ?? 0) / popW : 1;
	const freed = popW - popAfter;
	const autoOutput = scaled(made, added * rate);
	const freedOutput = scaled(made, freed * perPop * rate);
	return {
		job: job.type,
		name: job.name ?? job.type,
		automated: after,
		added,
		freed,
		filled: Math.max(filled, 0),
		autoOutput,
		freedOutput,
		output: sum([autoOutput, scaled(freedOutput, -1)]),
		upkeep: scaled(rates[job.category] ?? {}, added / 100)
	};
}

export type AutomationOption = {
	key: string; // the building to build (or upgrade to)
	name: string;
	replaces: string | null; // the building it upgrades
	steps: AutomationStep[];
	freed: number;
	filled: number;
	autoOutput: Resources; // what the added automated workforce makes a month
	freedOutput: Resources; // what the freed pops' work makes today
	output: Resources; // the jobs' output change: autoOutput − freedOutput
	cost: Resources; // one-off
	upkeep: Resources; // a month: the building's upkeep change plus the automated jobs'
	missing: string[] | null; // techs still to research; null: unknown
};

/**
 * The next automation building of each line on a colony that has its jobs: the first one where
 * none stands, else the upgrade of the one that does. `buildings` every building on the colony.
 * In the order of `jobs` (the save's, which the game's colony view shows: technicians, miners,
 * farmers).
 */
export function automationOptions(
	jobs: AutomationJob[],
	buildings: string[],
	researched: string[],
	costs: Record<string, Costs>,
	data: JobAutomation
): AutomationOption[] {
	const at = (o: AutomationOption) => jobs.findIndex((j) => j.type === o.steps[0].job);
	const options = automationLines(data.buildings).flatMap((line) => {
		const held = line.findLastIndex((b) => buildings.includes(b.key));
		const next = line[held + 1];
		if (!next) return [];
		const now = held >= 0 ? line[held] : null;
		const steps = jobs.flatMap((j) => {
			const share = (next.jobs[j.type] ?? 0) - (now?.jobs[j.type] ?? 0);
			const s = next.jobs[j.type] ? automationStep(j, share, data.rates) : null;
			return s ? [s] : [];
		});
		if (!steps.length) return [];
		const upkeep = sum([
			costs[next.key]?.upkeep ?? {},
			scaled(now ? (costs[now.key]?.upkeep ?? {}) : {}, -1),
			...steps.map((s) => s.upkeep)
		]);
		return [
			{
				key: next.key,
				name: next.name,
				replaces: now?.key ?? null,
				steps,
				freed: steps.reduce((t, s) => t + s.freed, 0),
				filled: steps.reduce((t, s) => t + s.filled, 0),
				autoOutput: sum(steps.map((s) => s.autoOutput)),
				freedOutput: sum(steps.map((s) => s.freedOutput)),
				output: sum(steps.map((s) => s.output)),
				cost: costs[next.key]?.cost ?? {},
				upkeep,
				missing: next.techs.length ? next.techs.filter((t) => !researched.includes(t)) : null
			}
		];
	});
	return options.sort((a, b) => at(a) - at(b));
}

/**
 * Where the building would stand: it goes into a zone of the district that holds its jobs (4.5.4
 * `common/zones/00_zones.txt`: `zone_default` and `zone_urban` exclude the `*_automation` building
 * sets, the resource zones — Agricultural Focus … — take them; seen in game 2026-11-12: no farmer
 * automation without the farming district's zone). The districts built on the colony whose jobs
 * (`districtJobs`) include one of `jobs`: null when one of them has a zone (a free slot there is
 * still unknown), else their types — a zone to build first. [] when no built district holds them.
 */
export function zoneNeeded(
	jobs: string[],
	districts: { type: string; built: number; zones: unknown[] }[],
	districtJobs: Record<string, Record<string, number>>
): string[] | null {
	const holding = districts.filter(
		(d) => d.built > 0 && jobs.some((j) => (districtJobs[d.type]?.[j] ?? 0) > 0)
	);
	return holding.some((d) => d.zones.length) ? null : holding.map((d) => d.type);
}

// Who cannot build them (the buildings' `potential`: `is_wilderness_empire`, `is_tankbound_empire`
// — the Tankbound civics, 4.5.4 `scripted_triggers/08_scripted_triggers_shroud.txt`): the save
// answers both.
const TANKBOUND = ['civic_tankbound', 'civic_tankbound_corporate'];

/** Why this empire builds no automation buildings, or null. */
export function automationBarred(
	government: string[] | null,
	origin: string | null
): 'tankbound' | 'wilderness' | null {
	if ((government ?? []).some((k) => TANKBOUND.includes(k))) return 'tankbound';
	if (origin === 'origin_wilderness') return 'wilderness';
	return null;
}

/** Workforce taken or added per energy a month (the ranking): more is better. */
export const perEnergy = (o: Pick<AutomationOption, 'freed' | 'filled' | 'upkeep'>) =>
	(o.freed + o.filled) / Math.max(o.upkeep.energy ?? 0, 0.01);
