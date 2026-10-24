import { describe, expect, it } from 'vitest';
import { storageRows } from './storage.ts';

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
