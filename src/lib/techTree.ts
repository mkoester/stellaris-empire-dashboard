// The tech tree per research area (the user's ask 2026-11-16: "tech tree plus the +/- want
// buttons", after androdawton's stellaris-tech-tree): every tech the empire can still get, in
// columns by prerequisite depth — never left of its tier (event and Fallen Empire techs have
// none: depth alone) — and in rows ordered by their prerequisites' rows, a few sweeps of the
// barycentre heuristic, so edges cross less. A prerequisite in another area is listed on the
// node, not drawn. Pure.

export type TreeTech = {
	key: string;
	name: string;
	area: string;
	tier: number | null;
	cost: number | null;
	category: string | null;
	rare: boolean;
	dangerous: boolean;
	needs: string[]; // all of these first
	anyOf: string[][]; // and one of each group
};

export type TreeNode = TreeTech & { col: number; row: number };

export type TreeLayout = {
	nodes: TreeNode[];
	cols: number;
	rows: number;
	edges: { from: string; to: string; any: boolean }[]; // within the area; `any`: an OR prerequisite
};

const SWEEPS = 4;

/** Every prerequisite, the `OR` groups' members too. */
export const prereqs = (t: Pick<TreeTech, 'needs' | 'anyOf'>): string[] => [
	...t.needs,
	...t.anyOf.flat()
];

export function treeLayout(techs: TreeTech[], area: string): TreeLayout {
	const byKey = new Map(techs.map((t) => [t.key, t]));
	const mine = techs.filter((t) => t.area === area);
	const here = new Set(mine.map((t) => t.key));
	const local = (t: TreeTech) => prereqs(t).filter((p) => here.has(p));

	// column: 1 + the deepest prerequisite's, at least the tier; a cycle (none seen) stops at 0
	const col = new Map<string, number>();
	const visiting = new Set<string>();
	const colOf = (key: string): number => {
		const known = col.get(key);
		if (known !== undefined) return known;
		if (visiting.has(key)) return 0;
		visiting.add(key);
		const t = byKey.get(key)!;
		const deps = local(t).map((p) => colOf(p) + 1);
		const c = Math.max(t.tier ?? 0, ...deps, 0);
		visiting.delete(key);
		col.set(key, c);
		return c;
	};
	for (const t of mine) colOf(t.key);

	const cols = mine.length ? Math.max(...col.values()) + 1 : 0;
	const columns: TreeTech[][] = Array.from({ length: cols }, () => []);
	for (const t of mine) columns[col.get(t.key)!].push(t);
	for (const c of columns)
		c.sort(
			(a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name)
		);

	const row = new Map<string, number>();
	const place = () => columns.forEach((c) => c.forEach((t, i) => row.set(t.key, i)));
	place();
	const leadsTo = new Map<string, string[]>();
	for (const t of mine)
		for (const p of local(t)) leadsTo.set(p, [...(leadsTo.get(p) ?? []), t.key]);
	const centre = (keys: string[], own: number) =>
		keys.length ? keys.reduce((s, k) => s + row.get(k)!, 0) / keys.length : own;
	for (let i = 0; i < SWEEPS; i++) {
		// left to right by prerequisites, then right to left by what each leads to
		for (const c of columns.slice(1)) {
			const at = new Map(c.map((t) => [t.key, centre(local(t), row.get(t.key)!)]));
			c.sort((a, b) => at.get(a.key)! - at.get(b.key)!);
			c.forEach((t, j) => row.set(t.key, j));
		}
		for (const c of columns.slice(0, -1).reverse()) {
			const at = new Map(c.map((t) => [t.key, centre(leadsTo.get(t.key) ?? [], row.get(t.key)!)]));
			c.sort((a, b) => at.get(a.key)! - at.get(b.key)!);
			c.forEach((t, j) => row.set(t.key, j));
		}
	}
	place();

	return {
		nodes: mine.map((t) => ({ ...t, col: col.get(t.key)!, row: row.get(t.key)! })),
		cols,
		rows: Math.max(0, ...columns.map((c) => c.length)),
		edges: mine.flatMap((t) => [
			...t.needs.filter((p) => here.has(p)).map((p) => ({ from: p, to: t.key, any: false })),
			...t.anyOf
				.flat()
				.filter((p) => here.has(p))
				.map((p) => ({ from: p, to: t.key, any: true }))
		])
	};
}

/** A tech and everything it needs, transitively, across areas. */
export function needsClosure(techs: Map<string, Pick<TreeTech, 'needs' | 'anyOf'>>, key: string) {
	const out = new Set<string>();
	const stack = [key];
	while (stack.length) {
		const k = stack.pop()!;
		if (out.has(k)) continue;
		out.add(k);
		const t = techs.get(k);
		if (t) stack.push(...prereqs(t));
	}
	return out;
}

/** A tech and everything that needs it, transitively. */
export function leadsClosure(techs: Map<string, Pick<TreeTech, 'needs' | 'anyOf'>>, key: string) {
	const next = new Map<string, string[]>();
	for (const [k, t] of techs) for (const p of prereqs(t)) next.set(p, [...(next.get(p) ?? []), k]);
	const out = new Set<string>();
	const stack = [key];
	while (stack.length) {
		const k = stack.pop()!;
		if (out.has(k)) continue;
		out.add(k);
		stack.push(...(next.get(k) ?? []));
	}
	return out;
}
