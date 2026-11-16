import { describe, expect, it } from 'vitest';
import { leadsClosure, needsClosure, treeLayout, type TreeTech } from './techTree.ts';

const tech = (key: string, needs: string[] = [], extra: Partial<TreeTech> = {}): TreeTech => ({
	key,
	name: key,
	area: 'physics',
	tier: null,
	cost: 100,
	category: null,
	rare: false,
	dangerous: false,
	needs,
	anyOf: [],
	...extra
});

describe('treeLayout', () => {
	it('puts a tech one column right of its deepest prerequisite', () => {
		const t = treeLayout([tech('a'), tech('b', ['a']), tech('c', ['a', 'b'])], 'physics');
		const col = Object.fromEntries(t.nodes.map((n) => [n.key, n.col]));
		expect(col).toEqual({ a: 0, b: 1, c: 2 });
		expect(t.cols).toBe(3);
	});
	it('never puts a tech left of its tier', () => {
		const t = treeLayout([tech('a'), tech('b', ['a'], { tier: 3 })], 'physics');
		expect(t.nodes.find((n) => n.key === 'b')?.col).toBe(3);
	});
	it('ignores other areas for columns and edges, and draws OR prerequisites as such', () => {
		const t = treeLayout(
			[tech('x', [], { area: 'society' }), tech('a'), tech('b', ['x'], { anyOf: [['a']] })],
			'physics'
		);
		expect(t.nodes.map((n) => n.key).sort()).toEqual(['a', 'b']);
		expect(t.nodes.find((n) => n.key === 'b')?.col).toBe(1);
		expect(t.edges).toEqual([{ from: 'a', to: 'b', any: true }]);
	});
	it('orders rows so children sit by their parents', () => {
		// two chains whose names would interleave them: a1→z1, b1→y1
		const t = treeLayout(
			[tech('a1'), tech('b1'), tech('y1', ['b1']), tech('z1', ['a1'])],
			'physics'
		);
		const row = Object.fromEntries(t.nodes.map((n) => [n.key, n.row]));
		expect(row.z1 === row.a1 && row.y1 === row.b1).toBe(true);
		expect(t.rows).toBe(2);
	});
	it('survives a cycle', () => {
		const t = treeLayout([tech('a', ['b']), tech('b', ['a'])], 'physics');
		expect(t.nodes).toHaveLength(2);
	});
});

describe('closures', () => {
	const all = new Map(
		[tech('a'), tech('b', ['a']), tech('c', [], { anyOf: [['b']] }), tech('d')].map((t) => [
			t.key,
			t
		])
	);
	it('collects what a tech needs, OR groups included', () => {
		expect([...needsClosure(all, 'c')].sort()).toEqual(['a', 'b', 'c']);
	});
	it('collects what a tech leads to', () => {
		expect([...leadsClosure(all, 'a')].sort()).toEqual(['a', 'b', 'c']);
		expect([...leadsClosure(all, 'd')]).toEqual(['d']);
	});
});
