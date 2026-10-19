import type { Point } from './mapView.ts';

// Empire borders as the galaxy map draws territory: a smooth field around each owner's systems and
// the hyperlanes between them, as the game's map blends them. Every owned system radiates
// exp(−A·(d/R)²), every lane between two systems of one owner the same over its distance from the
// lane, scaled by CORRIDOR; an owner holds the points where its summed field passes the lone
// system's value at R, and beats every other owner's. **Only owned systems claim space**: when all
// systems did, an unowned one beside a lane cut Cydran Concern's territory in two (2205.07). An
// unowned system inside a territory is cut out instead, a small hole of HOLE·R around it, so it
// does not look owned (the user's call, 2026-10-19). Nearby claims merge into one rounded outline,
// a lane keeps far-apart systems joined, and two owners meet where their fields are equal. The
// outline is traced by marching squares on a grid of R/STEPS. Pure geometry in galaxy units,
// drawn by GalaxyMap.

/** Steepness of the falloff: two lone systems merge once less than ~2.2 R apart. */
const A = 3;
/** A lane's reach to either side, as a share of R. */
export const CORRIDOR = 0.5;
/** The claim radius as a share of the typical distance between systems (claimRadius). */
export const REACH = 0.8;
/** Grid points per R. */
const STEPS = 5;
/** The hole around an unowned system inside a territory, as a share of R. */
export const HOLE = 0.25;

export type Site = Point & { id: number; owner: string };
/** Each owner's outline: closed rings, holes included (fill them even-odd). */
export type Outlines = Map<string, Point[][]>;

/** Systems with the space they claim: the radius is about the distance to a typical neighbour. */
export function claimRadius(sites: Point[]): number {
	if (sites.length < 2) return 20;
	const nearest = sites
		.map((p) =>
			Math.min(...sites.filter((q) => q !== p).map((q) => Math.hypot(q.x - p.x, q.y - p.y)))
		)
		.sort((a, b) => a - b);
	return nearest[Math.floor(nearest.length / 2)] || 20;
}

/** Distance from p to the segment a–b. */
function toSegment(p: Point, a: Point, b: Point): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len2 = dx * dx + dy * dy;
	const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
	return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

// Marching squares: per corner pattern (bits: top-left 1, top-right 2, bottom-right 4,
// bottom-left 8) the edges each contour segment joins; 5 and 10 are saddles, decided by the centre.
type Side = 'top' | 'right' | 'bottom' | 'left';
const CASES: Record<number, [Side, Side][]> = {
	1: [['left', 'top']],
	2: [['top', 'right']],
	3: [['left', 'right']],
	4: [['right', 'bottom']],
	6: [['top', 'bottom']],
	7: [['left', 'bottom']],
	8: [['bottom', 'left']],
	9: [['top', 'bottom']],
	11: [['right', 'bottom']],
	12: [['left', 'right']],
	13: [['top', 'right']],
	14: [['left', 'top']]
};
const SADDLE: Record<number, { centreIn: [Side, Side][]; centreOut: [Side, Side][] }> = {
	5: {
		centreIn: [
			['top', 'right'],
			['bottom', 'left']
		],
		centreOut: [
			['left', 'top'],
			['right', 'bottom']
		]
	},
	10: {
		centreIn: [
			['left', 'top'],
			['right', 'bottom']
		],
		centreOut: [
			['top', 'right'],
			['bottom', 'left']
		]
	}
};

/**
 * The outline of every owner's territory. `sites`: the owned systems; `lanes`: hyperlanes between
 * two systems of one owner (each once); `radius`: R, the reach of a lone system; `holes`: the
 * unowned systems, cut out where they fall inside.
 */
