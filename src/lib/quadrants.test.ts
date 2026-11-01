import { describe, expect, it } from 'vitest';
import {
	autoRings,
	bearing,
	galaxyRadii,
	parseQuadrantView,
	ringRadii,
	sectorOf,
	sectors,
	windName
} from './quadrants.ts';

describe('galaxyRadii', () => {
	it('stays clear of the innermost and outermost system', () => {
		const r = galaxyRadii([
			{ x: 113, y: 0 },
			{ x: 0, y: -470 },
			{ x: 200, y: 200 }
		])!;
		expect(r.inner).toBeLessThan(113);
		expect(r.outer).toBeGreaterThan(470);
		expect(r.inner).toBeGreaterThan(100);
	});
	it('no systems: none', () => expect(galaxyRadii([])).toBeNull());
});

describe('rings', () => {
	it('a large galaxy (113 … 470) gets 3 between; a small band at least 1', () => {
		expect(autoRings(104, 480)).toBe(2); // a large galaxy
		expect(autoRings(50, 120)).toBe(1);
	});
	it('are equidistant from inner to outer', () => {
		expect(ringRadii(100, 400, 2)).toEqual([100, 200, 300, 400]);
		expect(ringRadii(100, 400, 0)).toEqual([100, 400]);
	});
});

describe('sectors', () => {
	it('4 sectors: a N–S and an E–W line, NE … NW; rotated N, E, S, W', () => {
		expect(sectors(4, false).lines).toEqual([0, 90]);
		expect(sectors(4, false).middles.map((m) => m.name)).toEqual(['NE', 'SE', 'SW', 'NW']);
		expect(sectors(4, true).lines).toEqual([45, 135]);
		expect(sectors(4, true).middles.map((m) => m.name)).toEqual(['E', 'S', 'W', 'N']);
	});
	it('8 and 16 sectors', () => {
		expect(sectors(8, true).middles.map((m) => m.name)).toEqual([
			'NE',
			'E',
			'SE',
			'S',
			'SW',
			'W',
			'NW',
			'N'
		]);
		expect(sectors(16, false).middles[0].name).toBe('N–NNE');
		expect(sectors(16, true).middles[0].name).toBe('NNE');
		expect(sectors(16, false).lines).toHaveLength(8);
	});
	it('windName', () => {
		expect(windName(0)).toBe('N');
		expect(windName(360)).toBe('N');
		expect(windName(337.5)).toBe('NNW');
		expect(windName(350)).toBe('NNW–N');
	});
});

describe('bearing and sectorOf', () => {
	// the map draws x growing to the left and y down: +x is west, −y north
	it('follows the map as drawn', () => {
		expect(bearing({ x: 0, y: -1 })).toBe(0); // north
		expect(bearing({ x: -1, y: 0 })).toBe(90); // east
		expect(bearing({ x: 0, y: 1 })).toBe(180); // south
		expect(bearing({ x: 1, y: 0 })).toBe(270); // west
	});
	it('names the sector a system lies in', () => {
		expect(sectorOf({ x: -10, y: -10 }, 4, false)).toBe('NE');
		expect(sectorOf({ x: 10, y: 10 }, 4, false)).toBe('SW');
		expect(sectorOf({ x: 0, y: -10 }, 4, true)).toBe('N');
		expect(sectorOf({ x: 1, y: -10 }, 4, true)).toBe('N'); // a little west of north
	});
});

describe('parseQuadrantView', () => {
	it('defaults: on, rings by galaxy size, 4 sectors, not rotated', () => {
		expect(parseQuadrantView(undefined)).toEqual({
			on: true,
			rings: null,
			sectors: 4,
			rotated: false
		});
	});
	it('keeps valid values, drops invalid ones', () => {
		expect(parseQuadrantView({ on: false, rings: 2, sectors: 16, rotated: true })).toEqual({
			on: false,
			rings: 2,
			sectors: 16,
			rotated: true
		});
		expect(parseQuadrantView({ rings: -1, sectors: 6 })).toMatchObject({ rings: null, sectors: 4 });
		expect(parseQuadrantView({ rings: 1.5 }).rings).toBeNull();
	});
});
