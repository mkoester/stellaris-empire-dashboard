import { describe, expect, it } from 'vitest';
import { upgrade } from './upgrade.ts';

describe('upgrade', () => {
	// A snapshot as the first dashboard version stored it: no jobs, happiness, market, …
	const old = {
		kind: 'save' as const,
		campaign: 'c',
		date: '2200.02.01',
		fingerprint: '1:2',
		empireName: 'E',
		pops: 5200,
		stockpile: { energy: 1 },
		balance: { energy: 2 },
		colonies: [{ planetId: 3, name: 'Earth', pops: 5200, buildQueueId: null }],
		progress: {
			research: [],
			agenda: null,
			traditionsTaken: 0,
			nextElection: null,
			costSettings: { technology: 1, traditions: 1 }
		}
	};

	it('fills what an older snapshot lacks and keeps what it has', () => {
		const s = upgrade(old as never);
		expect(s.pops).toBe(5200);
		expect(s.marketOrders).toEqual([]);
		expect(s.score).toBeNull();
		expect(s.colonies[0]).toMatchObject({ name: 'Earth', pops: 5200, jobs: [], happiness: null });
		expect(s.colonies[0].automation).toEqual({ enabled: false, settings: [] });
		expect(s.progress?.researched).toEqual([]);
	});

	it('marks no capital on systems stored before the flag existed', () => {
		const sys = { id: 380, name: 'Sol', x: -6, y: 279, owned: true, lanes: [] };
		const s = upgrade({ ...old, knownSystems: [sys] } as never);
		expect(s.knownSystems).toEqual([{ ...sys, capital: false }]);
	});

	it('leaves a current snapshot as it is', () => {
		const s = upgrade(old as never);
		expect(upgrade(s)).toEqual(s);
	});
});