export function outlines(
	sites: Site[],
	lanes: [Site, Site][],
	radius: number,
	holes: Point[] = []
): Outlines {
	const out: Outlines = new Map();
	if (!sites.length) return out;
	const owners = [...new Set(sites.map((s) => s.owner))];
	const h = radius / STEPS;
	const pad = 2 * radius;
	const x0 = Math.min(...sites.map((s) => s.x)) - pad;
	const y0 = Math.min(...sites.map((s) => s.y)) - pad;
	const nx = Math.ceil((Math.max(...sites.map((s) => s.x)) + pad - x0) / h) + 1;
	const ny = Math.ceil((Math.max(...sites.map((s) => s.y)) + pad - y0) / h) + 1;

	// the summed field of each owner at each grid point; only sources within 3R count
	const fields = owners.map(() => new Float64Array(nx * ny));
	const ownerIndex = new Map(owners.map((o, i) => [o, i]));
	const add = (owner: string, dist: (p: Point) => number, box: number[]) => {
		const f = fields[ownerIndex.get(owner)!];
		const [ax, ay, bx, by] = box;
		const i0 = Math.max(0, Math.floor((ax - 3 * radius - x0) / h));
		const i1 = Math.min(nx - 1, Math.ceil((bx + 3 * radius - x0) / h));
		const j0 = Math.max(0, Math.floor((ay - 3 * radius - y0) / h));
		const j1 = Math.min(ny - 1, Math.ceil((by + 3 * radius - y0) / h));
		for (let j = j0; j <= j1; j++)
			for (let i = i0; i <= i1; i++) {
				const d = dist({ x: x0 + i * h, y: y0 + j * h }) / radius;
				f[j * nx + i] += Math.exp(-A * d * d);
			}
	};
	for (const s of sites)
		add(s.owner, (p) => Math.hypot(p.x - s.x, p.y - s.y), [s.x, s.y, s.x, s.y]);
	for (const [a, b] of lanes)
		add(a.owner, (p) => toSegment(p, a, b) / CORRIDOR, [
			Math.min(a.x, b.x),
			Math.min(a.y, b.y),
			Math.max(a.x, b.x),
			Math.max(a.y, b.y)
		]);

	const threshold = Math.exp(-A);
	// each hole as a cap on the grid points within HOLE·R: negative inside the circle, rising to
	// the field's own scale at its edge, so the contour runs along the circle
	const cap = new Float64Array(nx * ny).fill(Infinity);
	const r0 = HOLE * radius;
	for (const p of holes) {
		const i0 = Math.max(0, Math.floor((p.x - 2 * r0 - x0) / h));
		const i1 = Math.min(nx - 1, Math.ceil((p.x + 2 * r0 - x0) / h));
		const j0 = Math.max(0, Math.floor((p.y - 2 * r0 - y0) / h));
		const j1 = Math.min(ny - 1, Math.ceil((p.y + 2 * r0 - y0) / h));
		for (let j = j0; j <= j1; j++)
			for (let i = i0; i <= i1; i++) {
				const d = Math.hypot(x0 + i * h - p.x, y0 + j * h - p.y);
				cap[j * nx + i] = Math.min(cap[j * nx + i], (threshold * (d - r0)) / r0);
			}
	}
	owners.forEach((owner, k) => {
		// > 0 inside: above the threshold and ahead of every other owner
		const g = new Float64Array(nx * ny);
		for (let n = 0; n < nx * ny; n++) {
			let rival = threshold;
			for (let o = 0; o < owners.length; o++) if (o !== k) rival = Math.max(rival, fields[o][n]);
			g[n] = Math.min(fields[k][n] - rival, cap[n]);
		}
		out.set(
			owner,
			trace(g, nx, ny, (i, j) => ({ x: x0 + i * h, y: y0 + j * h }))
		);
	});
	return out;
}

/** Marching squares over `g` (> 0 inside), segments stitched into closed rings. */
function trace(
	g: Float64Array,
	nx: number,
	ny: number,
	at: (i: number, j: number) => Point
): Point[][] {
	const v = (i: number, j: number) => g[j * nx + i];
	// a contour point lies on a grid edge and is keyed by it, so neighbouring squares share it
	const point = new Map<string, Point>();
	const edge = (i: number, j: number, side: Side): string => {
		const [ai, aj, bi, bj, key] =
			side === 'top'
				? [i, j, i + 1, j, `h${i},${j}`]
				: side === 'bottom'
					? [i, j + 1, i + 1, j + 1, `h${i},${j + 1}`]
					: side === 'left'
						? [i, j, i, j + 1, `v${i},${j}`]
						: [i + 1, j, i + 1, j + 1, `v${i + 1},${j}`];
		if (!point.has(key)) {
			const ga = v(ai, aj);
			const t = ga / (ga - v(bi, bj));
			const pa = at(ai, aj);
			const pb = at(bi, bj);
			point.set(key, { x: pa.x + t * (pb.x - pa.x), y: pa.y + t * (pb.y - pa.y) });
		}
		return key;
	};
	const links = new Map<string, string[]>();
	const link = (a: string, b: string) => {
		links.set(a, [...(links.get(a) ?? []), b]);
		links.set(b, [...(links.get(b) ?? []), a]);
	};
	for (let j = 0; j < ny - 1; j++)
		for (let i = 0; i < nx - 1; i++) {
			const c =
				(v(i, j) > 0 ? 1 : 0) |
				(v(i + 1, j) > 0 ? 2 : 0) |
				(v(i + 1, j + 1) > 0 ? 4 : 0) |
				(v(i, j + 1) > 0 ? 8 : 0);
			if (c === 0 || c === 15) continue;
			const saddle = SADDLE[c];
			const centre = (v(i, j) + v(i + 1, j) + v(i + 1, j + 1) + v(i, j + 1)) / 4;
			const segs = saddle ? (centre > 0 ? saddle.centreIn : saddle.centreOut) : CASES[c];
			for (const [a, b] of segs) link(edge(i, j, a), edge(i, j, b));
		}
	// walk each loop once
	const rings: Point[][] = [];
	const done = new Set<string>();
	for (const start of links.keys()) {
		if (done.has(start)) continue;
		const ring: Point[] = [];
		let prev: string | null = null;
		let here = start;
		while (!done.has(here)) {
			done.add(here);
			ring.push(point.get(here)!);
			const next = (links.get(here) ?? []).find((n) => n !== prev && !done.has(n));
			if (next === undefined) break;
			prev = here;
			here = next;
		}
		if (ring.length > 2) rings.push(ring);
	}
	return rings;
}
