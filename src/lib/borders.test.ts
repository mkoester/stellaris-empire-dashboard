import { describe, expect, it } from 'vitest';
import { claimRadius, CORRIDOR, HOLE, outlines, type Site } from './borders.ts';

const site = (id: number, x: number, y: number, owner = 'us'): Site => ({ id, x, y, owner });
const xs = (ring: { x: number }[]) => ring.map((p) => p.x);
const ys = (ring: { y: number }[]) => ring.map((p) => p.y);

describe('territory outlines', () => {
	it('draws a lone system as a ring of radius R', () => {
		const [ring, ...more] = outlines([site(1, 0, 0)], [], 20).get('us')!;
		expect(more).toEqual([]);
		for (const p of ring) expect(Math.hypot(p.x, p.y)).toBeCloseTo(20, 0);
	});

	it('keeps two far systems apart without a lane, joins them with one', () => {
		const a = site(1, 0, 0);
		const b = site(2, 100, 0);
		expect(outlines([a, b], [], 20).get('us')).toHaveLength(2);
		const joined = outlines([a, b], [[a, b]], 20).get('us')!;
		expect(joined).toHaveLength(1);
		// the corridor at the lane's middle is CORRIDOR·R to either side (within the grid's
		// interpolation, which errs outwards on the curved falloff: < 1 at R/5 = 4)
		const middle = joined[0].filter((p) => Math.abs(p.x - 50) < 3);
		expect(Math.abs(Math.max(...ys(middle)) - CORRIDOR * 20)).toBeLessThan(1);
	});

	it('merges close systems into one rounded outline', () => {
		const rings = outlines([site(1, 0, 0), site(2, 30, 0)], [], 20).get('us')!;
		expect(rings).toHaveLength(1);
		expect(Math.min(...xs(rings[0]))).toBeLessThan(-19);
		expect(Math.max(...xs(rings[0]))).toBeGreaterThan(49);
	});

	it('splits the space between two owners halfway', () => {
		const out = outlines([site(1, 0, 0), site(2, 30, 0, 'them')], [], 20);
		expect(Math.max(...xs(out.get('us')![0]))).toBeCloseTo(15, 0);
		expect(Math.min(...xs(out.get('them')![0]))).toBeCloseTo(15, 0);
	});

	it('cuts an unowned system out of the territory around it, a small ring of HOLE·R', () => {
		const a = site(1, 0, 0);
		const b = site(2, 40, 0);
		const rings = outlines([a, b], [[a, b]], 20, [{ x: 20, y: 0 }]).get('us')!;
		expect(rings).toHaveLength(2); // the outline and the hole
		const hole = rings.find((r) => Math.max(...xs(r)) < 30)!;
		for (const p of hole) expect(Math.hypot(p.x - 20, p.y)).toBeCloseTo(HOLE * 20, 0);
		// an unowned system outside every territory changes nothing
		expect(outlines([a], [], 20, [{ x: 200, y: 0 }]).get('us')).toHaveLength(1);
	});

	it('claims about the distance to a typical neighbour', () => {
		expect(claimRadius([site(1, 0, 0), site(2, 20, 0), site(3, 40, 0)])).toBe(20);
	});
});
