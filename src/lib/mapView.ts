// Pan and zoom for a galaxy map drawn in screen pixels. A view is the galaxy point at the centre of
// the screen and a scale (pixels per galaxy unit). The game draws save x growing to the left and y
// growing down (2207.03: Alpha Centauri x 11 sits west of Sol x −6, Sirius x −30 east of it).

export type Point = { x: number; y: number };
export type View = { cx: number; cy: number; k: number };
export type Size = { w: number; h: number };

/** The most a view zooms in: systems are some 20 units apart, so ~400px between neighbours. */
export const K_MAX = 20;
const PAD = 40;

export const toScreen = (v: View, s: Size, p: Point): Point => ({
	x: s.w / 2 + (v.cx - p.x) * v.k,
	y: s.h / 2 + (p.y - v.cy) * v.k
});

export const toGalaxy = (v: View, s: Size, p: Point): Point => ({
	x: v.cx - (p.x - s.w / 2) / v.k,
	y: v.cy + (p.y - s.h / 2) / v.k
});

/** The view that fits all points with a margin; one point (or none) is centred at the closest zoom. */
export function fit(points: Point[], s: Size): View {
	if (points.length === 0) return { cx: 0, cy: 0, k: 1 };
	const xs = points.map((p) => p.x);
	const ys = points.map((p) => p.y);
	const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
	const k = Math.min(
		K_MAX,
		(s.w - 2 * PAD) / Math.max(x1 - x0, 1e-9),
		(s.h - 2 * PAD) / Math.max(y1 - y0, 1e-9)
	);
	return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, k: Math.max(k, 1e-3) };
}

/** Zoom by `factor` keeping the galaxy point under the screen point `at` where it is. */
export function zoomAt(v: View, s: Size, at: Point, factor: number, kMin: number): View {
	const k = Math.min(K_MAX, Math.max(kMin, v.k * factor));
	const g = toGalaxy(v, s, at);
	return { cx: g.x + (at.x - s.w / 2) / k, cy: g.y - (at.y - s.h / 2) / k, k };
}

/** Move the view so the map follows a drag of (dx, dy) screen pixels. */
export const pan = (v: View, dx: number, dy: number): View => ({
	...v,
	cx: v.cx + dx / v.k,
	cy: v.cy - dy / v.k
});
