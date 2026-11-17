import { fmt, pretty } from './format.ts';
import { describe, evaluate, type Facts, type Trigger } from './triggers.ts';
import type { Resources } from './types.ts';

// What anomalies, special projects and dig-site chapters lead to: the effect trees of the data
// DB's `outcome` table (stellaris-data-extraction `extractor/outcomes.py` documents the node
// kinds), the markers that say what kind of outcome it is, and their text. Pure.

type Named = { k: string; name: string | null };
// w_if: a conditional branch's weight while its conditions hold (data DBs since the outcome tree).
// `c`: the condition on our empire (data DBs since 2026-11-17), read by `resolve()`, which drops it
// and marks `off` what this empire cannot get (`why`: the condition, readable).
export type Branch = {
	w: number;
	cond: boolean;
	w_if?: number;
	c?: Trigger;
	off?: boolean;
	e: OutcomeNode[];
};
export type Option = {
	name: string | null;
	cond: boolean;
	c?: Trigger;
	off?: boolean;
	why?: string;
	e: OutcomeNode[];
};
export type OutcomeNode =
	| { t: 'res'; r: string; n: number; scaled?: boolean }
	| { t: 'months'; r: string; n?: number; min?: number; max?: number }
	| ({ t: 'tech'; p?: number } & Named)
	| ({ t: 'modifier'; days?: number } & Named)
	| ({ t: 'project'; sub?: OutcomeNode[] } & Named)
	| ({ t: 'option' | 'deposit' | 'trait' | 'specimen' | 'relic' | 'pc' | 'megastructure' } & Named)
	| { t: 'clear_deposits' | 'leader' | 'pops' | 'species' | 'kill_leader' | 'destroy' }
	| { t: 'xp'; n: number }
	| { t: 'fleet'; mine: boolean }
	| { t: 'note'; text: string }
	| { t: 'random'; b: Branch[] }
	| {
			t: 'if';
			b: OutcomeNode[][];
			else: boolean;
			c?: (Trigger | null)[];
			taken?: (boolean | null)[];
	  }
	| {
			t: 'event';
			id: string;
			title: string | null;
			delay?: number;
			c?: Trigger;
			off?: boolean;
			why?: string;
			e: OutcomeNode[];
			o: Option[];
	  }
	| { t: 'later'; days: number; e: OutcomeNode[] }
	| { t: 'ref'; id: string; title: string | null; shared?: boolean }
	| { t: 'chapter'; n: number; difficulty: number | null; e: OutcomeNode[] };

export type Marker = 'fixed' | 'random' | 'choice' | 'depends' | 'project' | 'later' | 'risk';

export const MARKERS: Record<Marker, { label: string; title: string; color: string }> = {
	fixed: {
		label: 'known',
		title: 'One outcome: no chance, no choice, nothing depending on your empire',
		color: '#1baf7a'
	},
	random: { label: 'random', title: 'Chance decides between outcomes', color: '#a855f7' },
	choice: { label: 'choice', title: 'You pick between options on the way', color: '#3b82f6' },
	depends: {
		label: 'depends',
		title: 'What happens depends on your empire, the scientist or the planet',
		color: '#eda100'
	},
	project: {
		label: 'project',
		title: 'Leads on to a further special project (its outcome is included)',
		color: '#64748b'
	},
	later: { label: 'later', title: 'Something pays off a year or more later', color: '#0ea5e9' },
	risk: {
		label: 'risk',
		title:
			'Can cost a leader, a ship or resources, or bring a fleet that is not yours (in some branch)',
		color: '#e34948'
	}
};
const ORDER: Marker[] = ['fixed', 'random', 'choice', 'depends', 'project', 'later', 'risk'];

/** Project nodes with their project's own tree as `sub`, recursively; a project seen higher up
 * stays bare (the game's chains can loop back). */
