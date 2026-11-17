import { describe, expect, it } from 'vitest';
import { daysText, digDays, expectedRolls, researchDays } from './frontierTime.ts';
import { anomalyDays } from './ships.ts';

describe('expectedRolls', () => {
	it('one roll where every die finishes', () => {
		expect(expectedRolls(13)).toBe(1);
	});
	it('a hard chapter takes more rolls than an easy one, clues shorten it', () => {
		const easy = expectedRolls(3 - 1);
		const hard = expectedRolls(3 - 6);
		expect(hard).toBeGreaterThan(easy);
		expect(expectedRolls(3 - 6, 4)).toBeLessThan(hard);
	});
	it('by hand: base 12 — a 1 scores 13 (+2 clues, then any die finishes), the rest finish', () => {
		expect(expectedRolls(12)).toBeCloseTo(1.1, 10);
		// base 11: 1 and 2 score 12–13 (+2 clues, then certain), 3–10 finish
		expect(expectedRolls(11)).toBeCloseTo(1.2, 10);
	});
});

describe('digDays', () => {
	it('the next chapter from its days left, later ones from scratch', () => {
		const d = digDays(3, [1, 2], 0, 30)!;
		expect(d).toBeCloseTo((expectedRolls(2) - 1) * 90 + 30 + expectedRolls(1) * 90, 5);
		expect(digDays(3, [], 0, 30)).toBe(null);
	});
});

describe('researchDays and anomalyDays', () => {
	it('cost at the field’s monthly research', () => {
		expect(researchDays(2000, 'society_technology', { society_research: 100 })).toBe(600);
		expect(researchDays(2000, 'society_technology', {})).toBe(null);
	});
	it('equal levels: 120 days; two below: 300', () => {
		expect(anomalyDays(3, 3)).toBe(120);
		expect(anomalyDays(3, 1)).toBe(300);
	});
	it('daysText', () => {
		expect(daysText(120.4)).toBe('120 d');
		expect(daysText(540)).toBe('1.5 y');
	});
});
