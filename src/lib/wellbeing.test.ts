import { describe, expect, it } from 'vitest';
import { amenities, happinessStability, stabilityOutput, wellbeingRules } from './wellbeing.ts';

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
});