export function withProjects(
	tree: OutcomeNode[],
	projects: Record<string, OutcomeNode[]>,
	seen: ReadonlySet<string> = new Set()
): OutcomeNode[] {
	const go = (list: OutcomeNode[], seen: ReadonlySet<string>): OutcomeNode[] =>
		list.map((n) => {
			switch (n.t) {
				case 'project': {
					const sub = projects[n.k];
					return sub && !seen.has(n.k)
						? { ...n, sub: go(sub, new Set([...seen, n.k])) }
						: { ...n, sub: undefined };
				}
				case 'random':
					return { ...n, b: n.b.map((b) => ({ ...b, e: go(b.e, seen) })) };
				case 'if':
					return { ...n, b: n.b.map((b) => go(b, seen)) };
				case 'event':
					return { ...n, e: go(n.e, seen), o: n.o.map((o) => ({ ...o, e: go(o.e, seen) })) };
				case 'later':
				case 'chapter':
					return { ...n, e: go(n.e, seen) };
				default:
					return n;
			}
		});
	return go(tree, seen);
}

// Conditions whose answer stays as it is through an event chain: what the empire is. Anything
// else (a flag, a tech, a modifier) the chain itself may bring, so its absence now is no answer.
const STABLE = new Set([
	'always',
	'has_ethic',
	'has_civic',
	'has_valid_civic',
	'has_origin',
	'has_authority',
	'has_government',
	'host_has_dlc',
	'is_country_type',
	'is_gestalt',
	'is_machine_empire',
	'is_hive_empire',
	'is_individual_machine',
	'is_megacorp',
	'is_homicidal',
	'is_nomadic',
	'is_wilderness_empire',
	'is_democratic_authority',
	'is_oligarchic_authority',
	'is_imperial_authority',
	'is_dictatorial_authority'
]);
const ETHIC =
	/^is_(fanatic_)?[a-z]+ist$|^is_xeno(phile|phobe)$|^is_egalitarian$|^is_authoritarian$/;

/** Whether a condition holds for this empire through the chain: `evaluate()`, except that a
 * condition the chain may still bring about (a flag, a tech) is unknown while it is false. */
export function holds(t: Trigger, f: Facts): boolean | null {
	if ('leaf' in t) {
		const v = evaluate(t, f);
		return v === false && !STABLE.has(t.leaf) && !ETHIC.test(t.leaf) ? null : v;
	}
	const vals = t.args.map((a) => holds(a, f));
	const all = vals.includes(false) ? false : vals.includes(null) ? null : true;
	if (t.op === 'not') return all === null ? null : !all;
	if (t.op === 'and') return all;
	return vals.includes(true) ? true : vals.includes(null) ? null : false;
}

/** A tree read against this empire: options and events it cannot get `off` (with `why`),
 * a conditional branch's weight settled where its condition is known, an `if` chain's `taken`
 * branches. The conditions are dropped; without them (an older data DB) nothing changes. */
export function resolve(
	tree: OutcomeNode[],
	f: Facts,
	names: Record<string, string> = {}
): OutcomeNode[] {
	const gate = <T extends { c?: Trigger }>(x: T) => {
		const { c, ...rest } = x;
		if (!c) return rest;
		return holds(c, f) === false ? { ...rest, off: true, why: describe(c, names) } : rest;
	};
	const go = (list: OutcomeNode[]): OutcomeNode[] =>
		list.map((n): OutcomeNode => {
			switch (n.t) {
				case 'event':
					return { ...gate(n), e: go(n.e), o: n.o.map((o) => ({ ...gate(o), e: go(o.e) })) };
				case 'random':
					return {
						...n,
						b: n.b.map((b) => {
							const { c, ...rest } = b;
							const ok = c ? holds(c, f) : null;
							const settled =
								ok === null ? rest : { w: ok ? (b.w_if ?? b.w) : b.w, cond: false, e: rest.e };
							return {
								...settled,
								e: go(b.e),
								...(settled.w === 0 && !settled.cond ? { off: true } : {})
							};
						})
					};
				case 'if': {
					const { c, ...rest } = n;
					const own = n.b.map((_, i) => {
						const lim = c?.[i];
						if (lim) return holds(lim, f);
						return n.else && i === n.b.length - 1 ? true : null; // else: holds if reached
					});
					// a branch is taken when every earlier one is not and its own limit holds
					const taken: (boolean | null)[] = [];
					let reached: boolean | null = true;
					for (const v of own) {
						taken.push(reached === false || v === false ? false : reached && v ? true : null);
						reached = reached === false || v === true ? false : v === null ? null : reached;
					}
					return { ...rest, b: n.b.map(go), ...(c ? { taken } : {}) };
				}
				case 'later':
				case 'chapter':
					return { ...n, e: go(n.e) };
				case 'project':
					return n.sub ? { ...n, sub: go(n.sub) } : n;
				default:
					return n;
			}
		});
	return go(tree);
}

