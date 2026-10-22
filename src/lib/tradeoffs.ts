import { basePrice } from './market.ts';
import type { Resources } from './types.ts';

// Where to put scarce resources: stations, districts or buildings — pure. Each option has a cost,
// an upkeep and an output per month at today's modifiers (measured from the budget where the
// empire has one already), the pops it needs and its build time. A ranking orders them by
// payback; a simulation reinvests month by month under a strategy. Changes ("−20 % district cost
// from month 8", from an upcoming tech) scale the measured numbers — an approximation: the game
// adds multipliers, so a +20 % on top of an existing +50 % is +13 % of the measured value.

export type OptionKind = 'station' | 'district' | 'building';

export type TradeOption = {
	id: string;
	kind: OptionKind;
	what: string; // key: mining_station, district_mining, building_research_lab_1
	label: string;
	where: string; // the body or the colony
	colony: number | null; // planetId whose idle pops it employs; null: needs none
	count: number; // how many can be built there (free district room); 1 otherwise
	cost: Resources; // base cost, before modifiers
	upkeep: Resources; // per month
	output: Resources; // per month, today's modifiers; the jobs' when fully staffed
	pops: number; // workers it needs
	days: number; // build time
	groups: string[]; // what a change can target: kind, station type, jobs, `job:<job>`, `stratum:<s>`
};

/** From `month` on, a group's cost, upkeep or output (one resource, or all) changes by `pct`. */
export type Change = {
	label: string;
	month: number;
	target: 'cost' | 'upkeep' | 'output';
	groups: string[];
	resource?: string;
	pct: number; // −0.2 = 20 % less
};

export type Knobs = { weights: Resources; changes: Change[]; months: number };

const NOT_TRADED = 1; // research, unity, trade: no market price, valued as one energy

/** The value of one unit of each resource, in energy: its market base price, else 1. */
export const defaultWeights = (keys: string[]): Resources =>
	Object.fromEntries(keys.map((k) => [k, basePrice(k) ?? NOT_TRADED]));

export const valueOf = (r: Resources, weights: Resources) =>
	Object.entries(r).reduce((sum, [k, v]) => sum + v * (weights[k] ?? NOT_TRADED), 0);

const applies = (c: Change, o: TradeOption, month: number, target: Change['target']) =>
	c.target === target && c.month <= month && c.groups.some((g) => o.groups.includes(g));

/** An option's cost, upkeep and output at `month`, with the changes in force by then. */
export function at(o: TradeOption, changes: Change[], month: number) {
	const scale = (r: Resources, target: Change['target']) =>
		Object.fromEntries(
			Object.entries(r).map(([k, v]) => [
				k,
				changes
					.filter((c) => applies(c, o, month, target) && (!c.resource || c.resource === k))
					.reduce((x, c) => x * (1 + c.pct), v)
			])
		);
	return {
		cost: scale(o.cost, 'cost'),
		upkeep: scale(o.upkeep, 'upkeep'),
		output: scale(o.output, 'output')
	};
}

export type Ranked = TradeOption & {
	costValue: number;
	netValue: number; // per month, output − upkeep
	payback: number | null; // months until the net has paid the cost back; null: never
};

/** The options by payback at `month` (0 = now), quickest first, never-paying last. */
export function rank(options: TradeOption[], knobs: Knobs, month = 0): Ranked[] {
	return options
		.map((o) => {
			const now = at(o, knobs.changes, month);
			const costValue = valueOf(now.cost, knobs.weights);
			const netValue = valueOf(now.output, knobs.weights) - valueOf(now.upkeep, knobs.weights);
			return { ...o, costValue, netValue, payback: netValue > 0 ? costValue / netValue : null };
		})
		.sort((a, b) => (a.payback ?? Infinity) - (b.payback ?? Infinity) || a.id.localeCompare(b.id));
}

export type Strategy = {
	name: string;
	// which option to save up for next (lower first); undefined: any order by payback
	priority?: (o: TradeOption) => number;
	// options a change will make cheaper are not bought before it
	waitFor?: Change;
	none?: true; // the baseline: build nothing
};

/** The strategies worth comparing for these options and changes. */
export function strategies(options: TradeOption[], changes: Change[]): Strategy[] {
	const kinds = [...new Set(options.map((o) => o.kind))];
	return [
		{ name: 'best payback first' },
		...kinds.map((k) => ({
			name: `${k}s first`,
			priority: (o: TradeOption) => (o.kind === k ? 0 : 1)
		})),
		...changes
			.filter((c) => c.target === 'cost' && c.pct < 0 && c.month > 0)
			.map((c) => ({ name: `best payback, waiting for ${c.label}`, waitFor: c })),
		{ name: 'build nothing', none: true }
	];
}

export type Run = {
	name: string;
	value: number[]; // per month: the stockpile's value
	net: number[]; // per month: the net income's value
	bought: { month: number; label: string }[];
};

