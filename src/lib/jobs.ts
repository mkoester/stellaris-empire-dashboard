import type { BudgetSource, Colony, ColonyJob, Resources } from './types.ts';

// Jobs summed over colonies, ordered like the game groups them: rulers, specialists, workers,
// civilians — a gestalt's complex, menial and maintenance drones (Yorphia 2201.10) — then anything
// else; within a stratum by pops worked.

export type JobInfo = Record<
	string,
	{ name: string; category: string | null; budgetSource?: string | null }
>;
export type JobRow = ColonyJob & {
	name: string;
	category: string;
	flows?: Resources; // output − inputs per month
	estimated?: boolean; // flows are a pops share of the empire total or of a shared source
};

export type JobSource = { income: Resources; expenses: Resources; shared?: boolean };

const STRATA = [
	'ruler',
	'specialist',
	'worker',
	'civilian',
	'complex_drone',
	'simple_drone',
	'maintenance_drone'
];

/** A stratum as the game's jobs screen names it: `simple_drone` → "menial drone". */
export const stratumName = (category: string) =>
	category === 'simple_drone' ? 'menial drone' : category.replaceAll('_', ' ');

export function jobRows(jobs: ColonyJob[], info: JobInfo): JobRow[] {
	const byType = new Map<string, ColonyJob>();
	for (const j of jobs) {
		const sum = byType.get(j.type);
		byType.set(
			j.type,
			sum
				? {
						type: j.type,
						pops: sum.pops + j.pops,
						filled: sum.filled + j.filled,
						positions:
							sum.positions === null || j.positions === null ? null : sum.positions + j.positions
					}
				: { ...j }
		);
	}
	const rank = (c: string) => (STRATA.includes(c) ? STRATA.indexOf(c) : STRATA.length);
	return [...byType.values()]
		.map((j) => ({
			...j,
			name: info[j.type]?.name ?? j.type,
			category: info[j.type]?.category ?? ''
		}))
		.sort((a, b) => rank(a.category) - rank(b.category) || b.pops - a.pops);
}

/** Pops working each job, summed over the colonies — what a shared budget source is split by. */
export function workedJobs(colonies: Pick<Colony, 'jobs'>[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const j of colonies.flatMap((c) => c.jobs)) out[j.type] = (out[j.type] ?? 0) + j.filled;
	return out;
}

/** Output and inputs per job type from the budget (`jobSources`), inputs subtracted. */
export function jobFlows(
	budget: BudgetSource[],
	info: JobInfo,
	worked: Record<string, number>
): Record<string, Resources> {
	return netFlows(jobSources(budget, info, worked));
}

/** Each job's output minus its inputs. */
export function netFlows(sources: Record<string, JobSource>): Record<string, Resources> {
	return Object.fromEntries(
		Object.entries(sources).map(([job, s]) => {
			const flows = { ...s.income };
			for (const [k, v] of Object.entries(s.expenses)) flows[k] = (flows[k] ?? 0) - v;
			return [job, flows];
		})
	);
}

/**
 * Each job's budget source, income and inputs apart. The budget books a job's output empire-wide
 * under its `resources.category` (data DB `job.budget_source`), which drone jobs share with the
 * organic ones (`technician_drone` → `planet_technician`) and some jobs share with each other
 * (`planet_jobs`: patrol drones and more). A source goes to the jobs the empire works with it
 * (`worked`: pops per job), split by pops when several do (`shared`, an estimate). A source no
 * worked job claims goes to the job its name suggests: the plural of its key or name
 * (`planet_farmers` → farmer, `planet_metallurgists` → foundry "Metallurgist").
 */
export function jobSources(
	budget: BudgetSource[],
	info: JobInfo,
	worked: Record<string, number>
): Record<string, JobSource> {
	const norm = (s: string) => s.toLowerCase().replace(/s$/, '');
	// Keys win over names: primitive_farmer is also named "Farmer".
	const byName = new Map<string, string>();
	for (const [key, j] of Object.entries(info))
		if (!byName.has(norm(j.name))) byName.set(norm(j.name), key);
	for (const key of Object.keys(info)) byName.set(norm(key), key);
	const bySource = new Map<string, string[]>();
	for (const [key, j] of Object.entries(info))
		if (j.budgetSource && (worked[key] ?? 0) > 0)
			bySource.set(j.budgetSource, [...(bySource.get(j.budgetSource) ?? []), key]);
	const scale = (r: Resources, k: number) =>
		Object.fromEntries(Object.entries(r).map(([res, v]) => [res, v * k]));
	const out: Record<string, JobSource> = {};
	for (const s of budget) {
		if (!s.source.startsWith('planet_')) continue;
		const jobs = bySource.get(s.source);
		if (jobs && jobs.length > 1) {
			const total = jobs.reduce((n, j) => n + worked[j], 0);
			for (const j of jobs)
				out[j] = {
					income: scale(s.income, worked[j] / total),
					expenses: scale(s.expenses, worked[j] / total),
					shared: true
				};
			continue;
		}
		const job = jobs?.[0] ?? byName.get(norm(s.source.slice('planet_'.length)));
		if (job) out[job] = { income: s.income, expenses: s.expenses };
	}
	return out;
}

/**
 * Attaches flows to rows. For one planet's rows pass `empirePops` (pops per job empire-wide): the
 * planet gets its pops share, an estimate unless the planet holds all of that job. Jobs in
 * `shared` got a pops share of a budget source other jobs book under too — an estimate as well.
 */
export function withFlows(
	rows: JobRow[],
	flows: Record<string, Resources>,
	empirePops?: Record<string, number>,
	shared: Set<string> = new Set()
): JobRow[] {
	return rows.map((r) => {
		const f = flows[r.type];
		if (!f) return r;
		const share = empirePops ? r.pops / (empirePops[r.type] || r.pops || 1) : 1;
		return {
			...r,
			flows: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v * share])),
			estimated: share < 1 || shared.has(r.type)
		};
	});
}

/**
 * Open jobs that call for pops. With crime automation on, the colony fills enforcer posts itself
 * as crime requires, so their vacancies are not counted — returned apart as `reserved`.
 */
export function openJobs(colony: Pick<Colony, 'openJobs' | 'jobs' | 'automation'>) {
	const crimeAutomation =
		colony.automation?.enabled === true &&
		colony.automation.settings.includes('planet_automation_crime');
	const reserved = crimeAutomation
		? colony.jobs
				.filter((j) => j.type === 'enforcer' && j.positions !== null)
				.reduce((n, j) => n + Math.max(j.positions! - j.filled, 0), 0)
		: 0;
	return { open: colony.openJobs - reserved, reserved };
}