/** A resolved tree with what this empire cannot get left out: `off` events, options and branches,
 * the `if` branches not taken, a settled branch or taken `if` branch in its node's place. */
export function prune(tree: OutcomeNode[]): OutcomeNode[] {
	const go = (list: OutcomeNode[]): OutcomeNode[] =>
		list.flatMap((n): OutcomeNode[] => {
			switch (n.t) {
				case 'event':
					return n.off
						? []
						: [
								{
									...n,
									e: go(n.e),
									o: n.o.filter((o) => !o.off).map((o) => ({ ...o, e: go(o.e) }))
								}
							];
				case 'random': {
					const b = n.b.filter((x) => !x.off).map((x) => ({ ...x, e: go(x.e) }));
					if (b.length === 1 && !b[0].cond) return b[0].e;
					return b.some((x) => x.e.length) ? [{ ...n, b }] : [];
				}
				case 'if': {
					const t = n.taken;
					const at = t?.indexOf(true) ?? -1;
					if (at >= 0) return go(n.b[at]);
					if (!t) return [{ ...n, b: n.b.map(go) }];
					const keep = n.b.map((_, i) => i).filter((i) => t[i] !== false);
					if (!keep.some((i) => n.b[i].length)) return [];
					return [
						{
							...n,
							b: keep.map((i) => go(n.b[i])),
							taken: keep.map((i) => t[i]),
							else: n.else && keep.includes(n.b.length - 1)
						}
					];
				}
				case 'later':
				case 'chapter':
					return [{ ...n, e: go(n.e) }];
				case 'project':
					return [n.sub ? { ...n, sub: go(n.sub) } : n];
				default:
					return [n];
			}
		});
	return go(tree);
}

/** Every node of a tree, depth first, into projects' `sub`. */
export function* nodes(list: OutcomeNode[]): Generator<OutcomeNode> {
	for (const n of list) {
		yield n;
		switch (n.t) {
			case 'random':
				for (const b of n.b) yield* nodes(b.e);
				break;
			case 'if':
				for (const b of n.b) yield* nodes(b);
				break;
			case 'event':
				yield* nodes(n.e);
				for (const o of n.o) yield* nodes(o.e);
				break;
			case 'later':
			case 'chapter':
				yield* nodes(n.e);
				break;
			case 'project':
				if (n.sub) yield* nodes(n.sub);
				break;
			default:
				break;
		}
	}
}

/** Whether an event lets the player pick: two options open to one empire — every unconditional
 * option, and the conditional ones counted as one (they are mostly variants: a Devouring Swarm's
 * "Eat the orb." beside "Study the orb."). */
export const isChoice = (o: Option[]) =>
	o.filter((x) => !x.cond).length + (o.some((x) => x.cond) ? 1 : 0) >= 2;

/** What kind of outcome a tree is, in display order. `fixed` only without chance, choice or a
 * condition anywhere — the projects it leads to included. */
