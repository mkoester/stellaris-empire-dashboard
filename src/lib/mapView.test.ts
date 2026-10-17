import { describe, expect, it } from 'vitest';
import { K_MAX, fit, pan, toGalaxy, toScreen, zoomAt } from './mapView.ts';

const size = { w: 800, h: 400 };
// 2207.03 save: Sol, Alpha Centauri (west of Sol in game), Sirius (east)
const sol = { x: -6, y: 279 };
const alpha = { x: 11, y: 296 };
const sirius = { x: -30, y: 269 };

describe('mapView', () => {
	it('draws larger x further left and larger y further down, as the game does', () => {
		const v = fit([sol, alpha, sirius], size);
		const [s, a, r] = [sol, alpha, sirius].map((p) => toScreen(v, size, p));
		expect(a.x).toBeLessThan(s.x);
		expect(r.x).toBeGreaterThan(s.x);
		expect(a.y).toBeGreaterThan(s.y);
	});

	it('fits all points inside the margin, the tighter axis touching it', () => {
		const v = fit([sol, alpha, sirius], size);
		const xs = [sol, alpha, sirius].map((p) => toScreen(v, size, p).x);
		const ys = [sol, alpha, sirius].map((p) => toScreen(v, size, p).y);
		expect(Math.min(...ys)).toBeCloseTo(40);
		expect(Math.max(...ys)).toBeCloseTo(360);
		expect(Math.min(...xs)).toBeGreaterThanOrEqual(40);
		expect(Math.max(...xs)).toBeLessThanOrEqual(760);
	});

	it('centres a single point at the closest zoom', () => {
		expect(fit([sol], size)).toEqual({ cx: -6, cy: 279, k: K_MAX });
	});

	it('round-trips screen and galaxy coordinates', () => {
		const v = { cx: 3, cy: 250, k: 2.5 };
		const p = toGalaxy(v, size, toScreen(v, size, alpha));
		expect(p.x).toBeCloseTo(alpha.x);
		expect(p.y).toBeCloseTo(alpha.y);
	});

	it('zooms around the cursor and clamps the scale', () => {
		const v = { cx: 0, cy: 250, k: 2 };
		const at = toScreen(v, size, alpha);
		const z = zoomAt(v, size, at, 2, 1);
		expect(z.k).toBe(4);
		expect(toScreen(z, size, alpha).x).toBeCloseTo(at.x);
		expect(toScreen(z, size, alpha).y).toBeCloseTo(at.y);
		expect(zoomAt(v, size, at, 0.01, 1).k).toBe(1);
		expect(zoomAt(v, size, at, 100, 1).k).toBe(K_MAX);
	});

	it('pans so the point under the cursor follows the drag', () => {
		const v = { cx: 0, cy: 250, k: 2 };
		const before = toScreen(v, size, sol);
		const after = toScreen(pan(v, 30, -10), size, sol);
		expect(after.x - before.x).toBeCloseTo(30);
		expect(after.y - before.y).toBeCloseTo(-10);
	});
});
