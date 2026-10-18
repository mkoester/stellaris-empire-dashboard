import { describe, expect, it } from 'vitest';
import { borderEdges, cells, claimRadius } from './borders.ts';

describe('cells and borders', () => {
	// three systems on a line, 20 units apart: 1 and 2 ours, 3 someone else's
	const sites = [
		{ id: 1, x: 0, y: 0 },
		{ id: 2, x: 20, y: 0 },
		{ id: 3, x: 40, y: 0 }
	];
	const owner = (id: number) => ({ 1: 'us', 2: 'us', 3: 'them' })[id];
	const all = cells(sites, new Set([1, 2, 3]), 20);
	const cell = (id: number) => all.find((c) => c.id === id)!;

	it('splits the space between neighbours halfway', () => {
		const xs = cell(2).poly.map((p) => p.x);
		expect(Math.min(...xs)).toBeCloseTo(10);
		expect(Math.max(...xs)).toBeCloseTo(30);
	});

	it('draws no border between two systems of one owner, one towards another owner', () => {
		const towards = (id: number) => borderEdges(cell(2), owner).filter((e) => e.other === id);
		expect(towards(1)).toEqual([]);
		expect(towards(3)).toHaveLength(1);
		expect(towards(3)[0].a.x).toBeCloseTo(30);
	});

	it('closes a lone system with its arc', () => {
		const [lone] = cells([{ id: 9, x: 0, y: 0 }], new Set([9]), 10);
		expect(lone.edges.every((e) => e.other === null)).toBe(true);
		expect(lone.poly.every((p) => Math.abs(Math.hypot(p.x, p.y) - 10) < 1e-9)).toBe(true);
	});

	it('claims about the distance to a typical neighbour', () => {
		expect(claimRadius(sites)).toBe(20);
	});
});
