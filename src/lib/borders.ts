import type { Point } from './mapView.ts';

// Empire borders as the galaxy map draws territory: every system claims the space nearer to it
// than to any other system (its Voronoi cell), at most a radius R around it. An empire's territory
// is the union of its systems' cells; its border runs where a cell meets a system of another (or
// no) owner, and along the arcs where nothing else is near. Unowned and unknown systems are sites
// too, so a territory stops halfway to them. Systems of one owner joined by a hyperlane longer
// than 2R would show as separate islands; as in the game, their territory follows the lane: each
// claims a corridor along it (half-width CORRIDOR·R), which the bisector cuts at the midpoint.
// Pure geometry in galaxy units, drawn by GalaxyMap.

export type Site = Point & { id: number };
/** An edge of a cell; `other` is the system across it, null on the outer arc. */
export type Edge = { a: Point; b: Point; other: number | null };
export type Cell = { id: number; poly: Point[]; edges: Edge[] };

const ARC_STEPS = 72;
/** A corridor's half-width, as a share of the claim radius. */
export const CORRIDOR = 0.5;

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

type Vertex = { p: Point; tag: number | null }; // tag: the edge from this vertex to the next

/**
 * Keeps the part of the polygon nearer to `s` than to `o` (Sutherland–Hodgman on the half-plane of
 * their bisector); the new edge along the bisector is tagged with `oid`.
 */
function clip(poly: Vertex[], s: Point, o: Point, oid: number): Vertex[] {
	const m = { x: (s.x + o.x) / 2, y: (s.y + o.y) / 2 };
	const n = { x: o.x - s.x, y: o.y - s.y };
	const side = (p: Point) => (p.x - m.x) * n.x + (p.y - m.y) * n.y; // ≤ 0: on s's side
	const out: Vertex[] = [];
	for (let i = 0; i < poly.length; i++) {
		const P = poly[i];
		const Q = poly[(i + 1) % poly.length];
		const dp = side(P.p);
		const dq = side(Q.p);
		if (dp <= 0) out.push(P);
		if (dp <= 0 !== dq <= 0) {
			const t = dp / (dp - dq);
			const I = { x: P.p.x + t * (Q.p.x - P.p.x), y: P.p.y + t * (Q.p.y - P.p.y) };
			// leaving: from here along the bisector; entering: on along the old edge
			out.push({ p: I, tag: dp <= 0 ? oid : P.tag });
		}
	}
	return out;
}

/**
 * How far a ray from `s` at `angle` stays inside the claim: the circle of `radius`, or a corridor
 * of half-width `w` from `s` to each linked point. The union is star-shaped around `s`, so one
 * distance per angle describes it.
 */
export function reach(s: Point, angle: number, radius: number, links: Point[], w: number): number {
	let r = radius;
	for (const o of links) {
		const len = Math.hypot(o.x - s.x, o.y - s.y);
		if (len === 0) continue;
		const along = Math.cos(angle - Math.atan2(o.y - s.y, o.x - s.x)); // ray · lane direction
		const across = Math.sqrt(Math.max(0, 1 - along * along));
		if (along <= 0) continue;
		r = Math.max(r, Math.min(len / along, across > 0 ? w / across : Infinity));
	}
	return r;
}

/**
 * The cells of the systems `ids` among all `sites`, each clipped to `radius` — widened by a
 * corridor along each lane to `linked(id)`: the systems of the same owner it has a lane to.
 */
export function cells(
	sites: Site[],
	ids: Set<number>,
	radius: number,
	linked: (id: number) => Point[] = () => []
): Cell[] {
	return sites
		.filter((s) => ids.has(s.id))
		.map((s) => {
			const links = linked(s.id);
			let poly: Vertex[] = Array.from({ length: ARC_STEPS }, (_, i) => {
				const a = (2 * Math.PI * i) / ARC_STEPS;
				const r = reach(s, a, radius, links, CORRIDOR * radius);
				return { p: { x: s.x + r * Math.cos(a), y: s.y + r * Math.sin(a) }, tag: null };
			});
			// a site beyond twice the claim's farthest point cannot cut it
			const far = 2 * Math.max(...poly.map((v) => Math.hypot(v.p.x - s.x, v.p.y - s.y)));
			for (const o of sites) {
				if (o.id === s.id || Math.hypot(o.x - s.x, o.y - s.y) >= far) continue;
				poly = clip(poly, s, o, o.id);
				if (!poly.length) break;
			}
			return {
				id: s.id,
				poly: poly.map((v) => v.p),
				edges: poly.map((v, i) => ({ a: v.p, b: poly[(i + 1) % poly.length].p, other: v.tag }))
			};
		});
}

/** The edges of a cell that are border: the arc, or towards a system of another owner. */
export const borderEdges = (cell: Cell, owner: (id: number) => string | undefined): Edge[] =>
	cell.edges.filter((e) => e.other === null || owner(e.other) !== owner(cell.id));
