import type { OutcomeNode } from './outcomes.ts';
import type { OutcomeFlag } from './types.ts';

// Whether an anomaly, special project or dig site that is no longer in the save was finished: the
// save cannot say, but an effect that only this one gives — a country flag its events set, a
// modifier, a deposit — being in the save says it got that far. Inferred, never certain (an event
// outside these trees may give it too). Techs do not count: research gives them as well. Pure.

export type OutcomeKind = 'anomaly' | 'project' | 'dig_site';
export type Mark = {
	kind: 'flag' | 'modifier' | 'deposit';
	key: string;
	name: string | null;
	ch?: number;
};
/** What the latest save has: country flags, country and colony modifiers, deposits per planet. */
export type Evidence = {
	flags: ReadonlySet<string>;
	modifiers: ReadonlySet<string>;
	deposits: ReadonlyMap<number, ReadonlySet<string>>; // planet → its deposits
};
export type Inferred = { status: 'finished' | 'chapter'; chapter: number | null; by: string[] };

/** The modifiers and deposits a tree gives anywhere in it, with a dig site's chapter. */
export function treeMarks(tree: OutcomeNode[]): Mark[] {
	const out: Mark[] = [];
	const go = (list: OutcomeNode[], ch: number | undefined) => {
		for (const n of list)
			switch (n.t) {
				case 'modifier':
				case 'deposit':
					out.push({ kind: n.t, key: n.k, name: n.name, ...(ch === undefined ? {} : { ch }) });
					break;
				case 'event':
					go(n.e, ch);
					for (const o of n.o) go(o.e, ch);
					break;
				case 'random':
					for (const b of n.b) go(b.e, ch);
					break;
				case 'if':
					for (const b of n.b) go(b, ch);
					break;
				case 'later':
					go(n.e, ch);
					break;
				case 'chapter':
					go(n.e, n.n);
					break;
				default:
					break;
			}
	};
	go(tree, undefined);
	return out;
}

/** Per source (`kind:key`), the marks no other source has: what can tell it was finished. */
export function uniqueMarks(
	trees: Record<OutcomeKind, Record<string, OutcomeNode[]>>,
	flags: Record<OutcomeKind, Record<string, OutcomeFlag[]>>
): Map<string, Mark[]> {
	const all = new Map<string, Mark[]>();
	for (const kind of ['anomaly', 'project', 'dig_site'] as const) {
		const keys = new Set([...Object.keys(trees[kind]), ...Object.keys(flags[kind])]);
		for (const key of keys)
			all.set(`${kind}:${key}`, [
				...(flags[kind][key] ?? []).map((f): Mark => ({
					kind: 'flag',
					key: f.k,
					name: null,
					...(f.ch ? { ch: f.ch } : {})
				})),
				...treeMarks(trees[kind][key] ?? [])
			]);
	}
	const id = (m: Mark) => `${m.kind}:${m.key}`;
	const sources = new Map<string, number>(); // mark → how many sources give it
	for (const marks of all.values())
		for (const m of new Set(marks.map(id))) sources.set(m, (sources.get(m) ?? 0) + 1);
	return new Map(
		[...all].flatMap(([s, marks]) => {
			const own = marks.filter((m) => sources.get(id(m)) === 1);
			return own.length ? [[s, own] as const] : [];
		})
	);
}

const LABEL: Record<Mark['kind'], string> = {
	flag: 'country flag',
	modifier: 'modifier',
	deposit: 'deposit'
};

/** Finished, or how far a dig site got (`stages`: its chapters), by the marks the save has; a
 * deposit counts on the source's own planet only. */
export function inferDone(
	marks: readonly Mark[] | undefined,
	ev: Evidence,
	planetId: number | null,
	stages: number | null = null
): Inferred | null {
	const here = planetId === null ? undefined : ev.deposits.get(planetId);
	const holds = (marks ?? []).filter((m) =>
		m.kind === 'flag'
			? ev.flags.has(m.key)
			: m.kind === 'modifier'
				? ev.modifiers.has(m.key)
				: !!here?.has(m.key)
	);
	if (!holds.length) return null;
	const by = [...new Set(holds.map((m) => `${LABEL[m.kind]} ${m.name ?? m.key}`))];
	const chapters = holds.flatMap((m) => (m.ch === undefined ? [] : [m.ch]));
	if (!chapters.length) return { status: 'finished', chapter: null, by };
	const chapter = Math.max(...chapters);
	return stages !== null && chapter >= stages
		? { status: 'finished', chapter, by }
		: { status: 'chapter', chapter, by };
}
