import { describe, expect, it } from 'vitest';
import {
	byEthic,
	colonyEthics,
	embrace,
	ethicRows,
	ethicSeries,
	factionSeries
} from './ethicsTab.ts';
import type { EthicsState, Faction, Snapshot } from './types.ts';

// 4.5.2's ethic index (common/ethics/00_ethics.txt order)
const ORDER = [
	'ethic_fanatic_authoritarian',
	'ethic_authoritarian',
	'ethic_fanatic_egalitarian',
	'ethic_egalitarian',
	'ethic_fanatic_xenophobe',
	'ethic_xenophobe',
	'ethic_fanatic_xenophile',
	'ethic_xenophile',
	'ethic_fanatic_militarist',
	'ethic_militarist',
	'ethic_fanatic_pacifist',
	'ethic_pacifist',
	'ethic_fanatic_spiritualist',
	'ethic_spiritualist',
	'ethic_fanatic_materialist',
	'ethic_materialist',
	'ethic_gestalt_consciousness'
];
const slots = (r: Record<number, number>) => ORDER.map((_, i) => r[i] ?? 0);

// the United Nations of Earth at 2202.08.01 (country 0)
const UNE: EthicsState = {
	pops: slots({ 3: 3385, 5: 2135, 7: 2101, 9: 2700 }),
	attraction: slots({ 3: 58873.5, 5: 17001.6, 7: 41668.8, 9: 38253.6 }),
	change: slots({ 3: 76, 5: -45, 7: 33, 9: -62 }),
	weight: slots({ 1: 0.75, 3: 4.5, 5: 1, 7: 2.4, 9: 1, 11: 0.75, 13: 1, 15: 1 }),
	colonies: [
		{ planetId: 0, pops: slots({ 3: 3245, 7: 2034 }), change: slots({ 3: 1, 7: 1 }) },
		{ planetId: 27, pops: slots({ 3: 75, 5: 2135, 7: 32, 9: 2700 }), change: slots({}) },
		{ planetId: 5, pops: slots({}), change: slots({}) }
	]
};

describe('ethics tab', () => {
	it('maps the save lists to ethic keys, leaving out zeros', () => {
		expect(byEthic(UNE.pops, ORDER)).toEqual({
			ethic_egalitarian: 3385,
			ethic_xenophobe: 2135,
			ethic_xenophile: 2101,
			ethic_militarist: 2700
		});
	});

	it('ranks ethics by attraction and marks the one an embrace would drop', () => {
		const rows = ethicRows(UNE, ORDER, [
			'civic_x',
			'ethic_egalitarian',
			'ethic_xenophile',
			'ethic_pacifist'
		]);
		expect(rows.map((r) => r.key)).toEqual([
			'ethic_egalitarian',
			'ethic_xenophile',
			'ethic_militarist',
			'ethic_xenophobe',
			'ethic_pacifist'
		]);
		expect(rows[0].share).toBeCloseTo(3385 / 10321);
		expect(rows[0].attraction).toBeCloseTo(58873.5 / 155797.5);
		expect(rows[0].average).toBeCloseTo(58873.5 / 10321);
		expect(rows[0].weight).toBe(4.5);
		// pacifist is held but no pop holds it: the weakest pull
		expect(rows.find((r) => r.dropped)?.key).toBe('ethic_pacifist');
		expect(rows.filter((r) => r.held).length).toBe(3);
	});

	it('drops nothing while a fanatic ethic is held: it is demoted instead', () => {
		const rows = ethicRows(UNE, ORDER, ['ethic_fanatic_egalitarian', 'ethic_xenophile']);
		expect(rows.some((r) => r.dropped)).toBe(false);
		expect(rows.find((r) => r.key === 'ethic_egalitarian')?.held).toBe(true);
	});

	it('charts shares per snapshot, gaps where a snapshot has none', () => {
		const snaps = [
			{ date: '2202.07.01', ethics: null },
			{ date: '2202.08.01', ethics: UNE }
		] as unknown as Snapshot[];
		const s = ethicSeries(snaps, ORDER, 'pops', { ethic_egalitarian: 'Egalitarian' });
		expect(Object.keys(s.lines)).toEqual([
			'Egalitarian',
			'ethic_xenophobe',
			'ethic_xenophile',
			'ethic_militarist'
		]);
		expect(s.lines.Egalitarian[0]).toBeNull();
		expect(s.lines.Egalitarian[1]).toBeCloseTo((3385 / 10321) * 100);
	});

	it('charts each faction from when it formed', () => {
		const f = (type: string, name: string, support: number) =>
			({ type, name, support, approval: 0.5 }) as Faction;
		// 2212: an older reading named the technologists "of Scientific Betterment"
		const snaps = [
			{ date: '2210.01.01', factions: [f('technologist', 'of Scientific Betterment', 0.6)] },
			{
				date: '2210.02.01',
				factions: [
					f('technologist', 'Council of Scientific Betterment', 0.5),
					f('totalitarian', 'B', 0.5)
				]
			}
		] as unknown as Snapshot[];
		expect(factionSeries(snaps, 'support').lines).toEqual({
			'Council of Scientific Betterment': [60, 50],
			B: [null, 50]
		});
	});

	it('says what embracing a faction still needs', () => {
		const f = { support: 0.25 } as Faction;
		const gov = ['ethic_fanatic_materialist', 'ethic_authoritarian'];
		expect(embrace(f, 'ethic_egalitarian', gov, 6000, [])).toMatchObject({ possible: true });
		const e = embrace({ support: 0.2 } as Faction, 'ethic_egalitarian', gov, 4999, [
			{ key: 'embraced_faction_timer', until: '2215.01.01' },
			{ key: 'promoted_egalitarian', until: null }
		]);
		expect(e).toMatchObject({
			support: false,
			unity: false,
			cooldownUntil: '2215.01.01',
			promoted: true,
			suppressed: false,
			possible: false
		});
		expect(embrace(f, 'ethic_materialist', gov, 6000, []).fanatic).toBe(true);
	});

	it('lists colonies with pops, the most first', () => {
		const c = colonyEthics(UNE, ORDER);
		expect(c.map((x) => x.planetId)).toEqual([0, 27]);
		expect(c[0].pops).toEqual({ ethic_egalitarian: 3245, ethic_xenophile: 2034 });
	});
});
