import {
	categoryKey,
	defaultPreset,
	matchLines,
	partSum,
	presets,
	type BonusLine,
	type Effect,
	type Part,
	type Preset
} from '#lib/bonusPiles.ts';
import { empireSizeBreakdown, sizeModifiers } from '#lib/empireSize.ts';
import { toDays } from '#lib/events.ts';
import { pretty } from '#lib/format.ts';
import { categoryChain, sourceTotals } from '#lib/outputBonuses.ts';
import { classify } from '#lib/researchBonuses.ts';
import { newConstruction } from '#lib/spending.ts';
import type { Explanation, GameData, Resources, Snapshot } from '#lib/types.ts';
import type { branch } from './branch.ts';
import { sizeInputs } from './empire.ts';
import { growthData } from './growth.ts';
import { outputModel } from './outputModel.ts';
import { empireSources, researchBonuses } from './researchBonuses.ts';
import { whatIfInputs } from './whatIfs.ts';

// The bonuses tab: every pile where bonuses add up, with the lines that hold now, what the pile
// acts on (#lib/bonusPiles.ts) and the typical values from the game data. The current lines are the
// empire-wide sources the research panel counts (`empireSources()`); a colony's own (buildings,
// designation) only where the save measures their result (job output).

type Branch = NonNullable<ReturnType<typeof branch>>;
type Area = NonNullable<ReturnType<typeof researchBonuses>>[number];
type Match = (key: string) => { target: string | null } | null;

/** A card as built; the page gets it with `pick`, the preset shown first. */
export type Card = {
	id: string;
	group: string;
	title: string;
	effect: Effect | 'wellbeing';
	unit: 'pct' | 'points'; // how a bonus is written: +10 %, +5 (stability, amenities)
	measure: string; // what `base` is: 'a month' (a resource) or 'days'
	lines: BonusLine[];
	parts: Part[];
	presets: Preset[];
	estimated: string | null; // ≈: what is estimated
	modifier?: string; // wellbeing: the key `whatIf()` is run with
	// empire size: what a change of it does to the costs that grow with it (per point above `base`)
	follow?: { size: number; base: number; penalties: { label: string; per: number }[] };
};

type Sources = ReturnType<typeof empireSources>;
type Colonies = ReturnType<typeof outputModel>;

const key =
	(...keys: string[]): Match =>
	(k) =>
		keys.includes(k) ? { target: null } : null;

/** Days from months, for a time shown in days. */
const DAYS = 30;

function research(
	snaps: Snapshot[],
	b: Branch,
	data: GameData,
	explain: Record<string, Explanation>
): Card[] {
	const areas = researchBonuses(snaps, data, explain);
	if (!areas) return [];
	// time left on each area's tech in progress, from its due date
	const left = (tech: string | undefined) => {
		const u = tech ? b.upcoming.find((x) => x.ref === `tech:${tech}`) : undefined;
		return u ? u.months * DAYS : null;
	};
	const pile =
		(p: 'speed' | 'output' | 'cost', scopes: string[]): Match =>
		(k) => {
			const c = classify(k);
			if (!c || c.pile !== p || !scopes.includes(c.scope.kind)) return null;
			return { target: c.scope.kind === 'all' ? null : (c.scope as { area: string }).area };
		};
	const lines = (
		pick: (a: Area) => { name: string; value: number; scope: string; ref: string }[]
	) => {
		const seen = new Map<string, BonusLine>();
		for (const a of areas)
			for (const l of pick(a)) seen.set(`${l.ref}|${l.name}|${l.scope}`, { ...l, target: l.scope });
		return [...seen.values()];
	};
	const tech = (a: Area) => `${a.area}${a.speed.tech ? `: ${a.speed.tech.name}` : ''}`;
	return [
		{
			id: 'research-speed',
			group: 'Research',
			title: 'Research speed',
			effect: 'speed',
			unit: 'pct',
			measure: 'days',
			lines: lines((a) => a.speed.lines),
			parts: areas.map((a) => ({
				label: tech(a),
				sum: a.speed.sum,
				base: left(a.speed.tech?.key),
				targets: [a.area]
			})),
			presets: presets(explain, pile('speed', ['all', 'area'])),
			estimated: null
		},
		{
			id: 'research-cost',
			group: 'Research',
			title: 'Research cost',
			effect: 'cost',
			unit: 'pct',
			measure: 'days',
			lines: lines((a) => a.cost.lines),
			parts: areas.map((a) => ({
				label: tech(a),
				sum: a.cost.sum,
				base: left(a.speed.tech?.key),
				targets: [a.area]
			})),
			presets: presets(explain, pile('cost', ['area'])),
			estimated: null
		}
	];
}

