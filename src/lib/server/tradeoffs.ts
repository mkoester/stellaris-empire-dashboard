import { pretty } from '#lib/format.ts';
import { facts } from '#lib/government.ts';
import { inReach } from '#lib/techTiers.ts';
import { evaluate } from '#lib/triggers.ts';
import { jobFlows, workedJobs } from '#lib/jobs.ts';
import { changesOf, jobGroup, type Change, type TradeOption } from '#lib/tradeoffs.ts';
import type { Resources, Snapshot } from '#lib/types.ts';
import { getGameData } from './app.ts';
import type { branch } from './branch.ts';
import { campaignGalaxy } from './mapSystems.ts';
import { colonyDetails } from './planets.ts';

// The trade-offs tab's inputs, from the branch's latest full save: what can be built now (stations
// at surveyed deposits in our systems, districts where there is room, buildings we have built
// before) with base costs from the data DB and outputs measured from the budget; and what upcoming
// techs and traditions would change.

const STATIONS: Record<string, { size: string; source: string; group: string }> = {
	orbital_mining_deposits: {
		size: 'mining_station',
		source: 'station_gatherers',
		group: 'station_gatherers'
	},
	orbital_research_deposits: {
		size: 'research_station',
		source: 'station_researchers',
		group: 'station_researchers'
	}
};
// Ship sizes have no base_buildtime; the save's constructor orders count to 100.
const STATION_DAYS = 100;

const total = (r: Resources) => Object.values(r).reduce((a, b) => a + b, 0);
const scaled = (r: Resources, f: number) =>
	Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v * f]));
const add = (a: Resources, b: Resources): Resources => {
	const out = { ...a };
	for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
	return out;
};

/**
 * Jobs measured from the budget's per-job sources: what a set of positions yields when filled
 * (each job's output per working pop) and the groups a change can target. A job nobody works yet
 * yields nothing and is noted in `unmeasured`.
 */
export function jobMeasure(save: Snapshot) {
	const data = getGameData();
	const filled = workedJobs(save.colonies);
	const perPop = Object.fromEntries(
		Object.entries(jobFlows(save.planetBudget ?? [], data.jobs, filled))
			.filter(([job]) => filled[job] > 0)
			.map(([job, flows]) => [job, scaled(flows, 1 / filled[job])])
	);
	const unmeasured = new Set<string>();
	const staffed = (jobs: Record<string, number>) => {
		let out: Resources = {};
		for (const [job, n] of Object.entries(jobs)) {
			if (perPop[job]) out = add(out, scaled(perPop[job], n));
			else unmeasured.add(data.jobs[job]?.name ?? job);
		}
		return out;
	};
	const jobGroups = (jobs: Record<string, number>) => [
		'jobs',
		...Object.keys(jobs).map(jobGroup),
		...Object.keys(jobs).flatMap((j) =>
			data.jobs[j]?.category ? [`stratum:${data.jobs[j].category}`] : []
		)
	];
	return { staffed, jobGroups, unmeasured };
}

/** Costs as paid: our queued items of a kind against their base cost (1 without any). */
export function paidFactor(save: Snapshot, kind: 'district' | 'building') {
	const data = getGameData();
	const items = (save.construction ?? []).filter((c) => c.kind === kind);
	const base = items.reduce((s, c) => s + total(data.costs[kind][c.name]?.cost ?? {}), 0);
	return base > 0 ? items.reduce((s, c) => s + total(c.cost), 0) / base : 1;
}

// `ref`: its popup key (tech:, tradition:, perk:)
export type Preset = {
	label: string;
	month: number;
	source: string;
	ref: string;
	changes: Change[];
};

