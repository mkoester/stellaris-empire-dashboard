import { blocked } from '#lib/blockers.ts';
import { pretty } from '#lib/format.ts';
import { edictRows, facts } from '#lib/government.ts';
import { jobFlows } from '#lib/jobs.ts';
import { marketFee, price } from '#lib/market.ts';
import { changeGain, type GroupFlows, type ProduceOption } from '#lib/produce.ts';
import { stripOrder } from '#lib/resourceGroups.ts';
import { changesOf, jobGroup } from '#lib/tradeoffs.ts';
import type { Resources, Snapshot } from '#lib/types.ts';
import { getGameData } from './app.ts';
import type { branch } from './branch.ts';
import { colonyBlockerHints, colonyDetails } from './planets.ts';
import { jobMeasure, paidFactor, tradeoffData } from './tradeoffs.ts';

// The produce tab's inputs: every way to get more of a resource the latest full save allows —
// the trade-offs tab's stations, districts and buildings, plus starbase modules and buildings
// where a starbase has a free slot, clearing a blocker for the district it makes room for, and
// the edicts we could enact — and what the market charges.

const add = (a: Resources, b: Resources, k = 1): Resources => {
	const out = { ...a };
	for (const [r, v] of Object.entries(b)) out[r] = (out[r] ?? 0) + v * k;
	return out;
};
const sum = (rs: Resources[]) => rs.reduce((a, b) => add(a, b), {});
const ratio = (booked: Resources | undefined, base: Resources): Resources =>
	Object.fromEntries(
		Object.entries(base).map(([r, v]) => [r, booked && v > 0 ? (booked[r] ?? 0) / v : 1])
	);
const times = (r: Resources, f: Resources) =>
	Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v * (f[k] ?? 1)]));

/** Output per group a modifier can target, from the budget: jobs (income only) and stations. */
export function groupFlows(save: Snapshot): GroupFlows {
	const data = getGameData();
	const budget = save.budget ?? [];
	const byJob = jobFlows(
		(save.planetBudget ?? []).map((b) => ({ ...b, expenses: {} })),
		data.jobs
	);
	const out: GroupFlows = { jobs: sum(Object.values(byJob)) };
	for (const [job, flows] of Object.entries(byJob)) {
		out[jobGroup(job)] = add(out[jobGroup(job)] ?? {}, flows);
		const stratum = data.jobs[job]?.category;
		if (stratum) out[`stratum:${stratum}`] = add(out[`stratum:${stratum}`] ?? {}, flows);
	}
	const income = (source: string) => budget.find((b) => b.source === source)?.income ?? {};
	out.station_gatherers = income('orbital_mining_deposits');
	out.station_researchers = income('orbital_research_deposits');
	out.station = add(out.station_gatherers, out.station_researchers);
	return out;
}

/** Starbase modules and buildings of the types we have (so unlocked), where a slot is free. */
function starbaseOptions(save: Snapshot): ProduceOption[] {
	const data = getGameData();
	const stations = save.stations ?? [];
	const booked = (source: string) => save.budget?.find((b) => b.source === source);
	return (
		[
			['module', 'modules', 'starbase_modules', data.costs.module],
			['starbase_building', 'buildings', 'starbase_buildings', data.costs.starbaseBuilding]
		] as const
	).flatMap(([kind, field, source, costs]) => {
		const built = stations.flatMap((st) => st[field]);
		// what the budget books for them against their base values, per resource
		const output = ratio(booked(source)?.income, sum(built.map((k) => costs[k]?.produces ?? {})));
		const upkeep = ratio(booked(source)?.expenses, sum(built.map((k) => costs[k]?.upkeep ?? {})));
		const free = stations
			.map((st) => ({ st, free: (data.starbaseSlots[st.level]?.[field] ?? 0) - st[field].length }))
			.filter((x) => x.free > 0);
		if (!free.length) return [];
		return [...new Set(built)].sort().flatMap((key): ProduceOption[] => {
			const c = costs[key];
			if (!c || !Object.keys(c.produces).length) return [];
			const measured = built.length > 0 && booked(source) !== undefined;
			return [
				{
					id: `${kind}:${key}`,
					kind,
					what: key,
					label: data.names[key] ?? pretty(key),
					where: free[0].st.system,
					colony: null,
					count: free.reduce((s, x) => s + x.free, 0),
					cost: c.cost,
					upkeep: measured ? times(c.upkeep, upkeep) : c.upkeep,
					output: measured ? times(c.produces, output) : c.produces,
					pops: 0,
					days: data.buildDays[key] ?? 180,
					groups: [kind],
					basis: measured ? 'measured' : 'base'
				}
			];
		});
	});
}