/**
 * Job output per resource, research included: one part per job on each colony, its share of the
 * colony's booked output at the total the colony measurably gets. A bonus to an economic category
 * (`<category>_produces_mult`, `<category>_<resource>_produces_mult`) reaches the jobs under it.
 */
function jobOutput(
	colonies: Colonies,
	data: GameData,
	explain: Record<string, Explanation>
): Card[] {
	const cats = data.categoryParents;
	const resources = [
		...new Set(
			colonies.flatMap((c) => c.resources.filter((r) => r.booked > 0).map((r) => r.resource))
		)
	];
	return resources.map((res) => {
		const rows = colonies.flatMap((c) =>
			c.resources.filter((r) => r.resource === res && r.base > 0).map((r) => ({ c, r }))
		);
		const base = rows.reduce((t, x) => t + x.r.base, 0);
		const totals = sourceTotals(
			rows.flatMap((x) => x.r.jobs),
			base
		);
		const parts: Part[] = rows.flatMap(({ c, r }) =>
			r.jobs.map((j) => {
				const category = data.jobs[j.job]?.budgetSource;
				return {
					label: `${c.colony}: ${data.jobs[j.job]?.name ?? pretty(j.job)}`,
					sum: r.measured ?? r.counted,
					base: r.predicted ? (r.booked * j.output) / r.predicted : 0,
					targets: category ? categoryChain(category, cats) : [],
					resource: res
				};
			})
		);
		// a category's bonus, where one of our jobs is under it
		const reached = new Set(parts.flatMap((p) => p.targets));
		const match: Match = (k) => {
			const own = `_${res}_produces_mult`;
			const stem = k.endsWith(own)
				? k.slice(0, -own.length)
				: k.endsWith('_produces_mult')
					? k.slice(0, -'_produces_mult'.length)
					: null;
			return stem && reached.has(stem) ? { target: stem } : null;
		};
		return {
			id: `output-${res}`,
			group: res.endsWith('_research') ? 'Research' : 'Job output',
			title: res.endsWith('_research') ? `${pretty(res)} from jobs` : pretty(res),
			effect: 'output',
			unit: 'pct',
			measure: 'a month',
			lines: totals
				.filter((l) => l.kind === 'mult')
				.map((l) => ({ ref: l.name, name: l.name, value: l.value, target: null })),
			parts,
			presets: presets(explain, match),
			estimated:
				'each colony at the total it measurably gets; the lines are weighted by each job’s share of the output'
		};
	});
}

/**
 * Upkeep and the output of what is not a job, by economic category: `<category>_<side>_mult` and
 * `<category>_<resource>_<side>_mult` reach the category and every one below it
 * (common/economic_categories README; the same tree as job output). A budget source is a category,
 * so its expenses (upkeep) or income (output: stations, starbases, megastructures, what a stratum
 * makes as such — jobs have their own cards) are what the pile acts on. One card per category the
 * game data has such a bonus for, with amounts under it.
 */
