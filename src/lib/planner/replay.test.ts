import { describe, expect, it } from 'vitest';
import {
	arrange,
	goalKey,
	leaves,
	moved,
	otherBranches,
	parked,
	planAt,
	type PlanEvent
} from './replay.ts';

let id = 0;
const ev = (nodeId: number, goal: string, op: PlanEvent['op'], data: unknown = {}): PlanEvent => ({
	id: ++id,
	nodeId,
	at: '2026-10-31T10:00:00Z',
	goal,
	op,
	data
});
const add = (nodeId: number, goal: string, tech: string, extra = {}) =>
	ev(nodeId, goal, 'add', { kind: 'tech', target: { tech }, polarity: 'want', ...extra });
const group = () => 'research';

// nodes: 1 → 2 → 3 (branch A), 2 → 4 (branch B, a reload of 2)
describe('planAt', () => {
	const events = [
		add(1, 'a', 'tech_a'),
		add(2, 'b', 'tech_b'),
		add(3, 'c', 'tech_c'), // on A only
		ev(4, 'a', 'remove'), // on B only
		add(4, 'd', 'tech_d')
	];

	it('replays only the changes along the path, so branches keep their own plan', () => {
		expect([...planAt(events, [1, 2, 3]).goals.keys()]).toEqual(['a', 'b', 'c']);
		expect([...planAt(events, [1, 2, 4]).goals.keys()]).toEqual(['b', 'd']);
		expect([...planAt(events, [1, 2]).goals.keys()]).toEqual(['a', 'b']);
	});

	it('follows a branch point moved on /timeline: the path decides, not the node ids', () => {
		// 4 re-parented under 3: it now sees A's goals before its own changes
		expect([...planAt(events, [1, 2, 3, 4]).goals.keys()]).toEqual(['b', 'c', 'd']);
	});

	it('applies edits, parking and ticks, and keeps the history of what applied', () => {
		const p = planAt(
			[
				add(1, 'a', 'tech_a'),
				ev(1, 'a', 'edit', { note: 'first', polarity: 'avoid' }),
				ev(1, 'a', 'park'),
				ev(1, 'a', 'check'),
				ev(2, 'a', 'unpark'),
				ev(9, 'a', 'edit', { note: 'elsewhere' })
			],
			[1, 2]
		);
		expect(p.goals.get('a')).toMatchObject({
			note: 'first',
			polarity: 'avoid',
			parked: false,
			checked: true
		});
		expect(p.history.map((e) => e.op)).toEqual(['add', 'edit', 'park', 'check', 'unpark']);
	});

	it('ignores changes to goals not on the branch, and a second add of one id', () => {
		const p = planAt(
			[ev(1, 'x', 'edit', { note: 'n' }), add(1, 'a', 't1'), add(1, 'a', 't2')],
			[1]
		);
		expect(p.goals.get('a')?.target).toEqual({ tech: 't1' });
		expect(p.history.map((e) => e.op)).toEqual(['add']);
	});
});

describe('arrange', () => {
	it('orders a group by its last order, newer goals at the end, parked ones apart', () => {
		const p = planAt(
			[
				add(1, 'a', 'ta'),
				add(1, 'b', 'tb'),
				add(1, 'c', 'tc'),
				ev(1, 'group:research', 'order', { ids: ['c', 'a', 'gone'] }),
				add(1, 'd', 'td'),
				add(1, 'e', 'te', { parked: true })
			],
			[1]
		);
		expect(arrange(p, group).research.map((g) => g.id)).toEqual(['c', 'a', 'b', 'd']);
		expect(parked(p).map((g) => g.id)).toEqual(['e']);
	});
});

describe('moved', () => {
	it('moves one id to an index, clamped', () => {
		expect(moved(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
		expect(moved(['a', 'b', 'c'], 'a', 9)).toEqual(['b', 'c', 'a']);
		expect(moved(['a', 'b'], 'x', 1)).toEqual(['a', 'x', 'b']);
	});
});

describe('otherBranches', () => {
	it("lists the other branches' goals missing here, once, with every tip that has it", () => {
		const events = [
			add(1, 'a', 'tech_a'),
			add(3, 'c', 'tech_c'),
			add(5, 'c2', 'tech_c'), // the same goal, planned again on a third branch
			add(5, 'e', 'tech_a'), // the same kind and target as `a` there: one entry
			ev(4, 'a', 'remove')
		];
		const here = planAt(events, [1, 2, 4]);
		const out = otherBranches(
			events,
			[
				{ tip: 3, path: [1, 2, 3] },
				{ tip: 5, path: [1, 5] }
			],
			here
		);
		expect(out.map((g) => [g.id, g.tips])).toEqual([
			['a', [3, 5]],
			['c', [3, 5]]
		]);
	});
});

describe('goalKey and leaves', () => {
	it('keys a goal by kind and target, whatever the field order', () => {
		expect(goalKey('x', { b: 1, a: 'q' })).toBe(goalKey('x', { a: 'q', b: 1 }));
		expect(goalKey('x', { a: 1 })).not.toBe(goalKey('y', { a: 1 }));
		// free-text goals have no target: their text tells them apart
		expect(goalKey('free', {}, 'a')).not.toBe(goalKey('free', {}, 'b'));
	});

	it('finds the save graph leaves', () => {
		expect(
			leaves([
				{ id: 1, parentId: null },
				{ id: 2, parentId: 1 },
				{ id: 3, parentId: 2 },
				{ id: 4, parentId: 2 }
			])
		).toEqual([3, 4]);
	});
});