export function markers(tree: OutcomeNode[]): Marker[] {
	const found = new Set<Marker>();
	for (const n of nodes(tree)) {
		switch (n.t) {
			case 'random':
				if (n.b.length > 1) found.add('random');
				if (n.b.some((b) => b.cond)) found.add('depends');
				break;
			case 'if':
				found.add('depends');
				break;
			case 'event':
				if (isChoice(n.o)) found.add('choice');
				if (n.o.some((o) => o.cond)) found.add('depends');
				if ((n.delay ?? 0) >= 360) found.add('later');
				break;
			case 'later':
				found.add('later');
				break;
			case 'project':
				found.add('project');
				break;
			case 'kill_leader':
			case 'destroy':
				found.add('risk');
				break;
			case 'fleet':
				if (!n.mine) found.add('risk');
				break;
			case 'res':
				if (n.n < 0) found.add('risk');
				break;
			default:
				break;
		}
	}
	if (!found.has('random') && !found.has('choice') && !found.has('depends')) found.add('fixed');
	return ORDER.filter((m) => found.has(m));
}

/** The heading of an `if` chain's branch `i` of `count`. */
export const ifLabel = (i: number, count: number, hasElse: boolean) =>
	i === 0 ? 'depending on your empire:' : i === count - 1 && hasElse ? 'otherwise:' : 'or:';

/** How likely each branch of a random node is: percentages when no branch has conditions, else
 * the weights — a conditional one's while its conditions hold (the Mineral Cluster's outcomes
 * are 0, or 1 for a scientist without the trait one gives). */
export function branchLabels(b: Branch[]): string[] {
	if (!b.some((x) => x.cond)) {
		const total = b.reduce((s, x) => s + x.w, 0);
		return b.map((x) => (total > 0 ? `${Math.round((x.w / total) * 100)} %` : 'by chance'));
	}
	return b.map((x) =>
		!x.cond
			? `weight ${fmt(x.w)}`
			: x.w_if === undefined
				? 'if conditions hold'
				: `weight ${fmt(x.w_if)} if conditions hold${x.w !== x.w_if ? `, else ${fmt(x.w)}` : ''}`
	);
}

const resource = (r: string) => pretty(r);
const name = (n: Named) => n.name ?? pretty(n.k);
const pct = (p: number) => `${fmt(p * 100)} %`;
const NO_MAX = 100000; // the game's "no maximum" for months of income

/** A duration in days, as the game counts them (360 a year). */
export function duration(days: number): string {
	if (days < 0) return 'permanent';
	if (days >= 360) return `${fmt(days / 360)} year${days === 360 ? '' : 's'}`;
	if (days >= 30) return `${fmt(days / 30)} month${days === 30 ? '' : 's'}`;
	return `${days} day${days === 1 ? '' : 's'}`;
}

type Months = Extract<OutcomeNode, { t: 'months' }>;

/**
 * What a months-of-income reward comes to at this gross monthly income: months × income (a loss
 * counts as none), within its min and max; null when the months or the income are unknown.
 */
export function monthsNow(n: Months, income: Resources | null | undefined): number | null {
	const per = income?.[n.r];
	if (per === undefined || n.n === undefined) return null;
	return Math.min(Math.max(n.n * Math.max(per, 0), n.min ?? 0), n.max ?? Infinity);
}

/**
 * What rewards come to for this empire now, for the ≈ after them: `income` its gross monthly
 * income; `tech(key)` the tech's cost at our current cost factors, its field and what we research
 * in that field a month — null for a tech researched or unknown.
 */
export type Now = {
	income: Resources | null;
	tech?: (key: string) => { cost: number; area: string; perMonth: number | null } | null;
};

type TechNow = ReturnType<NonNullable<Now['tech']>>;
/** `Now` as data, for a page: the techs looked up beforehand. */
export type NowTable = { income: Resources | null; techs: Record<string, TechNow> };

/** The techs these trees give progress in, looked up once, for a page (a function does not serialise). */
export function nowTable(now: Now, trees: OutcomeNode[][]): NowTable {
	const techs: Record<string, TechNow> = {};
	for (const tree of trees)
		for (const n of nodes(tree))
			if (n.t === 'tech' && n.p !== undefined && !(n.k in techs))
				techs[n.k] = now.tech?.(n.k) ?? null;
	return { income: now.income, techs };
}