function budgetCards(
	side: 'upkeep' | 'produces',
	s: Snapshot,
	data: GameData,
	explain: Record<string, Explanation>,
	sources: Sources
): Card[] {
	const cats = data.categoryParents;
	const parse = (k: string) => categoryKey(k, side, cats, new Set(Object.keys(data.resourceInfo)));
	const jobSources = new Set(Object.values(data.jobs).map((j) => j.budgetSource));
	const budget = (s.budget ?? []).filter(
		(x) => x.source in cats && (side === 'upkeep' || !jobSources.has(x.source))
	);
	const amounts = (x: (typeof budget)[number]): Resources =>
		side === 'upkeep' ? x.expenses : x.income;
	const chains = new Map(budget.map((x) => [x.source, categoryChain(x.source, cats)]));
	const offered = new Set(
		Object.values(explain).flatMap((e) => e.modifiers.flatMap((m) => parse(m.key)?.cat ?? []))
	);
	return [...offered]
		.flatMap((cat): Card[] => {
			const under = budget.filter((x) => chains.get(x.source)!.includes(cat));
			// the pile of a source's resource: every category on its chain
			const onChain =
				(src: string): Match =>
				(k) => {
					const p = parse(k);
					return p && chains.get(src)!.includes(p.cat) ? { target: p.res } : null;
				};
			const parts: Part[] = under.flatMap((x) => {
				const lines = matchLines(sources, onChain(x.source));
				return Object.entries(amounts(x))
					.filter(([, v]) => v > 0)
					.map(([res, v]) => ({
						label: pretty(x.source),
						sum: partSum(lines, { targets: [res] }),
						base: v,
						targets: [res],
						resource: res
					}));
			});
			if (!parts.length) return [];
			const lines = matchLines(sources, (k) => {
				const p = parse(k);
				return p && under.some((x) => chains.get(x.source)!.includes(p.cat))
					? { target: p.res }
					: null;
			});
			return [
				{
					id: `${side}-${cat}`,
					group: side === 'upkeep' ? 'Upkeep' : 'Other output',
					title: pretty(cat),
					effect: side === 'upkeep' ? 'cost' : 'output',
					unit: 'pct',
					measure: 'a month',
					lines,
					parts,
					presets: presets(explain, (k) => {
						const p = parse(k);
						return p?.cat === cat ? { target: p.res } : null;
					}),
					estimated:
						side === 'upkeep'
							? 'the pile counts the empire-wide bonuses only (not a building’s or a planet’s own, nor the penalty over naval or starbase capacity)'
							: 'the pile counts the empire-wide bonuses only'
				}
			];
		})
		.sort(
			(a, b) =>
				b.parts.reduce((t, p) => t + (p.base ?? 0), 0) -
				a.parts.reduce((t, p) => t + (p.base ?? 0), 0)
		);
}

/**
 * Job efficiency: extra workforce, its own pile, which multiplies with the output pile — and,
 * unlike output, scales the job's upkeep too. Each job's pile is measured: the save's
 * `bonus_workforce` ÷ the workforce pops work (automated workforce left out). One part per job and
 * resource on each colony: its booked output, and its upkeep per 100 workforce (before upkeep
 * modifiers) as a negative amount. Keys: `pop_bonus_workforce_mult` (every job),
 * `pop_cat_<stratum>_…` and `worker_and_simple_drone_cat_…` / `specialist_and_complex_drone_cat_…`
 * (by the job's category), `<job>_jobs_…` and `pop_<job>_…` (one job); a species' own
 * (`robotic_pop_…`) are not listed — the measured pile holds them.
 */
