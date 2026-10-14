import { describe, expect, it } from 'vitest';
import { path, place } from './timeline.ts';
import type { TimelineNode } from './types.ts';

const node = (id: number, date: string, parentId: number | null, campaign = 'c'): TimelineNode => ({
	id,
	campaign,
	date,
	fingerprint: `f${id}`,
	parentId,
	ambiguous: false
});
const obs = (date: string, fingerprint = 'new', campaign = 'c') => ({
	campaign,
	date,
	fingerprint
});

// 1 ── 2 ── 3        (main line)
//       └── 4        (branch loaded from 2)
const tree = [
	node(1, '2200.01.01', null),
	node(2, '2201.01.01', 1),
	node(3, '2202.01.01', 2),
	node(4, '2201.06.01', 2)
];

describe('place', () => {
	it('starts a campaign with a root', () => {
		expect(place([], null, obs('2200.01.01'))).toEqual({
			kind: 'child',
			parentId: null,
			ambiguous: false
		});
	});

	it('appends to the head when time moves forward', () => {
		expect(place(tree, 3, obs('2203.01.01'))).toEqual({
			kind: 'child',
			parentId: 3,
			ambiguous: false
		});
	});

	it('recognises an already-seen state, e.g. a manual save of an autosaved moment', () => {
		expect(place(tree, 3, obs('2202.01.01', 'f3'))).toEqual({ kind: 'duplicate', nodeId: 3 });
	});

	it('branches from the newest earlier node on the current branch when time goes back, flagged', () => {
		// head 3, new state at 2201.03 → loaded something ≤ 2201.03 on 1-2-3: node 2.
		expect(place(tree, 3, obs('2201.03.01'))).toEqual({
			kind: 'child',
			parentId: 2,
			ambiguous: true
		});
	});

	it('prefers the current branch over a newer node on another branch', () => {
		// head 3 (branch 1-2-3); node 4 (2201.06) is newer than 2 but on the other branch.
		expect(place(tree, 3, obs('2201.07.01'))).toEqual({
			kind: 'child',
			parentId: 2,
			ambiguous: true
		});
	});

	it('falls back to any branch when the current one has nothing earlier', () => {
		const t = [node(1, '2201.01.01', null), node(2, '2200.06.01', null)];
		expect(place(t, 1, obs('2200.07.01'))).toEqual({ kind: 'child', parentId: 2, ambiguous: true });
	});

	it('treats an equal date with a different state as a reload', () => {
		expect(place(tree, 3, obs('2202.01.01'))).toMatchObject({ kind: 'child', ambiguous: true });
	});

	it('trusts a known loaded save over the heuristics', () => {
		expect(place(tree, 3, obs('2201.07.01'), 4)).toEqual({
			kind: 'child',
			parentId: 4,
			ambiguous: false
		});
	});

	it('keeps campaigns apart', () => {
		expect(place(tree, 3, obs('2203.01.01', 'x', 'other'))).toEqual({
			kind: 'child',
			parentId: null,
			ambiguous: false
		});
	});
});

describe('path', () => {
	it('walks root → node', () => {
		expect(path(tree, 4).map((n) => n.id)).toEqual([1, 2, 4]);
	});

	it('survives a parent cycle from a bad manual correction', () => {
		const t = [node(1, '2200.01.01', 2), node(2, '2201.01.01', 1)];
		expect(path(t, 2).map((n) => n.id)).toEqual([1, 2]);
	});
});
