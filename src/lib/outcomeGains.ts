import { pretty } from './format.ts';
import { effectRef, effectText, nodes, type OutcomeNode } from './outcomes.ts';
import type { Resources } from './types.ts';
import { valueOf } from './value.ts';

// What open anomalies, special projects and dig sites can still bring, summed — the frontier tab's
// "Still to gain". Pure. Read on a pruned tree (`prune()` in #lib/outcomes.ts), so only what this
// empire can get counts. Per reward two amounts:
// - sure: on every path — in every branch of a random or an `if`, in the option picked;
// - expected: random branches by their odds, an unsettled `if` as even odds;
// and at an event with options the player picks the one worth most in trade.

/** One reward's amounts: resources in units, tech progress as a share, anything else a count. */
export type Amount = { sure: number; exp: number };
export type Bag = Map<string, Amount>;

export type GainContext = {
	income: Resources | null; // gross monthly income, for months of income (≈)
	values: Resources; // each resource in trade (`valuesOf()`)
	next?: number | null; // a dig site's next chapter: those before it are done
};

// rewards that are none: text, structure, losses, and what is not the player's
const SKIPPED = new Set([
	'note',
	'ref',
	'project',
	'kill_leader',
	'destroy',
	'clear_deposits',
	'species'
]);

/** A reward's key: `res:<resource>`, `tech:<key>` (progress), `xp`, else `item:<text>`. */
function leaf(n: OutcomeNode, ctx: GainContext): [string, number] | null {
	switch (n.t) {
		case 'res':
			return [`res:${n.r}`, n.n];
		case 'months': {
			const per = ctx.income?.[n.r];
			if (per === undefined || n.n === undefined) return [`item:${effectText(n)}`, 1];
			const raw = n.n * Math.max(per, 0);
			return [`res:${n.r}`, Math.min(Math.max(raw, n.min ?? 0), n.max ?? Infinity)];
		}
		case 'tech':
			return n.p !== undefined ? [`tech:${n.k}`, n.p] : [`item:${effectText(n)}`, 1];
		case 'xp':
			return ['xp', n.n];
		case 'fleet':
			return n.mine ? ['item:a fleet joins you', 1] : null;
		default: {
			if (SKIPPED.has(n.t)) return null;
			const t = effectText(n);
			return t ? [`item:${t}`, 1] : null;
		}
	}
}

const add = (a: Bag, b: Bag): Bag => {
	const out = new Map(a);
	for (const [k, v] of b) {
		const x = out.get(k) ?? { sure: 0, exp: 0 };
		out.set(k, { sure: x.sure + v.sure, exp: x.exp + v.exp });
	}
	return out;
};

/** Alternatives with their odds: expected by weight, sure only what every one gives. */
function either(bags: Bag[], weights: number[]): Bag {
	const total = weights.reduce((s, w) => s + w, 0);
	const p = weights.map((w) => (total > 0 ? w / total : 1 / weights.length));
	const out: Bag = new Map();
	for (const k of new Set(bags.flatMap((b) => [...b.keys()]))) {
		const sure = Math.min(...bags.map((b) => b.get(k)?.sure ?? 0));
		const exp = bags.reduce((s, b, i) => s + p[i] * (b.get(k)?.exp ?? 0), 0);
		out.set(k, { sure, exp });
	}
	return out;
}

/** The resources of a bag, by amount (`sure` or `exp`). */
export const resourcesOf = (bag: Bag, which: keyof Amount): Resources =>
	Object.fromEntries(
		[...bag].filter(([k]) => k.startsWith('res:')).map(([k, v]) => [k.slice(4), v[which]])
	);

/** A bag's worth in trade, by expected amounts; ties go to the bag with more rewards. */
const worth = (bag: Bag, values: Resources) =>
	valueOf(resourcesOf(bag, 'exp'), values) +
	[...bag.values()].reduce((s, v) => s + v.exp, 0) * 1e-6;