function efficiency(
	s: Snapshot,
	colonies: Colonies,
	data: GameData,
	explain: Record<string, Explanation>,
	sources: Sources
): Card[] {
	const PAIRED: Record<string, string> = {
		worker: 'worker_and_simple_drone',
		simple_drone: 'worker_and_simple_drone',
		specialist: 'specialist_and_complex_drone',
		complex_drone: 'specialist_and_complex_drone'
	};
	const targetsOf = (job: string) => {
		const cat = data.jobs[job]?.category;
		return [
			`job:${job}`,
			...(cat ? [`cat:${cat}`] : []),
			...(cat && PAIRED[cat] ? [`cat:${PAIRED[cat]}`] : [])
		];
	};
	const parts: Part[] = s.colonies.flatMap((c) => {
		const out = colonies.find((x) => x.planetId === c.planetId);
		return c.jobs.flatMap((j) => {
			const worked = j.filled - (j.automated ?? 0);
			if (worked <= 0) return [];
			const sum = (j.bonus ?? 0) / worked;
			const label = `${c.name}: ${data.jobs[j.type]?.name ?? pretty(j.type)}`;
			const made = (out?.resources ?? []).flatMap((r) => {
				const one = r.jobs.find((x) => x.job === j.type);
				return one && r.predicted
					? [{ res: r.resource, v: (r.booked * one.output) / r.predicted }]
					: [];
			});
			const used = Object.entries(data.jobResources[j.type]?.upkeep ?? {}).map(([res, per]) => ({
				res,
				v: -((j.filled + (j.bonus ?? 0)) / 100) * per
			}));
			return [...made, ...used]
				.filter((x) => x.v !== 0)
				.map((x) => ({ label, sum, base: x.v, targets: targetsOf(j.type), resource: x.res }));
		});
	});
	if (!parts.length) return [];
	const reached = new Set(parts.flatMap((p) => p.targets));
	const match: Match = (k) => {
		if (k === 'pop_bonus_workforce_mult') return { target: null };
		const m =
			/^pop_cat_(\w+)_bonus_workforce_mult$/.exec(k) ??
			/^(worker_and_simple_drone|specialist_and_complex_drone)_cat_bonus_workforce_mult$/.exec(k);
		const t = m
			? `cat:${m[1]}`
			: (/^(\w+)_jobs_bonus_workforce_mult$/.exec(k) ?? /^pop_(\w+)_bonus_workforce_mult$/.exec(k))
					?.slice(1)
					.map((x) => `job:${x}`)[0];
		return t && reached.has(t) ? { target: t } : null;
	};
	const sums = [...new Set(parts.map((p) => p.sum))];
	return [
		{
			id: 'efficiency',
			group: 'Job output',
			title: 'Job efficiency',
			effect: 'output',
			unit: 'pct',
			measure: 'a month',
			lines: matchLines(sources, match).map((l) => ({
				...l,
				target: l.target?.replace(/^(job|cat):/, '') ?? null
			})),
			parts,
			presets: presets(explain, match),
			estimated: `each job at the efficiency the save measures (${sums.length > 1 ? 'from ' : ''}${sums
				.map((x) => `+${Math.round(x * 1000) / 10} %`)
				.sort()
				.filter((_, i, a) => i === 0 || i === a.length - 1)
				.join(
					' to '
				)}); it scales upkeep as well (before upkeep modifiers); the lines are the empire-wide ones`
		}
	];
}

/**
 * Costs: what the save diffs show was paid for construction over the last year (exact, after
 * modifiers; `newConstruction()`), a month on average, by kind. A category's cost bonus
 * (`<category>_cost_mult`, `<category>_<resource>_cost_mult`) reaches it and the categories below;
 * the others are their own keys. Kinds with no construction item (megastructures, terraforming,
 * leaders, edicts, resolutions, claims) show the change relative only.
 */
