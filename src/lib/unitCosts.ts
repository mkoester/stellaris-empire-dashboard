import { jobSources, type JobInfo } from './jobs.ts';
import { basePrice } from './market.ts';
import type { BudgetSource, Colony, Resources } from './types.ts';
import { valueOf } from './value.ts';

// What a unit of each resource costs us to make, and how well each colony works its jobs — pure.
// - Sources: every job (the budget's `planet_<job>`), station kind and the starbase modules. A
//   source's running cost per month is what it uses — a job's inputs plus its workers' upkeep
//   (their stratum's `pop_category_<stratum>s` expenses per pop, and every pop's food or other
//   needs, `planet_pops_traits`), a station's or module's upkeep —
//   in trade. Building and district upkeep, and what was paid to build them, are not counted.
// - Values: what the market sells is worth its base price (trade is the unit, 1); every other
//   resource (research, unity, influence …) is worth what it costs us: the output-weighted mean of
//   its sources' cost per unit. A source yielding several resources splits its cost by their value.
//   Values feed back (a job may use unity), so they are iterated to a fixed point.
// - Colonies: a colony's output of a resource against what its filled jobs yield at the empire's
//   mean per pop — 100 % is average, above it the colony's modifiers (designation, features,
//   buildings) work for that resource. Its output also counts flat building output, so a colony
//   with such buildings reads high.

export type CostSource = {
	id: string; // job:<key>, station:<kind>, starbase_modules
	label: string;
	kind: 'job' | 'station' | 'starbase';
	output: Resources; // per month
	uses: Resources; // per month: inputs and upkeep
	pops: number; // workers (jobs)
};

export type UnitCost = { source: CostSource; resource: string; amount: number; perUnit: number };

const add = (a: Resources, b: Resources, k = 1): Resources => {
	const out = { ...a };
	for (const [r, v] of Object.entries(b)) out[r] = (out[r] ?? 0) + v * k;
	return out;
};

/** The market's resources at base price, trade itself at 1; null: not sold. */
export const marketValue = (r: string) => (r === 'trade' ? 1 : basePrice(r));

/**
 * Workers' upkeep per pop, by stratum: the stratum's own (`worker` → `pop_category_workers`
 * expenses ÷ its pops) plus what every pop eats (`planet_pops_traits` ÷ all pops).
 */
export function stratumUpkeep(
	budget: BudgetSource[],
	colonies: Colony[]
): Record<string, Resources> {
	const pops: Record<string, number> = {};
	for (const s of colonies.flatMap((c) => c.strata))
		pops[s.category] = (pops[s.category] ?? 0) + s.size;
	// what every pop eats (food; alloys or minerals for some species) is booked apart, for all pops
	const all = Object.values(pops).reduce((a, b) => a + b, 0);
	const shared = budget.find((x) => x.source === 'planet_pops_traits')?.expenses ?? {};
	const each = all > 0 ? add({}, shared, 1 / all) : {};
	return Object.fromEntries(
		Object.entries(pops).flatMap(([cat, n]) => {
			const b = budget.find((x) => x.source === `pop_category_${cat}s`);
			return n > 0 ? [[cat, add(each, b?.expenses ?? {}, 1 / n)]] : [];
		})
	);
}

const STATIONS = [
	['station:mining', 'mining stations', 'orbital_mining_deposits', 'station_gatherers'],
	['station:research', 'research stations', 'orbital_research_deposits', 'station_researchers']
] as const;