export function tradeoffData(b: NonNullable<ReturnType<typeof branch>>) {
	const data = getGameData();
	const save = b.snaps.findLast((s) => s.kind === 'save' && s.budget !== null) ?? null;
	if (!save?.budget) return null;
	const budget = (source: string) => save.budget!.find((s) => s.source === source);
	const nameOf = (key: string) => data.names[key] ?? pretty(key);

	// Stations: per deposit category, what one yields against its deposits' base output
	const galaxy = campaignGalaxy(save.campaign);
	const ownBodies = (galaxy?.systems ?? []).filter((s) => s.owned).flatMap((s) => s.bodies ?? []);
	const produce = (deposits: string[], category: string) =>
		deposits
			.filter((d) => data.depositCategory[d] === category)
			.reduce<Resources>((sum, d) => add(sum, data.costs.deposit[d]?.produces ?? {}), {});
	const stations: TradeOption[] = Object.entries(STATIONS).flatMap(([category, st]) => {
		const manned = ownBodies.filter((p) => p.station === true);
		const base = total(
			manned.reduce<Resources>((s, p) => add(s, produce(p.deposits, category)), {})
		);
		const income = total(budget(category)?.income ?? {});
		const factor = base > 0 && income > 0 ? income / base : 1;
		const count = manned.filter((p) => total(produce(p.deposits, category)) > 0).length;
		const paid = budget(st.source)?.expenses;
		const upkeep =
			paid && count > 0 ? scaled(paid, 1 / count) : (data.costs.ship[st.size]?.upkeep ?? {});
		return ownBodies
			.filter((p) => p.surveyed === true && p.station === false)
			.flatMap((p): TradeOption[] => {
				const yields = produce(p.deposits, category);
				if (total(yields) <= 0) return [];
				return [
					{
						id: `station:${p.id}`,
						kind: 'station',
						what: st.size,
						label: pretty(st.size),
						where: p.name,
						colony: null,
						count: 1,
						cost: data.costs.ship[st.size]?.cost ?? {},
						upkeep,
						output: scaled(yields, factor),
						pops: 0,
						days: STATION_DAYS,
						groups: ['station', st.group]
					}
				];
			});
	});

	const { staffed, jobGroups, unmeasured } = jobMeasure(save);
	const costFactor = (kind: 'district' | 'building') => paidFactor(save, kind);

	const colonies = save.colonies.filter((c) => !c.colonizing);
	const districts: TradeOption[] = colonies.flatMap((c) => {
		const caps = colonyDetails(c, save)?.caps;
		if (!caps || caps.limit === null) return [];
		const room = caps.limit - caps.built;
		return caps.types.flatMap((t): TradeOption[] => {
			const jobs = data.districtJobs[t.district];
			const free = t.cap === null ? room : Math.min(t.cap - t.blocked - t.built, room);
			if (!jobs || free <= 0) return [];
			const costs = data.costs.district[t.district];
			return [
				{
					id: `district:${c.planetId}:${t.district}`,
					kind: 'district',
					what: t.district,
					label: nameOf(t.district),
					where: c.name,
					colony: c.planetId,
					count: free,
					cost: scaled(costs?.cost ?? {}, costFactor('district')),
					upkeep: costs?.upkeep ?? {},
					output: staffed(jobs),
					pops: total(jobs),
					days: data.buildDays[t.district] ?? 240,
					groups: ['district', ...jobGroups(jobs)]
				}
			];
		});
	});

	// Buildings: the types built somewhere already (so unlocked), on the colony with most idle pops;
	// not the government ones (capital, colony shelter: one per colony, upgraded in place)
	const idle = Object.fromEntries(colonies.map((c) => [c.planetId, c.civilians]));
	const roomiest = [...colonies].sort((a, b) => b.civilians - a.civilians)[0];
	const builtTypes = [
		...new Set(
			colonies.flatMap((c) => c.districtList.flatMap((d) => d.zones.flatMap((z) => z.buildings)))
		)
	].sort();
	const buildings: TradeOption[] = roomiest
		? builtTypes.flatMap((key): TradeOption[] => {
				const jobs = data.buildingJobs[key];
				const costs = data.costs.building[key];
				if (!jobs || !costs || total(costs.cost) <= 0) return [];
				if (data.buildingCategory[key] === 'government') return [];
				return [
					{
						id: `building:${key}`,
						kind: 'building',
						what: key,
						label: nameOf(key),
						where: roomiest.name,
						colony: roomiest.planetId,
						count: 1,
						cost: scaled(costs.cost, costFactor('building')),
						upkeep: costs.upkeep,
						output: staffed(jobs),
						pops: total(jobs),
						days: data.buildDays[key] ?? 360,
						groups: ['building', ...jobGroups(jobs)]
					}
				];
			})
		: [];

	return {
		date: save.date,
		options: [...stations, ...districts, ...buildings],
		unmeasured: [...unmeasured].sort(),
		start: { stockpile: b.latest.stockpile, income: save.balance, idle },
		presets: presets(save, b.upcoming)
	};
}