function costs(
	snaps: Snapshot[],
	data: GameData,
	explain: Record<string, Explanation>,
	sources: Sources
): Card[] {
	const cats = data.categoryParents;
	const resources = new Set(Object.keys(data.resourceInfo));
	const last = snaps.at(-1)?.date;
	const first = snaps.find((x) => x.construction !== null)?.date;
	const months = last && first ? Math.min(12, Math.max(0, (toDays(last) - toDays(first)) / 30)) : 0;
	const since = last ? toDays(last) - 360 : 0;
	const items = newConstruction(snaps).filter((c) => toDays(c.date) > since);
	const onCategory =
		(cat: string): Match =>
		(k) => {
			const p = categoryKey(k, 'cost', cats, resources);
			return p && categoryChain(cat, cats).includes(p.cat) ? { target: p.res } : null;
		};
	const card = (
		id: string,
		title: string,
		match: Match,
		kinds: string[],
		targetsOf: (name: string) => string[] = () => []
	): Card => {
		const lines = matchLines(sources, match);
		const by = new Map<string, { name: string; res: string; v: number }>();
		for (const c of items.filter((x) => kinds.includes(x.kind)))
			for (const [res, v] of Object.entries(c.cost)) {
				const key = `${targetsOf(c.name).join(',')}|${res}`;
				const was = by.get(key) ?? { name: c.name, res, v: 0 };
				by.set(key, { ...was, v: was.v + v });
			}
		const parts: Part[] =
			months > 0 && by.size
				? [...by.values()].map((x) => {
						const targets = [x.res, ...targetsOf(x.name)];
						return {
							label: targetsOf(x.name).length ? pretty(x.name) : title,
							sum: partSum(lines, { targets }),
							base: x.v / months,
							targets,
							resource: x.res
						};
					})
				: [
						{
							label:
								kinds.length && months > 0
									? `nothing built in the last ${Math.round(months)} months`
									: 'any item',
							sum: partSum(lines, { targets: [] }),
							base: null,
							targets: []
						}
					];
		return {
			id: `cost-${id}`,
			group: 'Costs',
			title,
			effect: 'cost',
			unit: 'pct',
			measure: 'a month',
			lines,
			parts,
			presets: presets(explain, match),
			estimated: `what was paid over the last ${Math.round(months)} months, a month on average; the pile counts the empire-wide bonuses only`
		};
	};
	const shipMatch: Match = (k) => {
		if (k === 'starbase_shipyard_build_cost_mult') return { target: null };
		const m = /^ship_(\w+)_cost_mult$/.exec(k);
		return m ? { target: m[1] } : null;
	};
	const cat = (id: string, title: string, c: string, kinds: string[]) =>
		c in cats ? [card(id, title, onCategory(c), kinds)] : [];
	return [
		...cat('buildings', 'Buildings', 'planet_buildings', [
			'planet_building',
			'planet_upgrade_building',
			'building'
		]),
		...cat('districts', 'Districts', 'planet_districts', ['district']),
		...cat('zones', 'Zones', 'planet_zones', ['zone']),
		card('ships', 'Ships', shipMatch, ['ship', 'colony_ship'], (name) => [name]),
		card('starbase-upgrades', 'Starbase upgrades', key('starbase_upgrade_cost_mult'), [
			'starbase_upgrade'
		]),
		...cat('starbase-modules', 'Starbase modules', 'starbase_modules', ['starbase_module']),
		...cat('starbase-buildings', 'Starbase buildings', 'starbase_buildings', ['starbase_building']),
		...cat('armies', 'Armies', 'armies', ['army']),
		...cat('blockers', 'Clearing blockers', 'deposit_blockers', ['clear_deposit_blocker']),
		card('outposts', 'Outposts', key('starbase_outpost_cost_mult'), []),
		...cat('megastructures', 'Megastructures', 'megastructures', []),
		...cat('terraforming', 'Terraforming', 'terraforming', []),
		...cat('leaders', 'Leaders', 'leaders', []),
		...cat('edicts', 'Edicts', 'edicts', []),
		...cat('resolutions', 'Resolutions', 'resolutions', []),
		card('claims', 'Claims (influence)', key('country_claim_influence_cost_mult'), []),
		card('resettlement', 'Resettlement', key('pop_resettlement_cost_mult'), [])
	];
}

/**
 * Empire size: four parts, each after its own `empire_size_<part>_mult`, their sum after
 * `empire_size_mult` (#lib/empireSize.ts), from the sources the empire tab's estimate reads; scaled
 * to the save's size where that is above the floor. What a change does to the costs that grow
 * with size: +0.2 % tech and tradition cost, +0.1 % agenda cost per point above 100 (the defines).
 */
