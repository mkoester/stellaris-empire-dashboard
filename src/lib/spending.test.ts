import { describe, expect, it } from 'vitest';
import { unbooked } from './series.ts';
import { namedSpending, type SpendData } from './spending.ts';
import type { Snapshot } from './types.ts';

const data: SpendData = {
	names: { district_city: 'City District' },
	edicts: {
		education_campaign: { name: 'Education Campaign', cost: { cost: { energy: 15 } } },
		recycling_campaign: { name: 'Recycling Campaign', cost: { cost: { energy: 15 } } }
	},
	shipCosts: { mining_station: { minerals: 100 } }
};

const constructor = (orders: { orderId: number; size: string; target: string }[]) => {
	const [order, ...queue] = orders.map((o) => ({
		kind: 'build_orbital_station',
		progress: 0,
		...o
	}));
	return { fleetId: 7, kind: 'constructor', order, queue };
};

// Shapes as in 2207.03.10 → 04.01 → 04.02: two campaigns, a city district on Earth, a station.
const snap = (date: string, fields: Partial<Snapshot>) =>
	({
		kind: 'save',
		date,
		stockpile: {},
		balance: {},
		construction: [],
		edicts: [],
		civilianShips: [],
		leaderRoster: [],
		logEvents: null,
		ticks: null,
		...fields
	}) as unknown as Snapshot;

const history = [
	snap('2207.03.10', {
		stockpile: { energy: 4726.33, minerals: 828.21 },
		edicts: ['map_the_stars']
	}),
	snap('2207.04.01', {
		stockpile: { energy: 4699.79, minerals: 900.46 },
		balance: { energy: 3.46, minerals: 72.25 },
		edicts: ['map_the_stars', 'education_campaign', 'recycling_campaign']
	}),
	snap('2207.04.02', {
		stockpile: { energy: 4699.79, minerals: 300.46 },
		balance: { energy: 3.46, minerals: 72.25 },
		edicts: ['map_the_stars', 'education_campaign', 'recycling_campaign'],
		construction: [
			{ id: 1, kind: 'district', name: 'district_city', where: 'Earth', cost: { minerals: 500 } }
		],
		civilianShips: [
			// the second order is queued, not started: not paid yet
			constructor([
				{ orderId: 20, size: 'mining_station', target: 'Procyon II' },
				{ orderId: 21, size: 'mining_station', target: 'Procyon III' }
			])
		] as unknown as Snapshot['civilianShips'],
		leaderRoster: [{ id: 3, name: 'Ada', class: 'scientist' }]
	})
];

describe('namedSpending', () => {
	it('names what appeared between saves: construction, edicts, station orders, leaders', () => {
		expect(namedSpending(history, data)).toEqual([
			{
				date: '2207.04.01',
				label: 'edict: Education Campaign',
				cost: { energy: 15 },
				approx: true
			},
			{
				date: '2207.04.01',
				label: 'edict: Recycling Campaign',
				cost: { energy: 15 },
				approx: true
			},
			{
				date: '2207.04.02',
				label: 'City District (Earth)',
				cost: { minerals: 500 },
				approx: false
			},
			{
				date: '2207.04.02',
				label: 'mining station (Procyon II)',
				cost: { minerals: 100 },
				approx: true
			},
			{ date: '2207.04.02', label: 'scientist hired: Ada', cost: null, approx: false }
		]);
	});

	it("dates a save's item by the mod's event for it; an unmatched event stands alone", () => {
		const withLog = history.map((s) =>
			s.date === '2207.04.02'
				? {
						...s,
						logEvents: [
							{ date: '2207.04.01', kind: 'district-queued' as const, fields: ['Earth'] },
							{ date: '2207.04.02', kind: 'decision' as const, fields: ['Mars'] }
						]
					}
				: s
		);
		const named = namedSpending(withLog, data);
		expect(named.find((n) => n.label === 'City District (Earth)')?.date).toBe('2207.04.01');
		expect(named).toContainEqual({
			date: '2207.04.02',
			label: 'decision enacted (Mars)',
			cost: null,
			approx: false
		});
	});

	it('leaves the budget nothing unexplained once named (the −30 energy, the −600 minerals)', () => {
		const spends = namedSpending(history, data);
		const energy = unbooked(history, 'energy', spends)!;
		expect(energy.named.map((n) => n.amount)).toEqual([-15, -15]);
		expect(energy.unexplained).toBeCloseTo(0);
		const minerals = unbooked(history, 'minerals', spends)!;
		expect(minerals.named.map((n) => n.amount)).toEqual([-500, -100]);
		expect(minerals.unexplained).toBeCloseTo(0);
		expect(minerals.causes).toEqual([{ date: '2207.04.02', label: 'scientist hired: Ada' }]);
	});
});