/** What a pruned tree brings. */
export function gains(tree: OutcomeNode[], ctx: GainContext): Bag {
	const list = (l: OutcomeNode[]): Bag => l.map(node).reduce(add, new Map());
	const node = (n: OutcomeNode): Bag => {
		switch (n.t) {
			case 'event': {
				const base = list(n.e);
				const options = n.o.map((o) => list(o.e));
				if (!options.length) return base;
				const best = options.reduce((a, b) =>
					worth(b, ctx.values) > worth(a, ctx.values) ? b : a
				);
				return add(base, best);
			}
			case 'random':
				return either(
					n.b.map((b) => list(b.e)),
					n.b.map((b) => b.w)
				);
			case 'if': {
				const branches = n.b.map(list);
				if (!n.else) branches.push(new Map());
				return either(
					branches,
					branches.map(() => 1)
				);
			}
			case 'chapter':
				return n.n < (ctx.next ?? 0) ? new Map() : list(n.e);
			case 'later':
				return list(n.e);
			case 'project':
				return n.sub ? list(n.sub) : new Map();
			default: {
				const r = leaf(n, ctx);
				return r ? new Map([[r[0], { sure: r[1], exp: r[1] }]]) : new Map();
			}
		}
	};
	return list(tree);
}

/** Where a reward comes from: an open anomaly, special project or dig site. */
export type GainSource = {
	name: string;
	kind: 'anomaly' | 'project' | 'dig site';
	time?: { days: number; approx: boolean } | null; // how long it takes (#lib/frontierTime.ts)
};

/** One line of the summary: a reward with its amounts and where it comes from. */
export type GainRow = {
	key: string;
	kind: 'res' | 'tech' | 'xp' | 'item';
	label: string;
	ref: string | null; // its popup (`tech:`, `modifier:` …), where the dashboard has a card
	sure: number;
	exp: number;
	approx: boolean; // rests on months of income or a scaled amount
	sources: GainSource[];
	// tech progress: the tech's tier, what it costs us now (#lib/events.ts techCost) and its area;
	// `researched`: progress on it is wasted
	tech?: { tier: number | null; cost: number | null; area: string; researched: boolean };
};

/** Rewards of several sources summed, each with the names of the sources that give it. `names`:
 * tech keys → names. Resources first, then tech progress, experience, the rest by label. */
export function gainRows(
	sources: (GainSource & { tree: OutcomeNode[]; next?: number | null })[],
	ctx: Omit<GainContext, 'next'>,
	names: Record<string, string> = {}
): GainRow[] {
	const rows = new Map<string, GainRow>();
	for (const s of sources) {
		const bag = gains(s.tree, { ...ctx, next: s.next ?? null });
		const approx = hasApprox(s.tree);
		const refs = new Map<string, string>();
		for (const n of nodes(s.tree)) {
			const k = leaf(n, ctx)?.[0];
			const ref = effectRef(n);
			if (k && ref) refs.set(k, ref);
		}
		for (const [key, v] of bag) {
			if (v.exp <= 0 && v.sure <= 0) continue;
			const kind = key.startsWith('res:')
				? 'res'
				: key.startsWith('tech:')
					? 'tech'
					: key === 'xp'
						? 'xp'
						: 'item';
			const r = rows.get(key) ?? {
				key,
				kind,
				label:
					kind === 'res'
						? pretty(key.slice(4))
						: kind === 'tech'
							? (names[key.slice(5)] ?? pretty(key.slice(5)))
							: kind === 'xp'
								? 'leader experience'
								: key.slice(5),
				ref: refs.get(key) ?? null,
				sure: 0,
				exp: 0,
				approx: false,
				sources: []
			};
			r.sure += v.sure;
			r.exp += v.exp;
			r.approx ||= kind === 'res' && approx.has(key.slice(4));
			if (!r.sources.some((x) => x.name === s.name && x.kind === s.kind))
				r.sources.push({ name: s.name, kind: s.kind, time: s.time ?? null });
			rows.set(key, r);
		}
	}
	return sorted([...rows.values()]);
}

const ORDER = { res: 0, tech: 1, xp: 2, item: 3 };
const sorted = (rows: GainRow[]) =>
	rows.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.label.localeCompare(b.label));

/** Rows of several lists (one per kind of source) as one: amounts summed, sources joined. */
export function mergeGainRows(lists: GainRow[][]): GainRow[] {
	const out = new Map<string, GainRow>();
	for (const g of lists.flat()) {
		const r = out.get(g.key);
		out.set(
			g.key,
			r
				? {
						...r,
						sure: r.sure + g.sure,
						exp: r.exp + g.exp,
						approx: r.approx || g.approx,
						sources: [...r.sources, ...g.sources]
					}
				: g
		);
	}
	return sorted([...out.values()]);
}

/** The resources a tree gives as months of income or scaled: estimates. */
const hasApprox = (tree: OutcomeNode[]) =>
	new Set(
		[...nodes(tree)].flatMap((n) => (n.t === 'months' || (n.t === 'res' && n.scaled) ? [n.r] : []))
	);