function empireSize(s: Snapshot, data: GameData, explain: Record<string, Explanation>): Card[] {
	const i = sizeInputs(s, explain);
	if (!i) return [];
	const srcs = i.ids.map((id) => ({
		ref: id,
		name: explain[id].title,
		modifiers: explain[id].modifiers
	}));
	const mods = sizeModifiers(srcs.flatMap((x) => x.modifiers));
	const b = empireSizeBreakdown(i.parts, mods, data.defines);
	const estimate = (b.colonies + b.systems + b.districts + b.pops) * (1 + b.mult);
	const floor = data.defines.EMPIRE_SIZE_FLOOR ?? 50;
	const size = s.empireSize !== null && s.empireSize > floor ? s.empireSize : estimate;
	const k = estimate > 0 ? size / estimate : 1;
	const PARTS = ['colonies', 'systems', 'districts', 'pops'] as const;
	const match: Match = (key) => {
		if (key === 'empire_size_mult') return { target: 'all' };
		const m = /^empire_size_(colonies|systems|districts|pops)_mult$/.exec(key);
		return m ? { target: m[1] } : null;
	};
	const part = (label: string, sum: number, base: number, target: string): Part => ({
		label,
		sum,
		base,
		targets: [target],
		resource: 'empire_size'
	});
	const d = data.defines;
	return [
		{
			id: 'empire-size',
			group: 'Empire size',
			title: 'Empire size',
			effect: 'cost',
			unit: 'pct',
			measure: '',
			lines: matchLines(srcs, match),
			parts: [
				...PARTS.map((p) =>
					part(p, mods[`empire_size_${p}_mult`] ?? 0, b[p] * (1 + b.mult) * k, p)
				),
				part('all of it', b.mult, size, 'all')
			],
			presets: presets(explain, match),
			estimated:
				'the size and its parts are estimated from what the dashboard can read (a species’ own modifiers, branch offices and leaders’ effects not in the lines)',
			follow: {
				size,
				base: d.EMPIRE_SIZE_BASE ?? 100,
				penalties: [
					{ label: 'tech cost', per: d.EMPIRE_SIZE_TECH_COST_PENALTY ?? 0.002 },
					{ label: 'tradition cost', per: d.EMPIRE_SIZE_TRADITION_COST_PENALTY ?? 0.002 },
					{ label: 'agenda cost', per: d.EMPIRE_SIZE_COUNCIL_AGENDA_COST_PENALTY ?? 0.001 }
				]
			}
		}
	];
}

/** Tradition cost and naval capacity: one pile each on what the save holds now. */
function empireWide(
	s: Snapshot,
	b: Branch,
	explain: Record<string, Explanation>,
	sources: Sources
): Card[] {
	const next = b.upcoming.find((u) => u.kind === 'tradition');
	const tradLines = matchLines(sources, key('tradition_cost_mult'));
	const navalLines = matchLines(sources, key('country_naval_cap_mult'));
	return [
		{
			id: 'tradition-cost',
			group: 'Empire size',
			title: 'Tradition cost',
			effect: 'cost',
			unit: 'pct',
			measure: 'days',
			lines: tradLines,
			parts: [
				{
					label: next ? `next tradition (${next.what})` : 'next tradition',
					sum: partSum(tradLines, { targets: [] }),
					base: next ? next.months * DAYS : null,
					targets: []
				}
			],
			presets: presets(explain, key('tradition_cost_mult')),
			estimated:
				'the pile counts the empire-wide bonuses only; the game floors the cost at 25 % (TRADITION_COST_MIN)'
		},
		{
			id: 'naval-cap',
			group: 'Empire size',
			title: 'Naval capacity',
			effect: 'output',
			unit: 'pct',
			measure: '',
			lines: navalLines,
			parts: [
				{
					label: 'naval capacity',
					sum: partSum(navalLines, { targets: [] }),
					base: s.navalMax,
					targets: [],
					resource: 'naval_capacity'
				}
			],
			presets: presets(explain, key('country_naval_cap_mult')),
			estimated:
				s.navalMax === null
					? 'the capacity needs the companion mod (0.6.0+): relative only'
					: 'the pile counts the empire-wide bonuses only; flat additions (`country_naval_cap_add`) are not a pile'
		}
	];
}

