// The planner's goals are a log of changes (`plan_event`, migration 17), each made at the node of
// the save graph the page showed. The plan at a node is the replay of the changes along the path
// from the root to it, so a reload's branch has a plan of its own from the branch point on (the
// user's call 2026-10-31), and moving a guessed branch point on /timeline carries the plan along.
// Pure.

export const OPS = [
	'add',
	'edit',
	'remove',
	'order',
	'park',
	'unpark',
	'check',
	'uncheck'
] as const;
export type PlanOp = (typeof OPS)[number];

export type Polarity = 'want' | 'avoid';

/** What a goal is about: system, planet, tech … ids and keys, by the kind's own field names. */
export type Target = Record<string, string | number>;

export type PlanEvent = {
	id: number; // replay order
	nodeId: number; // the node shown when it was made
	at: string; // wall clock, ISO
	goal: string; // the goal's id; `group:<id>` for an order
	op: PlanOp;
	data: unknown;
};

export type GoalSpec = {
	kind: string;
	target: Target;
	polarity: Polarity;
	note?: string;
	title?: string; // the free-text goal's text, or a name of the player's own
};

export type Goal = Required<GoalSpec> & {
	id: string;
	parked: boolean; // a potential step, to plan again (not in the groups' order)
	checked: boolean; // ticked off by hand (goals no save can confirm)
	from: string | null; // the goal it was copied from, on another branch
	added: { nodeId: number; at: string };
};

export type Plan = {
	goals: Map<string, Goal>; // the goals on this branch, parked ones included, in the order added
	orders: Record<string, string[]>; // group → its goals' order as last set
	history: PlanEvent[]; // the changes along the path, oldest first
};

/**
 * One identity per kind and target, to tell whether another branch's goal is already here. A goal
 * without a target (free text) is told apart by its text.
 */
export const goalKey = (kind: string, target: Target, title = ''): string => {
	const keys = Object.keys(target).sort();
	return `${kind}:${keys.length ? keys.map((k) => `${k}=${target[k]}`).join(',') : `"${title}"`}`;
};

const obj = (v: unknown): Record<string, unknown> =>
	v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {};

/** The plan at a node: the changes whose node lies on `path` (node ids, root to tip). */
export function planAt(events: PlanEvent[], path: number[]): Plan {
	const on = new Set(path);
	const goals = new Map<string, Goal>();
	const orders: Record<string, string[]> = {};
	const history: PlanEvent[] = [];
	for (const e of [...events].sort((a, b) => a.id - b.id)) {
		if (!on.has(e.nodeId)) continue;
		const d = obj(e.data);
		const g = goals.get(e.goal);
		switch (e.op) {
			case 'add': {
				if (g || typeof d.kind !== 'string') continue;
				goals.set(e.goal, {
					id: e.goal,
					kind: d.kind,
					target: obj(d.target) as Target,
					polarity: d.polarity === 'avoid' ? 'avoid' : 'want',
					note: typeof d.note === 'string' ? d.note : '',
					title: typeof d.title === 'string' ? d.title : '',
					parked: d.parked === true,
					checked: false,
					from: typeof d.from === 'string' ? d.from : null,
					added: { nodeId: e.nodeId, at: e.at }
				});
				break;
			}
			case 'edit':
				if (!g) continue;
				if (d.polarity === 'want' || d.polarity === 'avoid') g.polarity = d.polarity;
				if (typeof d.note === 'string') g.note = d.note;
				if (typeof d.title === 'string') g.title = d.title;
				break;
			case 'remove':
				if (!g) continue;
				goals.delete(e.goal);
				break;
			case 'park':
			case 'unpark':
				if (!g) continue;
				g.parked = e.op === 'park';
				break;
			case 'check':
			case 'uncheck':
				if (!g) continue;
				g.checked = e.op === 'check';
				break;
			case 'order': {
				const group = e.goal.replace(/^group:/, '');
				orders[group] = Array.isArray(d.ids) ? d.ids.filter((x) => typeof x === 'string') : [];
				break;
			}
		}
		history.push(e);
	}
	return { goals, orders, history };
}

/**
 * The plan's open goals per group, in the order last set; goals added since go to the end, in
 * the order added. Parked goals are left out (`parked()`).
 */
export function arrange(plan: Plan, groupOf: (kind: string) => string): Record<string, Goal[]> {
	const out: Record<string, Goal[]> = {};
	const active = [...plan.goals.values()].filter((g) => !g.parked);
	for (const g of active) (out[groupOf(g.kind)] ??= []).push(g);
	for (const [group, list] of Object.entries(out)) {
		const rank = new Map((plan.orders[group] ?? []).map((id, i) => [id, i]));
		const added = new Map(list.map((g, i) => [g.id, i]));
		list.sort(
			(a, b) =>
				(rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) ||
				added.get(a.id)! - added.get(b.id)!
		);
	}
	return out;
}

export const parked = (plan: Plan): Goal[] => [...plan.goals.values()].filter((g) => g.parked);

/** A group's order with one goal moved to `index` (clamped). */
export function moved(ids: string[], id: string, index: number): string[] {
	const rest = ids.filter((x) => x !== id);
	const at = Math.max(0, Math.min(index, rest.length));
	return [...rest.slice(0, at), id, ...rest.slice(at)];
}

export type ForeignGoal = Goal & { tips: number[] };

/**
 * Goals on other branches that this one lacks — neither the same goal nor one of the same kind
 * and target — for "copy from another branch". `tips` are the other branches' last nodes, each
 * with its path; a goal on several of them is listed once, with all their tips.
 */
export function otherBranches(
	events: PlanEvent[],
	branches: { tip: number; path: number[] }[],
	here: Plan
): ForeignGoal[] {
	const haveIds = new Set(here.goals.keys());
	const haveKeys = new Set([...here.goals.values()].map((g) => goalKey(g.kind, g.target, g.title)));
	const out = new Map<string, ForeignGoal>();
	for (const b of branches) {
		for (const g of planAt(events, b.path).goals.values()) {
			const key = goalKey(g.kind, g.target, g.title);
			if (haveIds.has(g.id) || haveKeys.has(key)) continue;
			const seen = out.get(key);
			if (seen) {
				if (!seen.tips.includes(b.tip)) seen.tips.push(b.tip);
			} else out.set(key, { ...g, tips: [b.tip] });
		}
	}
	return [...out.values()];
}

/** The leaves of a campaign's save graph: nodes no other node names as parent. */
export function leaves(nodes: { id: number; parentId: number | null }[]): number[] {
	const parents = new Set(nodes.map((n) => n.parentId));
	return nodes.filter((n) => !parents.has(n.id)).map((n) => n.id);
}
