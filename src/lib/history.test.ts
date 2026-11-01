import { describe, expect, it } from 'vitest';
import { knownHistory, months, ownersAt, type HistoryInput } from './history.ts';
import type { HistoryReading } from './types.ts';

// us (0), a neighbour we talk to from the second save (7), a stranger (9)
const reading = (
	owners: [number, number][],
	colonies: HistoryReading['colonies'],
	guardians: HistoryReading['guardians'] = []
): HistoryReading => ({
	owners,
	colonies,
	guardians,
	names: [
		[0, 'Us'],
		[7, 'Seven'],
		[9, 'Nine']
	]
});
const input = (
	date: string,
	h: HistoryReading,
	communications: number[],
	visited: number[] = [1]
): HistoryInput => ({ date, history: h, communications, visited, wars: [] });

const inputs = [
	input(
		'2210.01.01',
		reading(
			[
				[1, 0],
				[2, 7],
				[3, 9]
			],
			[
				[10, 0, '2200.01.01', 1],
				[20, 7, '2205.06.01', 2],
				[30, 9, '2201.01.01', 3]
			]
		),
		[]
	),
	input(
		'2211.01.01',
		reading(
			[
				[1, 0],
				[2, 7],
				[4, 7],
				[3, 9]
			],
			[
				[10, 0, '2200.01.01', 1],
				[20, 7, '2205.06.01', 2],
				[30, 9, '2201.01.01', 3]
			],
			[{ flag: 'killed_guardian', countryId: 9, date: '2210.07.01' }]
		),
		[7]
	)
];

describe('knownHistory', () => {
	const h = knownHistory(inputs, 0);
	it('knows us and whom we talk to now, back to the start', () => {
		expect(h.known.sort()).toEqual([0, 7]);
		const owners = ownersAt(h.changes, '2211.06.01');
		expect([...owners].sort()).toEqual([
			[1, 0],
			[2, 7],
			[4, 7]
		]);
	});
	it('a colony predating the first save dates its system back', () => {
		expect(ownersAt(h.changes, '2205.07.01').get(2)).toBe(7);
		expect(ownersAt(h.changes, '2205.05.01').has(2)).toBe(false);
	});
	it('events: colonies we know, a new claim, communications, a guardian (common knowledge)', () => {
		expect(h.events.map((e) => [e.kind, e.date, e.countryId])).toEqual([
			['colony', '2200.01.01', 0],
			['colony', '2205.06.01', 7],
			['guardian', '2210.07.01', 9],
			['gained', '2211.01.01', 7],
			['communications', '2211.01.01', 7]
		]);
	});
	it('a stranger’s system shows where we have been', () => {
		const been = knownHistory(
			inputs.map((x) => ({ ...x, visited: [1, 3] })),
			0
		);
		expect(ownersAt(been.changes, '2211.06.01').get(3)).toBe(9);
	});
	it('the cheat shows everything', () => {
		const everything = knownHistory(inputs, 0, true);
		expect(ownersAt(everything.changes, '2211.06.01').get(3)).toBe(9);
		expect(everything.events.filter((e) => e.kind === 'colony')).toHaveLength(3);
	});
});

describe('months', () => {
	it('from 2200.01 to the last month', () => {
		expect(months('2200.03.15')).toEqual(['2200.01.01', '2200.02.01', '2200.03.01']);
		expect(months('2201.01.01')).toHaveLength(13);
	});
});