function growth(snaps: Snapshot[], explain: Record<string, Explanation>, sources: Sources): Card[] {
	const rows = growthData(snaps).rows;
	const card = (
		id: string,
		title: string,
		k: string,
		of: (r: (typeof rows)[number]) => number | null
	): Card => {
		const lines = matchLines(sources, key(k));
		const sum = partSum(lines, { targets: [] });
		return {
			id,
			group: 'Pops',
			title,
			effect: 'output',
			unit: 'pct',
			measure: 'a month',
			lines,
			parts: rows.flatMap((r) => {
				const v = of(r);
				return v ? [{ label: r.name, sum, base: v, targets: [], resource: 'pops' }] : [];
			}),
			presets: presets(explain, key(k)),
			estimated:
				'measured growth over the last saves; the pile counts the empire-wide bonuses only, not habitability or a colony’s own'
		};
	};
	return [
		card('growth', 'Pop growth', 'logistic_growth_mult', (r) => r.growth),
		card('assembly', 'Pop assembly', 'planet_pop_assembly_mult', (r) => r.assembly)
	].filter((c) => c.parts.length);
}

function wellbeing(
	gestalt: boolean,
	explain: Record<string, Explanation>,
	sources: Sources
): Card[] {
	const card = (id: string, title: string, k: string, unit: Card['unit']): Card => ({
		id,
		group: 'Wellbeing',
		title,
		effect: 'wellbeing',
		unit,
		measure: 'a month',
		lines: matchLines(sources, key(k)),
		parts: [],
		presets: presets(explain, key(k)),
		estimated: 'along the chain amenities → happiness → stability → job output, colony by colony',
		modifier: k
	});
	return [
		card('stability', 'Stability', 'planet_stability_add', 'points'),
		...(gestalt ? [] : [card('happiness', 'Happiness', 'pop_happiness', 'pct')]),
		card('amenities', 'Amenities', 'planet_amenities_add', 'points'),
		card('amenities-mult', 'Amenities %', 'planet_amenities_mult', 'pct')
	];
}

