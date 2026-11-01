// Rings and quadrants over the galaxy maps (the idea of the mod "Quadrant Fixed"): a ring just
// inside the innermost system around the galactic core, one just outside the outermost regular
// system, equidistant rings between, and a cross dividing the galaxy into 4, 8 or 16 sectors
// named by compass direction. The core is the galaxy's origin (the innermost system of a 4.5.3
// large galaxy sat at 113 from it, the save's `galaxy.core_radius` 112.5). Directions are the
// map's, as drawn: north up (the game draws x growing to the left, `#lib/mapView.ts`).
import type { Point } from './mapView.ts';

export const SECTOR_COUNTS = [4, 8, 16] as const;
export type SectorCount = (typeof SECTOR_COUNTS)[number];
export type QuadrantView = {
	on: boolean;
	rings: number | null; // rings between the inner and the outer one; null: by the galaxy's size
	sectors: SectorCount;
	rotated: boolean; // the cross turned by half a sector: 4 sectors are N, E, S, W instead of NE …
};
export const DEFAULT_QUADRANT_VIEW: QuadrantView = {
	on: true,
	rings: null,
	sectors: 4,
	rotated: false
};
export const MAX_RINGS = 10;

export function parseQuadrantView(v: unknown): QuadrantView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<QuadrantView>;
	return {
		on: o.on !== false,
		rings:
			typeof o.rings === 'number' &&
			Number.isInteger(o.rings) &&
			o.rings >= 0 &&
			o.rings <= MAX_RINGS
				? o.rings
				: null,
		sectors: SECTOR_COUNTS.includes(o.sectors as SectorCount) ? (o.sectors as SectorCount) : 4,
		rotated: o.rotated === true
	};
}

/** The inner and outer ring's radius around the core, a little clear of the systems. */
export function galaxyRadii(points: Point[]): { inner: number; outer: number } | null {
	if (!points.length) return null;
	const d = points.map((p) => Math.hypot(p.x, p.y));
	const [min, max] = [Math.min(...d), Math.max(...d)];
	const pad = max * 0.02;
	return { inner: Math.max(0, min - pad), outer: max + pad };
}

/** Rings between by default: about one per 100 galaxy units of the band (a large galaxy: 3). */
export const autoRings = (inner: number, outer: number) =>
	Math.max(1, Math.round((outer - inner) / 100) - 1);

/** Every ring's radius, inner to outer, with `between` equidistant ones in the band. */
export function ringRadii(inner: number, outer: number, between: number): number[] {
	const step = (outer - inner) / (between + 1);
	return Array.from({ length: between + 2 }, (_, i) => inner + i * step);
}

const WINDS = 'N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW'.split(' ');
const norm = (deg: number) => ((deg % 360) + 360) % 360;

/** A bearing's name: the 16-point wind it falls on, else the two it lies between ("N–NNE"). */
export function windName(deg: number): string {
	const at = norm(deg) / 22.5;
	const i = Math.round(at);
	if (Math.abs(at - i) < 1e-6) return WINDS[i % 16];
	return `${WINDS[Math.floor(at) % 16]}–${WINDS[Math.ceil(at) % 16]}`;
}

/** The cross's lines (bearings, clockwise from north) and each sector's middle and name. */
export function sectors(count: SectorCount, rotated: boolean) {
	const width = 360 / count;
	const offset = rotated ? width / 2 : 0;
	return {
		lines: Array.from({ length: count / 2 }, (_, i) => norm(offset + i * width)),
		middles: Array.from({ length: count }, (_, i) => {
			const deg = norm(offset + (i + 0.5) * width);
			return { deg, name: windName(deg) };
		})
	};
}

/** A galaxy point's bearing from the core as the map shows it: clockwise from north (up). */
export const bearing = (p: Point) => norm((Math.atan2(-p.x, -p.y) * 180) / Math.PI);

/** The sector a galaxy point lies in, by name. */
export function sectorOf(p: Point, count: SectorCount, rotated: boolean): string {
	const width = 360 / count;
	const offset = rotated ? width / 2 : 0;
	const i = Math.floor(norm(bearing(p) - offset) / width);
	return windName(norm(offset + (i + 0.5) * width));
}