/**
 * What upcoming techs and traditions change: the research queue at its due dates, every tech
 * within reach (`inReach`: prerequisites researched, tier open in its field — not the cards on
 * offer, which are chance) as if researched next in its field at the field's measured rate, and
 * the traditions open in the adopted trees at the next tradition's date.
 */
function presets(
	save: Snapshot,
	upcoming: NonNullable<ReturnType<typeof branch>>['upcoming']
): Preset[] {
	const data = getGameData();
	const out: Preset[] = [];
	const push = (label: string, month: number, source: string, key: string, ref = key) => {
		const changes = changesOf(label, month, data.growthModifiers[key] ?? {});
		if (changes.length) out.push({ label, month, source, ref, changes });
	};
	const research = upcoming.filter((e) => e.kind === 'research' && e.ref?.startsWith('tech:'));
	for (const e of research) push(e.what, Math.round(e.months), 'research queue', e.ref!);
	const f = facts(save, data.scriptedTriggers);
	const reach = inReach(save.progress?.researched ?? [], data.techs, data.techRequirements, (p) =>
		evaluate(p, f)
	);
	const queued = new Set(research.map((e) => e.ref!.slice('tech:'.length)));
	for (const t of reach.filter((t) => !queued.has(t))) {
		const now = research.find((e) => e.tint === `${data.techs[t].area}_research`);
		const current = now?.ref?.slice('tech:'.length);
		if (!now || now.total === undefined || now.done === undefined || now.months <= 0) continue;
		// research per month, and the empire's cost factor (size, galaxy setting) from the current tech
		const rate = (now.total - now.done) / now.months;
		const factor = current && data.techs[current]?.cost ? now.total / data.techs[current].cost! : 1;
		const cost = data.techs[t].cost;
		if (!cost || rate <= 0) continue;
		push(
			data.techs[t].name,
			Math.round(now.months + (cost * factor) / rate),
			'within reach',
			`tech:${t}`
		);
	}
	const next = upcoming.find((e) => e.kind === 'tradition');
	const taken = new Set(save.traditions ?? []);
	if (next)
		for (const tree of Object.values(data.traditionTrees))
			if (tree.traditions.some((t) => taken.has(t.key)))
				for (const t of tree.traditions.filter((t) => !taken.has(t.key) && t.role !== 'finish'))
					push(
						t.name,
						Math.round(next.months),
						`next tradition (${tree.name})`,
						`tradition:${t.key}`
					);
	// perks not taken, as if picked at the next tradition (when a slot opens is not in the save);
	// their modifiers sit with the traditions' in the data DB
	const perks = new Set(save.ascensionPerks ?? []);
	for (const [key, name] of Object.entries(data.perks))
		if (!perks.has(key))
			push(
				name,
				Math.round(next?.months ?? 12),
				'ascension perk, if picked',
				`tradition:${key}`,
				`perk:${key}`
			);
	return out.sort((a, b) => a.month - b.month || a.label.localeCompare(b.label));
}