export const fromTable = (t: NowTable): Now => ({
	income: t.income,
	tech: (k) => t.techs[k] ?? null
});

/**
 * A tech progress reward as research: its share of the tech's cost, and the days our own research
 * in its field takes to make that much; null without the data.
 */
export function techNow(n: Extract<OutcomeNode, { t: 'tech' }>, now?: Now | null) {
	const t = n.p !== undefined ? now?.tech?.(n.k) : null;
	if (!t || n.p === undefined) return null;
	const points = n.p * t.cost;
	return { points, area: t.area, days: t.perMonth ? (points / t.perMonth) * 30 : null };
}

/**
 * A months-of-income reward in three parts, for the frontier to grey the bounds: the reward, what
 * it comes to now (" ≈ +540 now", an estimate on this month's income, '' without one) and the
 * bounds (" (min 30)", or '').
 */
export function monthsParts(n: Months, now?: Now | null) {
	const income = now?.income;
	const bounds = [
		n.min !== undefined ? `min ${fmt(n.min)}` : null,
		n.max !== undefined && n.max < NO_MAX ? `max ${fmt(n.max)}` : null
	].filter(Boolean);
	const amount = monthsNow(n, income);
	return {
		main: `${n.n !== undefined ? `${n.n} months of` : 'months of'} ${resource(n.r)} income`,
		now: amount === null ? '' : ` ≈ +${fmt(Math.round(amount))} now`,
		bounds: bounds.length ? ` (${bounds.join(', ')})` : ''
	};
}

/** " ≈ 312 physics, 2.5 months of ours": a tech progress reward as research now, or ''. */
export function techNowText(n: Extract<OutcomeNode, { t: 'tech' }>, now?: Now | null): string {
	const t = techNow(n, now);
	if (!t) return '';
	const days = t.days !== null ? `, ${duration(Math.max(1, Math.round(t.days)))} of ours` : '';
	return ` ≈ ${fmt(Math.round(t.points))} ${t.area}${days}`;
}

/**
 * One effect as a line, or null for nodes with structure (events, branches) or nothing to say;
 * `now` adds what a months-of-income or tech progress reward comes to for us now (≈).
 */
export function effectText(n: OutcomeNode, now?: Now | null): string | null {
	switch (n.t) {
		case 'res':
			return `${n.n > 0 ? '+' : ''}${fmt(n.n)} ${resource(n.r)}${n.scaled ? ' (scaled)' : ''}`;
		case 'months': {
			const m = monthsParts(n, now);
			return `${m.main}${m.now}${m.bounds}`;
		}
		case 'tech':
			return n.p !== undefined
				? `+${pct(n.p)} ${name(n)}${techNowText(n, now)}`
				: `tech ${name(n)}`;
		case 'option':
			return `${name(n)} as research option`;
		case 'deposit':
			return `deposit ${name(n)}`;
		case 'clear_deposits':
			return 'deposits cleared';
		case 'modifier':
			return `${name(n)}${n.days !== undefined ? ` (${duration(n.days)})` : ''}`;
		case 'trait':
			return `trait ${name(n)}`;
		case 'xp':
			return `+${fmt(n.n)} leader experience`;
		case 'specimen':
			return `specimen ${name(n)}`;
		case 'relic':
			return `relic ${name(n)}`;
		case 'pc':
			return `planet becomes ${name(n)}`;
		case 'megastructure':
			return `megastructure ${name(n)}`;
		case 'project':
			return `special project ${name(n)}`;
		case 'leader':
			return 'a new leader';
		case 'pops':
			return 'new pops';
		case 'species':
			return 'species modified';
		case 'kill_leader':
			return 'a leader dies';
		case 'destroy':
			return 'a ship or fleet is destroyed';
		case 'fleet':
			return n.mine ? 'a fleet joins you' : 'a fleet appears (not yours)';
		case 'note':
			return n.text;
		case 'ref':
			return n.title ? `→ ${n.title}` : `→ ${n.id}`;
		default:
			return null;
	}
}

