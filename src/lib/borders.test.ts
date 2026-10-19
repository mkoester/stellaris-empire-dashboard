import { describe, expect, it } from 'vitest';
import { borderEdges, cells, claimRadius, CORRIDOR } from './borders.ts';

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

describe('corridors along lanes', () => {
	// two of our systems 100 apart on a lane, radius 20: without the lane two islands
	const sites = [
		{ id: 1, x: 0, y: 0 },
		{ id: 2, x: 100, y: 0 }
	];
	const linked = (id: number) => (id === 1 ? [sites[1]] : [sites[0]]);

	it('reaches along the lane to the midpoint, where the neighbour takes over', () => {
		const [a, b] = cells(sites, new Set([1, 2]), 20, linked);
		expect(Math.max(...a.poly.map((p) => p.x))).toBeCloseTo(50);
		expect(Math.min(...b.poly.map((p) => p.x))).toBeCloseTo(50);
		// the meeting edge is the bisector, tagged with the neighbour: no border between them
		expect(a.edges.some((e) => e.other === 2)).toBe(true);
	});

	it('keeps the corridor CORRIDOR·R to either side of the lane', () => {
		const [a] = cells(sites, new Set([1, 2]), 20, linked);
		const at40 = a.poly.filter((p) => Math.abs(p.x - 40) < 6).map((p) => Math.abs(p.y));
		expect(Math.max(...at40)).toBeCloseTo(CORRIDOR * 20, 0);
	});

	it('stays a plain circle without links', () => {
		const [a] = cells(sites, new Set([1]), 20);
		expect(Math.max(...a.poly.map((p) => p.x))).toBeCloseTo(20);
	});

	it('gives way to a third owned system near the lane', () => {
		const third = { id: 3, x: 50, y: 8 };
		const [a] = cells([...sites, third], new Set([1, 2]), 20, linked);
		// the bisector towards system 3 cuts the corridor short of the midpoint
		expect(Math.max(...a.poly.map((p) => p.x))).toBeLessThan(50);
	});
});
