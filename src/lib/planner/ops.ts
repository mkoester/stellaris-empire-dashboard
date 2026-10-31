import { GROUPS, KINDS, validTarget } from './kinds.ts';
import { OPS, type PlanOp } from './replay.ts';

// What `POST /api/plan` accepts: the node the page shows and the changes made there, checked
// before anything is stored (the log is replayed forever, so a malformed row would stay). Pure.

export type PlanChange = { goal: string; op: PlanOp; data: Record<string, unknown> };
export type PlanRequest = { node: number; changes: PlanChange[] };

const ID = /^[\w-]{1,64}$/;
const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;

function change(v: unknown): PlanChange | null {
	if (v === null || typeof v !== 'object') return null;
	const { goal, op, data = {} } = v as Record<string, unknown>;
	if (typeof op !== 'string' || !(OPS as readonly string[]).includes(op)) return null;
	if (typeof goal !== 'string' || data === null || typeof data !== 'object') return null;
	const d = data as Record<string, unknown>;
	switch (op as PlanOp) {
		case 'order': {
			const group = goal.replace(/^group:/, '');
			if (!goal.startsWith('group:') || !GROUPS.some((g) => g.id === group)) return null;
			if (!Array.isArray(d.ids) || d.ids.length > 1000) return null;
			if (!d.ids.every((x) => typeof x === 'string' && ID.test(x))) return null;
			return { goal, op: 'order', data: { ids: d.ids } };
		}
		case 'add': {
			if (!ID.test(goal) || typeof d.kind !== 'string' || !KINDS[d.kind]) return null;
			const target = (d.target ?? {}) as Record<string, string | number>;
			if (typeof target !== 'object' || !validTarget(d.kind, target)) return null;
			if (d.polarity !== 'want' && d.polarity !== 'avoid') return null;
			if (d.note !== undefined && !str(d.note, 2000)) return null;
			if (d.title !== undefined && !str(d.title, 300)) return null;
			if (KINDS[d.kind].manual && !(typeof d.title === 'string' && d.title.trim())) return null;
			if (d.parked !== undefined && typeof d.parked !== 'boolean') return null;
			if (d.from !== undefined && !(typeof d.from === 'string' && ID.test(d.from))) return null;
			const out: Record<string, unknown> = { kind: d.kind, target, polarity: d.polarity };
			for (const k of ['note', 'title', 'parked', 'from']) if (d[k] !== undefined) out[k] = d[k];
			return { goal, op: 'add', data: out };
		}
		case 'edit': {
			if (!ID.test(goal)) return null;
			if (d.polarity !== undefined && d.polarity !== 'want' && d.polarity !== 'avoid') return null;
			if (d.note !== undefined && !str(d.note, 2000)) return null;
			if (d.title !== undefined && !str(d.title, 300)) return null;
			const out: Record<string, unknown> = {};
			for (const k of ['polarity', 'note', 'title']) if (d[k] !== undefined) out[k] = d[k];
			return Object.keys(out).length ? { goal, op: 'edit', data: out } : null;
		}
		default:
			return ID.test(goal) ? { goal, op: op as PlanOp, data: {} } : null;
	}
}

/** The request, or null when anything in it is malformed (nothing is stored then). */
export function parsePlanRequest(body: unknown): PlanRequest | null {
	if (body === null || typeof body !== 'object') return null;
	const { node, changes } = body as Record<string, unknown>;
	if (typeof node !== 'number' || !Number.isInteger(node)) return null;
	if (!Array.isArray(changes) || changes.length === 0 || changes.length > 200) return null;
	const parsed = changes.map(change);
	return parsed.every((c) => c !== null) ? { node, changes: parsed as PlanChange[] } : null;
}
