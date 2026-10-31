import { describe, expect, it } from 'vitest';
import {
	amenities,
	amenityRoom,
	approvalRoom,
	happinessStability,
	roomRates,
	stabilityOutput,
	uncappedStability,
	wellbeingRules
} from './wellbeing.ts';

const r = wellbeingRules({}, () => undefined); // the 4.5.2 values as fallbacks

describe('wellbeing', () => {
	// the nomad game's arkship, 2202.09.01: 12,910 amenities for 5,040 needed
	it('gives amenities a bonus up to twice the need, the rest wasted', () => {
		const a = amenities(12909.83, 5040, false, r)!;
		expect(a.effect).toBeCloseTo(0.2);
		expect(a).toMatchObject({ on: 'happiness', short: 0, useful: 0 });
		expect(a.wasted).toBeCloseTo(2829.83);
		const half = amenities(7560, 5040, false, r)!; // 1.5× the need
		expect(half.effect).toBeCloseTo(0.1);
		expect(half.useful).toBeCloseTo(2520);
	});

	it('and a penalty below the need, full at a quarter of it', () => {
		expect(amenities(1260, 5040, false, r)!.effect).toBeCloseTo(-0.5);
		expect(amenities(3150, 5040, false, r)!).toMatchObject({ short: 1890 });
		expect(amenities(3150, 5040, false, r)!.effect).toBeCloseTo(-0.25);
		expect(amenities(0, 0, false, r)).toBeNull();
	});

	it("moves a gestalt's stability instead", () => {
		const a = amenities(10080, 5040, true, r)!;
		expect(a).toMatchObject({ on: 'stability', effect: 20 });
		expect(amenities(1260, 5040, true, r)!.effect).toBeCloseTo(-50);
	});

	it('turns approval into stability and stability into job output', () => {
		expect(happinessStability(0.975, r)).toBeCloseTo(28.5);
		expect(happinessStability(0.5, r)).toBe(0);
		expect(happinessStability(0, r)).toBeCloseTo(-50);
		expect(stabilityOutput(98.143, r)).toBeCloseTo(0.2889, 3);
		expect(stabilityOutput(25, r)).toBeCloseTo(-0.25);
		expect(stabilityOutput(120, r)).toBeCloseTo(0.3);
	});

	// the nomad game's arkship, 2205.06.01 (screenshot 2026-10-31_08-50-48): stability 100, the
	// tooltip's sources 10 + 5.6 + 17 = 32.6 flat and approval 95.43 % → +27, 109.6 in all
	it('rebuilds the stability above the cap from the flat sum and approval', () => {
		expect(uncappedStability(32.6, 0, 0.9543, false, r)).toBeCloseTo(109.86, 2);
		expect(uncappedStability(32.6, 0.1, 0.9543, false, r)).toBeCloseTo(120.84, 2);
		expect(uncappedStability(32.6, 0, 0.9543, true, r)).toBeCloseTo(82.6);
		expect(uncappedStability(null, 0, 0.9543, false, r)).toBeNull();
		expect(uncappedStability(undefined, 0, 0.9543, false, r)).toBeNull();
	});

	it('turns the stability above the cap into approval and amenities that could go', () => {
		const a = approvalRoom(9.6, 0.9543, r);
		expect(a.all).toBe(false);
		expect(a.drop).toBeCloseTo(0.16); // 0.6 stability per point of approval above 50 %
		const m = amenityRoom(a.drop, 11724.3125, 6182, false, r)!;
		expect(m.all).toBe(false);
		// +17.9 % happiness at 190 % of the need → +1.9 % at 110 %
		expect(m.amount).toBeCloseTo(11724.3125 - 1.0966 * 6182, -1);
		// below 50 % approval a point costs a full stability point
		expect(approvalRoom(40, 0.9543, r).drop).toBeCloseTo(0.4543 + 12.742 / 100, 3);
		expect(approvalRoom(100, 0.9543, r)).toMatchObject({ all: true });
		expect(approvalRoom(-5, 0.9543, r).drop).toBe(0);
	});

	it('lets wasted amenities go first, then down to the full penalty', () => {
		// 2.5× the need: the half beyond 2× is free, the rest pays in happiness
		expect(amenityRoom(0, 15000, 6000, false, r)!.amount).toBeCloseTo(3000);
		expect(amenityRoom(0.2, 15000, 6000, false, r)!.amount).toBeCloseTo(9000);
		expect(amenityRoom(0.45, 15000, 6000, false, r)!.amount).toBeCloseTo(15000 - 0.625 * 6000); // −25 %: halfway down the penalty
		expect(amenityRoom(0.8, 15000, 6000, false, r)).toMatchObject({ all: true });
		// a gestalt's effect is stability itself
		expect(amenityRoom(10, 12000, 6000, true, r)!.amount).toBeCloseTo(3000);
		expect(amenityRoom(1, 0, 0, false, r)).toBeNull();
	});

	it('gives the rates for a colony whose overshoot is unknown', () => {
		const k = roomRates(6182, false, r);
		expect(k.approvalPerStability * 100).toBeCloseTo(1.667, 3);
		expect(k.amenitiesPerEffect / 100).toBeCloseTo(309.1, 1);
	});
});
