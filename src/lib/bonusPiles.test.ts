import { describe, expect, it } from 'vitest';
import {
	defaultPreset,
	factor,
	impact,
	matchLines,
	partSum,
	presets,
	reaches,
	realGain
} from './bonusPiles.ts';

const only =
	(k: string) =>
	(key: string): { target: string | null } | null =>
		key === k ? { target: null } : null;

describe('factor', () => {
	it('scales output and cost by (1 + pile + x) ÷ (1 + pile)', () => {
		expect(factor('output', 0.5, 0.1)).toBeCloseTo(1.6 / 1.5);
		// −10 % upkeep on top of −20 % saves 12.5 % of what is paid now
		expect(factor('cost', -0.2, -0.1)).toBeCloseTo(0.875);
	});
	it('divides a time by the speed', () => {
		// +10 % on top of +48 %: 1.48 ÷ 1.58 of the time
		expect(factor('speed', 0.48, 0.1)).toBeCloseTo(1.48 / 1.58);
	});
	it('never goes below nothing', () => {
		expect(factor('cost', -0.9, -0.5)).toBe(0);
		expect(factor('speed', -1, -0.5)).toBe(Infinity);
	});
	it('agrees with realGain on output', () => {
		expect(factor('output', 0.48, 0.1) - 1).toBeCloseTo(realGain(0.1, 0.48));
	});
});

describe('impact', () => {
	const parts = [
		{ label: 'a', sum: 0, base: 100, targets: ['energy'], resource: 'energy' },
		{ label: 'b', sum: 1, base: 100, targets: ['minerals'], resource: 'minerals' },
		{ label: 'c', sum: 0, base: null, targets: [] }
	];
	it('sums each part’s change per resource', () => {
		const r = impact('output', parts, 0.1);
		expect(r.totals.energy).toBeCloseTo(10);
		expect(r.totals.minerals).toBeCloseTo(5);
		expect(r.each[2]).toMatchObject({ change: null });
		expect(r.each[2].rel).toBeCloseTo(0.1);
	});
	it('reaches only the parts a targeted bonus names', () => {
		const r = impact('cost', parts, -0.1, 'energy');
		expect(r.each.map((p) => p.label)).toEqual(['a']);
		expect(r.totals.energy).toBeCloseTo(-10);
	});
	it('shortens a time', () => {
		const r = impact('speed', [{ label: 't', sum: 0, base: 360, targets: [] }], 0.2);
		expect(r.each[0].change).toBeCloseTo(-60);
	});
});

describe('lines', () => {
	const sources = [
		{
			ref: 'tech:a',
			name: 'A',
			modifiers: [
				{ key: 'ships_upkeep_mult', value: -0.1 },
				{ key: 'other', value: 1 }
			]
		},
		{ ref: 'perk:b', name: 'B', modifiers: [{ key: 'ships_upkeep_mult', value: -0.05 }], count: 2 },
		{
			ref: 'tradition:c',
			name: 'C',
			modifiers: [{ key: 'ships_upkeep_mult', value: -0.5, when: { kind: 'x' } as never }]
		}
	];
	it('takes what the pile matches, × count, conditional ones out', () => {
		const l = matchLines(sources, only('ships_upkeep_mult'));
		expect(l.map((x) => [x.name, x.value])).toEqual([
			['A', -0.1],
			['B', -0.1]
		]);
		expect(partSum(l, { targets: [] })).toBeCloseTo(-0.2);
	});
	it('a targeted line reaches only its target', () => {
		const l = [{ ref: '', name: '', value: 0.1, target: 'physics' }];
		expect(partSum(l, { targets: ['society'] })).toBe(0);
		expect(reaches(null, { targets: [] })).toBe(true);
	});
});

describe('presets', () => {
	const m = (key: string, value: number) => ({ key, value, label: null, positiveIsGood: true });
	const explain = {
		'tech:t1': { title: 'Tech 1', modifiers: [m('k', 0.1)] },
		'tradition:t2': { title: 'Trad 2', modifiers: [m('k', 0.1)] },
		'building:b': { title: 'Building', modifiers: [m('k', 0.1), m('k', 0.25)] },
		'civic:c': { title: 'Civic', modifiers: [m('k', 0.05)] },
		'modifier:event': { title: 'Event', modifiers: [m('k', 0.05), m('k', 0.05)] }
	};
	it('ranks values by how many chosen sources give them, names the earliest kind', () => {
		// a tie goes to the bigger value; the kept ones by value
		const p = presets(explain, only('k'), 2);
		expect(p).toEqual([
			{ value: 0.1, target: null, example: 'Tech 1', count: 3 },
			{ value: 0.25, target: null, example: 'Building', count: 1 }
		]);
	});
	it('leaves static modifiers out', () => {
		expect(presets(explain, only('k')).find((x) => x.example === 'Event')).toBeUndefined();
	});
});

describe('defaultPreset', () => {
	const p = (value: number, count: number) => ({ value, target: null, example: '', count });
	it('picks the most common that helps', () => {
		const list = [p(-0.5, 9), p(0.05, 3), p(0.1, 5), p(0.2, 1)];
		expect(defaultPreset(list, 1)).toBe(2);
		expect(defaultPreset(list, -1)).toBe(0);
		expect(defaultPreset([p(0.1, 1)], -1)).toBe(-1);
		// a tie goes to the smaller: −15 % before a civic's −90 %
		expect(defaultPreset([p(-0.9, 1), p(-0.15, 1)], -1)).toBe(1);
	});
});
