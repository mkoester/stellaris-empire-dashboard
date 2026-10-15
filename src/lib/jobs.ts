import type { BudgetSource, Colony, ColonyJob, Resources } from './types.ts';

// Jobs summed over colonies, ordered like the game groups them: rulers, specialists, workers,
// then civilians and anything else; within a stratum by pops worked.

export type JobInfo = Record<string, { name: string; category: string | null }>;
export type JobRow = ColonyJob & {
	name: string;
	category: string;
	flows?: Resources; // output − inputs per month
	estimated?: boolean; // flows are a pops share of the empire total
};

const STRATA = ['ruler', 'specialist', 'worker', 'civilian'];

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

/**
 * Output and inputs per job type from the budget, which books them empire-wide under
 * `planet_<job>`: the plural of the job's key or name (`planet_farmers` → farmer,
 * `planet_metallurgists` → foundry "Metallurgist"), sometimes singular (`planet_technician`).
 */
export function jobFlows(budget: BudgetSource[], info: JobInfo): Record<string, Resources> {
	const norm = (s: string) => s.toLowerCase().replace(/s$/, '');
	// Keys win over names: primitive_farmer is also named "Farmer".
	const byName = new Map<string, string>();
	for (const [key, j] of Object.entries(info))
		if (!byName.has(norm(j.name))) byName.set(norm(j.name), key);
	for (const key of Object.keys(info)) byName.set(norm(key), key);
	const out: Record<string, Resources> = {};
	for (const s of budget) {
		if (!s.source.startsWith('planet_')) continue;
		const job = byName.get(norm(s.source.slice('planet_'.length)));
		if (!job) continue;
		const flows = { ...s.income };
		for (const [k, v] of Object.entries(s.expenses)) flows[k] = (flows[k] ?? 0) - v;
		out[job] = flows;
	}
	return out;
}

/**
 * Attaches flows to rows. For one planet's rows pass `empirePops` (pops per job empire-wide): the
 * planet gets its pops share, an estimate unless the planet holds all of that job.
 */
export function withFlows(
	rows: JobRow[],
	flows: Record<string, Resources>,
	empirePops?: Record<string, number>
): JobRow[] {
	return rows.map((r) => {
		const f = flows[r.type];
		if (!f) return r;
		const share = empirePops ? r.pops / (empirePops[r.type] || r.pops || 1) : 1;
		return {
			...r,
			flows: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v * share])),
			estimated: share < 1
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