/** Popup reference of an effect's name (`tech:<key>`, …) where the dashboard has a card. */
export function effectRef(n: OutcomeNode): string | null {
	switch (n.t) {
		case 'tech':
		case 'option':
			return `tech:${n.k}`;
		case 'modifier':
			return `modifier:${n.k}`;
		case 'trait':
			return `ltrait:${n.k}`;
		case 'deposit':
			return `deposit:${n.k}`;
		default:
			return null;
	}
}

/** A list with a research option and progress on the same tech folded into the progress line
 * ("+10 % Gravitic Sensors, as research option"), and shared side events left out. */
export function displayList(list: OutcomeNode[]): OutcomeNode[] {
	const progressed = new Set(list.flatMap((n) => (n.t === 'tech' ? [n.k] : [])));
	return list.filter(
		(n) => !(n.t === 'option' && progressed.has(n.k)) && !(n.t === 'ref' && n.shared)
	);
}

/** The distinct rewards anywhere in a tree, as text — the one-line summary. */
export function rewards(tree: OutcomeNode[], now?: Now | null): string[] {
	const out: string[] = [];
	for (const n of nodes(tree)) {
		if (n.t === 'note' || n.t === 'ref' || n.t === 'project') continue;
		const t = effectText(n, now);
		if (t && !out.includes(t)) out.push(t);
	}
	return out;
}

const MAX_LINES = 40;

/** A tree as indented plain text with its markers first — for tooltips (`title`), where markup
 * cannot go. Long trees are cut after MAX_LINES lines. */
export function outcomeText(
	tree: OutcomeNode[],
	chapter: number | null = null,
	now?: Now | null
): string {
	const lines: string[] = [
		markers(tree)
			.map((m) => MARKERS[m].label)
			.join(' · ')
	];
	const add = (depth: number, text: string) => lines.push(`${'  '.repeat(depth)}${text}`);
	const list = (l: OutcomeNode[], depth: number) => {
		for (const n of displayList(l)) node(n, depth);
	};
	const node = (n: OutcomeNode, depth: number) => {
		switch (n.t) {
			case 'event': {
				add(depth, `${n.title ?? n.id}${n.delay ? ` (after ${duration(n.delay)})` : ''}`);
				list(n.e, depth + 1);
				const pick = isChoice(n.o);
				for (const o of n.o) {
					if (pick || o.e.length) {
						if (pick || o.cond)
							add(
								depth + 1,
								`${pick ? '▸ ' : ''}“${o.name ?? '…'}”${o.cond ? ' (if available)' : ''}`
							);
						list(o.e, depth + (pick || o.cond ? 2 : 1));
					}
				}
				break;
			}
			case 'random': {
				const c = branchLabels(n.b);
				n.b.forEach((b, i) => {
					add(depth, `${c[i]}:${b.e.length ? '' : ' nothing'}`);
					list(b.e, depth + 1);
				});
				break;
			}
			case 'if':
				n.b.forEach((b, i) => {
					add(depth, `${ifLabel(i, n.b.length, n.else)}${b.length ? '' : ' nothing'}`);
					list(b, depth + 1);
				});
				if (!n.else) add(depth, 'otherwise: nothing');
				break;
			case 'later':
				add(depth, `after ${duration(n.days)}:`);
				list(n.e, depth + 1);
				break;
			case 'chapter':
				add(
					depth,
					`Chapter ${n.n}${n.difficulty !== null ? ` (difficulty ${n.difficulty})` : ''}${chapter === n.n ? ' ← next' : ''}`
				);
				list(n.e, depth + 1);
				break;
			case 'project':
				add(depth, `→ ${effectText(n)}`);
				if (n.sub) list(n.sub, depth + 1);
				break;
			default: {
				const t = effectText(n, now);
				if (t) add(depth, t);
			}
		}
	};
	list(tree, 0);
	return lines.length > MAX_LINES + 1
		? [...lines.slice(0, MAX_LINES), '  …'].join('\n')
		: lines.join('\n');
}
