import { describe, expect, it } from 'vitest';
import { monthsLeft, storageRows, urgencyColor } from './storage.ts';

const info = {
	energy: { name: 'Energy', aiWeight: 1.5, aiWants: 500, max: 25000, tradable: true },
	alloys: { name: 'Alloys', aiWeight: 5, aiWants: 500, max: 15000, tradable: true },
	unity: { name: 'Unity', aiWeight: 1, aiWants: null, max: null, tradable: false },
	sr_zro: { name: 'Zro', aiWeight: 100, aiWants: 5, max: 15000, tradable: true }
};

describe('storageRows', () => {
	it('without the mod: ≈ the base storage, for what has storage and is held', () => {
		expect(storageRows({ energy: 1200, alloys: 300, unity: 50 }, null, info)).toEqual([
			{ resource: 'energy', name: 'Energy', have: 1200, max: 25000, exact: false },
			{ resource: 'alloys', name: 'Alloys', have: 300, max: 15000, exact: false }
		]);
	});
	it("with companion mod 0.5.0: the game's value, exact", () => {
		const rows = storageRows({ energy: 1200, alloys: 300 }, { energy: 45000, alloys: 35000 }, info);
		expect(rows.map((r) => [r.max, r.exact])).toEqual([
			[45000, true],
			[35000, true]
		]);
	});
	it('a resource the mod did not export stays estimated', () => {
		const [zro] = storageRows({ sr_zro: 10 }, { energy: 45000 }, info);
		expect(zro).toMatchObject({ max: 15000, exact: false });
	});
});

describe('monthsLeft', () => {
	it('growing: until full; shrinking: until empty; still: never', () => {
		expect(monthsLeft(20000, 25000, 18.9)).toBeCloseTo(5000 / 18.9);
		expect(monthsLeft(1200, 25000, -40)).toBeCloseTo(30);
		expect(monthsLeft(1200, 25000, 0)).toBeNull();
	});
	it('already full (or over a lowered limit): 0', () => {
		expect(monthsLeft(25000, 25000, 5)).toBe(0);
		expect(monthsLeft(26000, 25000, 5)).toBe(0);
	});
});

describe('urgencyColor', () => {
	it('grey far off, amber in between, red at a month or less', () => {
		expect(urgencyColor(100)).toBe('rgb(107, 114, 128)');
		expect(urgencyColor(24)).toBe('rgb(107, 114, 128)');
		expect(urgencyColor(Math.sqrt(24))).toBe('rgb(217, 119, 6)'); // halfway on the log scale
		expect(urgencyColor(1)).toBe('rgb(220, 38, 38)');
		expect(urgencyColor(0)).toBe('rgb(220, 38, 38)');
	});
});