/** Every source of output in the budget, with what it uses per month. */
export function costSources(
	budget: BudgetSource[],
	colonies: Colony[],
	jobs: JobInfo
): CostSource[] {
	const filled: Record<string, number> = {};
	for (const j of colonies.flatMap((c) => c.jobs))
		filled[j.type] = (filled[j.type] ?? 0) + j.filled;
	const upkeep = stratumUpkeep(budget, colonies);
	const source = (s: string) => budget.find((b) => b.source === s);
	const out: CostSource[] = Object.entries(jobSources(budget, jobs)).flatMap(([job, s]) => {
		const pops = filled[job] ?? 0;
		if (!Object.values(s.income).some((v) => v > 0) || pops <= 0) return [];
		const stratum = jobs[job]?.category ?? '';
		return [
			{
				id: `job:${job}`,
				label: jobs[job]?.name ?? job,
				kind: 'job' as const,
				output: s.income,
				uses: add(s.expenses, upkeep[stratum] ?? {}, pops),
				pops
			}
		];
	});
	for (const [id, label, income, expense] of STATIONS) {
		const made = source(income)?.income ?? {};
		if (Object.values(made).some((v) => v > 0))
			out.push({
				id,
				label,
				kind: 'station',
				output: made,
				uses: source(expense)?.expenses ?? {},
				pops: 0
			});
	}
	const modules = source('starbase_modules');
	if (modules && Object.values(modules.income).some((v) => v > 0))
		out.push({
			id: 'starbase_modules',
			label: 'starbase modules',
			kind: 'starbase',
			output: modules.income,
			uses: modules.expenses,
			pops: 0
		});
	return out;
}

/**
 * Each source's cost per unit of what it yields, at `values`: its running cost split over its
 * outputs by their value, divided by the amount.
 */
export function unitCosts(sources: CostSource[], values: Resources): UnitCost[] {
	return sources.flatMap((source) => {
		const cost = valueOf(source.uses, values);
		const worth = valueOf(source.output, values);
		return Object.entries(source.output)
			.filter(([, amount]) => amount > 0)
			.map(([resource, amount]) => ({
				source,
				resource,
				amount,
				perUnit: worth > 0 ? (cost * (values[resource] ?? 1)) / worth : cost / amount
			}));
	});
}

/**
 * What each resource is worth, in trade: the market's base price where it sells, else what it
 * costs us — iterated, since a source may use what other sources make.
 */
export function unitValues(sources: CostSource[], rounds = 30): Resources {
	const keys = [
		...new Set(sources.flatMap((s) => [...Object.keys(s.output), ...Object.keys(s.uses)]))
	];
	let values: Resources = Object.fromEntries(keys.map((k) => [k, marketValue(k) ?? 1]));
	for (let i = 0; i < rounds; i++) {
		const costs = unitCosts(sources, values);
		const next = { ...values };
		for (const k of keys.filter((k) => marketValue(k) === null)) {
			const made = costs.filter((c) => c.resource === k);
			const total = made.reduce((s, c) => s + c.amount, 0);
			if (total > 0) next[k] = made.reduce((s, c) => s + c.perUnit * c.amount, 0) / total;
		}
		values = next;
	}
	return values;
}

export type ColonyEfficiency = {
	planetId: number;
	name: string;
	designation: string;
	jobs: string[]; // worked there, most pops first
	ratio: Record<string, number>; // resource → output ÷ expected at the empire's mean
	expected: Resources;
	actual: Resources;
};

/** Per colony and resource: its output against its filled jobs at the empire's mean per pop. */
export function colonyEfficiency(
	budget: BudgetSource[],
	colonies: Colony[],
	jobs: JobInfo
): ColonyEfficiency[] {
	const filled: Record<string, number> = {};
	for (const j of colonies.flatMap((c) => c.jobs))
		filled[j.type] = (filled[j.type] ?? 0) + j.filled;
	const perPop = Object.fromEntries(
		Object.entries(jobSources(budget, jobs))
			.filter(([job]) => (filled[job] ?? 0) > 0)
			.map(([job, s]) => [job, add({}, s.income, 1 / filled[job])])
	);
	return colonies
		.filter((c) => !c.colonizing && c.planetId >= 0)
		.map((c) => {
			const worked = c.jobs.filter((j) => j.filled > 0 && perPop[j.type]);
			const expected = worked.reduce<Resources>((e, j) => add(e, perPop[j.type], j.filled), {});
			const ratio = Object.fromEntries(
				Object.entries(expected)
					// a resource its jobs barely make reads as anything (flat building output dominates)
					.filter(([, v]) => v >= 1)
					.map(([r, v]) => [r, (c.produces[r] ?? 0) / v])
			);
			return {
				planetId: c.planetId,
				name: c.name,
				designation: c.designation,
				jobs: [...worked].sort((a, b) => b.filled - a.filled).map((j) => j.type),
				ratio,
				expected,
				actual: c.produces
			};
		});
}