/** Clearing a blocker and building a district in the room it makes, per district type. */
function blockerOptions(save: Snapshot, staffed: (jobs: Record<string, number>) => Resources) {
	const data = getGameData();
	const { hints } = colonyBlockerHints(save.colonies, save.progress?.researched ?? []);
	const factor = paidFactor(save, 'district');
	return hints
		.filter((h) => !blocked(h) && !h.clearing)
		.flatMap((h): ProduceOption[] => {
			const colony = save.colonies.find((c) => c.planetId === h.planetId);
			const caps = colonyDetails(colony)?.caps;
			if (!colony || !caps) return [];
			return caps.types.flatMap((t): ProduceOption[] => {
				const jobs = data.districtJobs[t.district];
				const room = t.cap === null ? h.districts : Math.min(h.districts, t.cap - t.built);
				if (!jobs || room <= 0) return [];
				const d = data.costs.district[t.district];
				return [
					{
						id: `blocker:${h.planetId}:${h.blocker}:${t.district}`,
						kind: 'blocker',
						what: t.district,
						label: `${data.names[h.blocker] ?? pretty(h.blocker)} → ${data.names[t.district] ?? pretty(t.district)}`,
						where: colony.name,
						colony: colony.planetId,
						count: room,
						// the blocker once, then each district
						cost: add(h.cost, d?.cost ?? {}, factor),
						upkeep: d?.upkeep ?? {},
						output: staffed(jobs),
						pops: Object.values(jobs).reduce((a, b) => a + b, 0),
						days: (h.days ?? 0) + (data.buildDays[t.district] ?? 240),
						groups: ['blocker', 'district'],
						basis: 'measured'
					}
				];
			});
		});
}

/** Edicts we could enact now: what their output modifiers add to what we yield today. */
function edictOptions(save: Snapshot, flows: GroupFlows): ProduceOption[] {
	const data = getGameData();
	return edictRows(data.edicts, save, facts(save, data.scriptedTriggers))
		.filter((e) => !e.active && e.possible !== false && e.unlocked)
		.flatMap((e): ProduceOption[] => {
			const output = changeGain(changesOf(e.name, 0, data.edictModifiers[e.key] ?? {}), flows);
			if (!Object.keys(output).length) return [];
			return [
				{
					id: `edict:${e.key}`,
					kind: 'edict',
					what: e.key,
					label: e.name,
					where: 'empire',
					colony: null,
					count: 1,
					cost: e.cost.cost ?? {},
					upkeep: e.cost.upkeep ?? {},
					output,
					pops: 0,
					days: 0,
					groups: ['edict'],
					basis: 'estimated'
				}
			];
		});
}

export function produceData(b: NonNullable<ReturnType<typeof branch>>) {
	const t = tradeoffData(b);
	const save = b.snaps.findLast((s) => s.kind === 'save' && s.budget !== null) ?? null;
	if (!t || !save) return null;
	const { staffed, unmeasured } = jobMeasure(save);
	const options: ProduceOption[] = [
		...t.options.map((o) => ({ ...o, basis: 'measured' as const })),
		...starbaseOptions(save),
		...blockerOptions(save, staffed),
		...edictOptions(save, groupFlows(save))
	];
	const fee = save.market ? (marketFee(save)?.fee ?? null) : null;
	const resources = [
		...new Set(options.flatMap((o) => [...Object.keys(o.output), ...Object.keys(o.cost)]))
	];
	return {
		date: save.date,
		options,
		unmeasured: [...new Set([...t.unmeasured, ...unmeasured])].sort(),
		order: stripOrder(resources),
		market: save.market
			? {
					galactic: save.market.galactic,
					fee,
					// trade per unit, fee included: what buying one unit costs today
					buy: Object.fromEntries(
						resources.flatMap((r) => {
							const p = price(r, save.market!.fluctuations[r] ?? 0);
							return p === null ? [] : [[r, p * (1 + (fee ?? 0))]];
						})
					)
				}
			: null
	};
}
