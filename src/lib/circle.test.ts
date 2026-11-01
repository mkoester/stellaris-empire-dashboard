import { describe, expect, it } from 'vitest';
import { chord, circleSlots, placeOnCircle } from './circle.ts';

describe('circle', () => {
	it('puts a gap after each group, only when there are several', () => {
		expect(circleSlots([[1, 2]])).toEqual([
			{ id: 1, group: 0 },
			{ id: 2, group: 0 }
		]);
		expect(circleSlots([[1], [2]]).map((s) => s.id)).toEqual([1, -1, 2, -1]);
	});
	it('starts at 12 o’clock and runs clockwise', () => {
		const at = placeOnCircle(circleSlots([[1, 2, 3, 4]]), { x: 0, y: 0 }, 10);
		const round = (p?: { x: number; y: number }) => [Math.round(p!.x), Math.round(p!.y)];
		// SVG's y grows down: 12 o'clock is y −10, 3 o'clock x +10
		expect([1, 2, 3, 4].map((id) => round(at.get(id)))).toEqual([
			[0, -10],
			[10, 0],
			[0, 10],
			[-10, 0]
		]);
	});
	it('bends a chord towards the centre', () => {
		expect(chord({ x: 0, y: -10 }, { x: 10, y: 0 }, { x: 0, y: 0 })).toBe(
			'M0,-10 Q2.75,-2.75 10,0'
		);
	});
});
