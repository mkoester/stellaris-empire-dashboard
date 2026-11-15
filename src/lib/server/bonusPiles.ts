import {
	defaultPreset,
	matchLines,
	partSum,
	presets,
	type BonusLine,
	type Effect,
	type Part,
	type Preset
} from '#lib/bonusPiles.ts';
import { pretty } from '#lib/format.ts';
import { categoryChain, sourceTotals } from '#lib/outputBonuses.ts';
import { classify } from '#lib/researchBonuses.ts';
import type { Explanation, GameData, Snapshot } from '#lib/types.ts';
import type { branch } from './branch.ts';
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
};

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
function jobOutput(s: Snapshot, data: GameData, explain: Record<string, Explanation>): Card[] {
	const colonies = outputModel(s, data, explain);
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
 * Upkeep by economic category: `<category>_upkeep_mult` and `<category>_<resource>_upkeep_mult`
 * reach the category and every one below it (common/economic_categories README; the same tree as
 * output). A budget source is a category, so its expenses are what the pile acts on. One card per
 * category the game data has an upkeep bonus for, with expenses under it.
 */
function upkeep(
	s: Snapshot,
	data: GameData,
	explain: Record<string, Explanation>,
	sources: ReturnType<typeof empireSources>
): Card[] {
	const cats = data.categoryParents;
	// a key's category and resource: the longest category it starts with
	const parse = (k: string): { cat: string; res: string | null } | null => {
		const m = /^(\w+)_upkeep_mult$/.exec(k);
		if (!m) return null;
		if (m[1] in cats) return { cat: m[1], res: null };
		const cat = Object.keys(cats)
			.filter((c) => m[1].startsWith(`${c}_`))
			.sort((a, b) => b.length - a.length)[0];
		return cat ? { cat, res: m[1].slice(cat.length + 1) } : null;
	};
	const budget = (s.budget ?? []).filter((x) => x.source in cats);
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
				return Object.entries(x.expenses)
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
					id: `upkeep-${cat}`,
					group: 'Upkeep',
					title: pretty(cat),
					effect: 'cost',
					unit: 'pct',
					measure: 'a month',
					lines,
					parts,
					presets: presets(explain, (k) => {
						const p = parse(k);
						return p?.cat === cat ? { target: p.res } : null;
					}),
					estimated:
						'the pile counts the empire-wide bonuses only (not a building’s or a planet’s own, nor the penalty over naval or starbase capacity)'
				}
			];
		})
		.sort(
			(a, b) =>
				b.parts.reduce((t, p) => t + (p.base ?? 0), 0) -
				a.parts.reduce((t, p) => t + (p.base ?? 0), 0)
		);
}

function growth(
	snaps: Snapshot[],
	explain: Record<string, Explanation>,
	sources: ReturnType<typeof empireSources>
): Card[] {
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
	sources: ReturnType<typeof empireSources>
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
	data: GameData,
	explain: Record<string, Explanation>,
	sources: ReturnType<typeof empireSources>
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
	const cards: Card[] = [
		...research(b.snaps, b, data, explain),
		...jobOutput(s, data, explain),
		...upkeep(s, data, explain, sources),
		...growth(b.snaps, explain, sources),
		...(inputs ? wellbeing(inputs.gestalt, explain, sources) : []),
		...speeds(s, data, explain, sources)
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