/** Build and other speeds: what is queued now at its base days (`GameData.buildDays`), else relative. */
function speeds(
	s: Snapshot,
	b: Branch,
	data: GameData,
	explain: Record<string, Explanation>,
	sources: Sources
): Card[] {
	const queued = (kinds: string[]) => {
		const items = [
			...s.colonies.flatMap((c) => (c.buildQueue ?? []).map((q) => ({ q, where: c.name }))),
			...(s.stations ?? []).flatMap((st) => st.queue.map((q) => ({ q, where: st.system })))
		];
		return items.filter((x) => kinds.includes(x.q.kind));
	};
	const name = (k: string) => data.names[k] ?? pretty(k);
	const card = (id: string, title: string, match: Match, parts: Part[]): Card => {
		const lines = matchLines(sources, match);
		const filled = (
			parts.length ? parts : [{ label: 'any item', sum: 0, base: null, targets: [] }]
		).map((p) => ({ ...p, sum: partSum(lines, p) }));
		return {
			id,
			group: 'Speed',
			title,
			effect: 'speed',
			unit: 'pct',
			measure: 'days',
			lines,
			parts: filled,
			presets: presets(explain, match),
			estimated:
				'the pile counts the empire-wide bonuses only (not a building’s or a planet’s own); days are the item’s base days'
		};
	};
	const items = (kinds: string[]): Part[] =>
		queued(kinds).map(({ q, where }) => ({
			label: `${name(q.name)} (${where})`,
			sum: 0,
			base: data.buildDays[q.name] ?? null,
			targets: []
		}));
	// ships: the shipyards' queues; a size's own and its class's bonuses reach it
	const ships: Part[] = (s.stations ?? []).flatMap((st) =>
		(st.shipyard?.queue ?? []).map((q) => {
			const cls = data.shipParts.sizes[q.name]?.class ?? null;
			return {
				label: `${q.design ?? name(q.name)} (${st.system})`,
				sum: 0,
				base: data.buildDays[q.name] ?? null,
				targets: [q.name, ...(cls ? [cls] : [])]
			};
		})
	);
	const shipMatch: Match = (k) => {
		if (k === 'starbase_shipyard_build_speed_mult') return { target: null };
		const m = /^(?:shipsize|shipclass)_(\w+)_build_speed_mult$/.exec(k);
		if (!m) return null;
		return { target: k.startsWith('shipclass_') ? `shipclass_${m[1]}` : m[1] };
	};
	return [
		card(
			'speed-buildings',
			'Building construction',
			key('planet_building_build_speed_mult'),
			items(['building'])
		),
		card('speed-ships', 'Ship construction', shipMatch, ships),
		card('speed-starbase', 'Starbase upgrades', key('starbase_upgrade_speed_mult'), []),
		card(
			'speed-modules',
			'Starbase modules',
			key('starbase_module_build_speed_mult'),
			items(['starbase_module'])
		),
		card('speed-armies', 'Army recruitment', key('planet_army_build_speed_mult'), items(['army'])),
		card(
			'speed-blockers',
			'Clearing blockers',
			key('planet_clear_blocker_speed_mult'),
			items(['clear_deposit_blocker'])
		),
		card('speed-megastructures', 'Megastructures', key('megastructure_build_speed_mult'), []),
		card('speed-terraforming', 'Terraforming', key('terraform_speed_mult'), []),
		card('speed-colonies', 'Colony development', key('planet_colony_development_speed_mult'), []),
		card('speed-decisions', 'Planet decisions', key('planet_decision_enact_speed_mult'), []),
		card(
			'speed-agenda',
			'Council agenda',
			key('council_agenda_progress_speed'),
			b.upcoming
				.filter((u) => u.kind === 'agenda')
				.slice(0, 1)
				.map((u) => ({ label: u.what, sum: 0, base: u.months * DAYS, targets: [] }))
		),
		card(
			'speed-excavation',
			'Excavation',
			key('ship_archaeological_site_excavation_speed_mult'),
			[]
		)
	];
}

export function bonusCards(b: Branch, data: GameData, explain: Record<string, Explanation>) {
	const s = b.snaps.findLast((x) => x.progress !== null);
	if (!s) return null;
	const sources = empireSources(s, data, explain);
	const inputs = whatIfInputs(b);
	const colonies = outputModel(s, data, explain);
	const cards: Card[] = [
		...research(b.snaps, b, data, explain),
		...efficiency(s, colonies, data, explain, sources),
		...jobOutput(colonies, data, explain),
		...budgetCards('produces', s, data, explain, sources),
		...budgetCards('upkeep', s, data, explain, sources),
		...costs(b.snaps, data, explain, sources),
		...empireSize(s, data, explain),
		...empireWide(s, b, explain, sources),
		...growth(b.snaps, explain, sources),
		...(inputs ? wellbeing(inputs.gestalt, explain, sources) : []),
		...speeds(s, b, data, explain, sources)
	];
	return {
		date: s.date,
		// each with the preset to show first: the most common that helps
		cards: cards.map((c) => ({
			...c,
			pick: defaultPreset(c.presets, c.effect === 'cost' ? -1 : 1)
		})),
		// the wellbeing cards' chain, run in the page for any value
		wellbeing: inputs && { colonies: inputs.colonies, gestalt: inputs.gestalt, rules: inputs.rules }
	};
}
