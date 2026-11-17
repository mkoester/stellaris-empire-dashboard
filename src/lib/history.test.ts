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
// we met 7 and have intel 30 on it: its systems, colonies and wars
const input = (date: string, h: HistoryReading, communications: number[]): HistoryInput => ({
	date,
	history: h,
	communications,
	wars: [],
	met: [7],
	intel: [[7, 30]]
});

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
	it('a stranger stays unknown, even met, below its intel', () => {
		expect(ownersAt(h.changes, '2211.06.01').has(3)).toBe(false);
		const metNine = inputs.map((x) => ({
			...x,
			met: [7, 9],
			intel: [[7, 30]] as [number, number][]
		}));
		expect(ownersAt(knownHistory(metNine, 0).changes, '2211.06.01').has(3)).toBe(false);
		// the spoiler: everything about the empires we met
		expect(ownersAt(knownHistory(metNine, 0, 'met').changes, '2211.06.01').get(3)).toBe(9);
	});
	it('too little intel hides a met empire’s systems', () => {
		const low = knownHistory(
			inputs.map((x) => ({ ...x, intel: [[7, 20]] as [number, number][] })),
			0
		);
		expect(ownersAt(low.changes, '2211.06.01').has(2)).toBe(false);
		expect(low.known.sort()).toEqual([0, 7]); // its wars, from diplomacy 1
	});
	it('names a stranger as we know it, its own name only with the cheat', () => {
		const met = inputs.map((x) => ({
			...x,
			names: [[9, 'Nine Aliens']] as [number, string][]
		}));
		expect(knownHistory(met, 0).names[9]).toBe('Nine Aliens');
		expect(knownHistory(inputs, 0).names[9]).toBeUndefined();
		expect(knownHistory(met, 0, 'all').names[9]).toBe('Nine');
	});
	it('a war with a stranger in it goes without its name, made of their own names', () => {
		const war = {
			id: 'w1',
			name: 'Seven-Nine War',
			start: '2210.06.01',
			attackers: [7],
			defenders: [9]
		};
		const at = (all: boolean) =>
			knownHistory(
				inputs.map((x) => ({ ...x, wars: [war] })),
				0,
				all ? 'all' : 'known'
			).events.find((e) => e.kind === 'war')?.text;
		expect(at(false)).not.toContain('Seven-Nine War');
		expect(at(true)).toContain('Seven-Nine War');
	});
	it('the cheat shows everything', () => {
		const everything = knownHistory(inputs, 0, 'all');
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
