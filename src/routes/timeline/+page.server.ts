import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/app.ts';
import { headId, nodes, setParent } from '#lib/server/db.ts';
import type { TimelineNode } from '#lib/types.ts';

export type Row = TimelineNode & { depth: number };

/** Depth-first rows: each child under its parent, branches in date order. */
function rows(all: TimelineNode[]): Row[] {
	const children = new Map<number | null, TimelineNode[]>();
	for (const n of all) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n]);
	const out: Row[] = [];
	const visit = (parent: number | null, depth: number) => {
		const kids = (children.get(parent) ?? []).sort((a, b) => a.date.localeCompare(b.date));
		// A single child continues its parent's line; only real forks indent.
		for (const n of kids) {
			out.push({ ...n, depth });
			visit(n.id, kids.length > 1 ? depth + 1 : depth);
		}
	};
	visit(null, 0);
	return out;
}

export function load() {
	const db = getDb();
	return { rows: rows(nodes(db)), head: headId(db) };
}

export const actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const node = Number(form.get('node'));
		const parent = form.get('parent') === '' ? null : Number(form.get('parent'));
		try {
			setParent(getDb(), node, parent);
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
	}
};