/**
 * Month by month from today: the income is paid, then the strategy saves up for its next option
 * (the cheapest payback within its priority) and builds it once the stockpile covers the cost
 * and the colony has the idle pops; it produces once built. Pop growth, housing, free building
 * slots, stockpile caps and the build queue's one-at-a-time are not modelled.
 */
export function simulate(
	options: TradeOption[],
	start: { stockpile: Resources; income: Resources; idle: Record<number, number> },
	knobs: Knobs,
	strategy: Strategy
): Run {
	const stock: Resources = { ...start.stockpile };
	const idle = { ...start.idle };
	const left = options.flatMap((o) => Array.from({ length: o.count }, () => o));
	const built: { o: TradeOption; from: number }[] = [];
	const run: Run = { name: strategy.name, value: [], net: [], bought: [] };
	const add = (r: Resources, sign: number) => {
		for (const [k, v] of Object.entries(r)) stock[k] = (stock[k] ?? 0) + sign * v;
	};
	for (let m = 0; m <= knobs.months; m++) {
		let net: Resources = { ...start.income };
		for (const b of built.filter((b) => b.from <= m)) {
			const now = at(b.o, knobs.changes, m);
			net = sum(net, now.output, 1);
			net = sum(net, now.upkeep, -1);
		}
		if (m > 0) add(net, 1);
		run.net.push(valueOf(net, knobs.weights));
		if (!strategy.none) {
			for (;;) {
				const staffed = (o: TradeOption) => o.colony === null || (idle[o.colony] ?? 0) >= o.pops;
				const waiting = (o: TradeOption) =>
					strategy.waitFor !== undefined &&
					m < strategy.waitFor.month &&
					strategy.waitFor.groups.some((g) => o.groups.includes(g));
				const next = rank(
					left.filter((o) => staffed(o) && !waiting(o)),
					knobs,
					m
				)
					.filter((o) => o.payback !== null)
					.sort((a, b) => (strategy.priority?.(a) ?? 0) - (strategy.priority?.(b) ?? 0))[0];
				if (!next) break;
				const cost = at(next, knobs.changes, m).cost;
				if (Object.entries(cost).some(([k, v]) => (stock[k] ?? 0) < v)) break; // saving up
				add(cost, -1);
				if (next.colony !== null) idle[next.colony] -= next.pops;
				left.splice(left.indexOf(left.find((o) => o.id === next.id)!), 1);
				built.push({ o: next, from: m + Math.ceil(next.days / 30) });
				run.bought.push({ month: m, label: `${next.label} (${next.where})` });
			}
		}
		run.value.push(valueOf(stock, knobs.weights));
	}
	return run;
}

const sum = (a: Resources, b: Resources, sign: number): Resources => {
	const out = { ...a };
	for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + sign * v;
	return out;
};

// Modifier keys (techs, traditions) that change what the options cost or yield, as a Change's
// target and groups; `planet_<job>_<resource>_produces_mult` names a job (plural or singular).
const RES =
	'energy|minerals|food|alloys|consumer_goods|trade|unity|physics_research|society_research|engineering_research';
const RULES: [RegExp, (m: RegExpMatchArray) => Omit<Change, 'label' | 'month' | 'pct'>][] = [
	[/^planet_districts_cost_mult$/, () => ({ target: 'cost', groups: ['district'] })],
	[/^planet_(buildings|structures)_cost_mult$/, () => ({ target: 'cost', groups: ['building'] })],
	[/^stations_upkeep_mult$/, () => ({ target: 'upkeep', groups: ['station'] })],
	[
		/^station_(gatherers|researchers)_produces_mult$/,
		(m) => ({ target: 'output', groups: [`station_${m[1]}`] })
	],
	[/^planet_jobs_produces_mult$/, () => ({ target: 'output', groups: ['jobs'] })],
	[
		/^planet_jobs_(worker|specialist|ruler|simple_drone|complex_drone)_produces_mult$/,
		(m) => ({ target: 'output', groups: [`stratum:${m[1]}`] })
	],
	[
		new RegExp(`^planet_jobs_(${RES})_produces_mult$`),
		(m) => ({ target: 'output', groups: ['jobs'], resource: m[1] })
	],
	[
		new RegExp(`^planet_(?!jobs_)(\\w+?)_(${RES})_produces_mult$`),
		(m) => ({ target: 'output', groups: [jobGroup(m[1])], resource: m[2] })
	],
	[
		/^planet_(?!jobs_)(\w+?)_produces_mult$/,
		(m) => ({ target: 'output', groups: [jobGroup(m[1])] })
	]
];

/** A job's group: `miners`, `miner` → `job:miner`. */
export const jobGroup = (job: string) => `job:${job.toLowerCase().replace(/s$/, '')}`;

/** The changes a source's modifiers make (`{ planet_districts_cost_mult: -0.2 }`). */
export function changesOf(
	label: string,
	month: number,
	modifiers: Record<string, number>
): Change[] {
	return Object.entries(modifiers).flatMap(([key, pct]) => {
		for (const [re, make] of RULES) {
			const m = key.match(re);
			if (m) return [{ label, month, pct, ...make(m) }];
		}
		return [];
	});
}
