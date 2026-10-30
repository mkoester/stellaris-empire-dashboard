import { describe, expect, it } from 'vitest';
import { nextStage, RESERVES, reserves, reservesAlong, withReserves } from './nomad.ts';
import type { Snapshot } from './types.ts';

// the throwaway nomad game at 2200.02.01 (screenshot 2026_10_30_1: "Medium (50%)", 10069 / 20000,
// +69.8 a month)
const save = {
	date: '2200.02.01',
	stockpile: { energy: 1298.90976, minerals: 14970.94, food: 1669.8 },
	balance: { energy: 98.90976, minerals: -29.06, food: 39.8 },
	storageMax: { energy: 25000, minerals: 15000, food: 25000 },
	situations: [
		{
			id: 20,
			type: 'situation_nomad_economy',
			progress: 10069.84976,
			monthly: 0,
			approach: 'situation_nomad_economy_smooth_spending',
			stage: 2,
			ends: [1000, 5000, 15000, 20000]
		}
	]
} as unknown as Snapshot;

describe('operational reserves', () => {
	it('are the situation: progress, the last stage end, energy and minerals net', () => {
		const r = reserves(save)!;
		expect(r).toMatchObject({ stock: 10069.84976, capacity: 20000, stage: 2, estimated: false });
		expect(r.monthly).toBeCloseTo(69.85);
		expect(reserves({ ...save, situations: [] })).toBeNull();
	});

	it('replace energy and minerals in stockpile, balance and storage', () => {
		const s = withReserves(save, reserves(save));
		expect(s.stockpile).toEqual({ food: 1669.8, [RESERVES]: 10069.84976 });
		expect(s.balance[RESERVES]).toBeCloseTo(69.85);
		expect(s.balance.energy).toBeUndefined();
		expect(s.storageMax).toEqual({
			energy: 25000,
			minerals: 15000,
			food: 25000,
			[RESERVES]: 20000
		});
		expect(withReserves(save, null)).toBe(save);
	});

	it('carry a month only the mod logged forward from the save before, estimated', () => {
		const log = {
			date: '2200.03.01',
			stockpile: { energy: 1400, minerals: 14900 },
			balance: { energy: 100, minerals: -70 },
			situations: null
		} as unknown as Snapshot;
		const [, r] = reservesAlong([save, log]);
		expect(r).toMatchObject({ estimated: true, monthly: 30, capacity: 20000 });
		expect(r!.stock).toBeCloseTo(10099.85);
		// a settled empire's log month stays settled
		expect(reservesAlong([{ ...save, situations: [] }, log])[1]).toBeNull();
	});

	it('names the next level and the months to it', () => {
		const r = reserves(save)!;
		expect(nextStage(r)).toEqual({ stage: 3, months: (15000 - 10069.84976) / r.monthly });
		const down = nextStage({ ...r, monthly: -100 })!;
		expect(down.stage).toBe(1);
		expect(down.months).toBeCloseTo(50.698, 3);
		expect(nextStage({ ...r, monthly: 0 })).toBeNull();
		expect(nextStage({ ...r, stage: 3, monthly: 10 })).toBeNull();
	});
});
