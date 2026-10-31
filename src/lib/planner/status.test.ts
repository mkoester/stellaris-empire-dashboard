import { describe, expect, it } from 'vitest';
import { upgrade } from '#lib/upgrade.ts';
import type { State } from './kinds.ts';
import { holdsSince, seenAlong } from './status.ts';

const s = (date: string) => upgrade({ kind: 'save', campaign: 'c', date });
const saves = ['2200.01.01', '2200.02.01', '2200.03.01', '2200.04.01'].map(s);
const by = (states: State[]) => (x: { date: string }) =>
	states[saves.findIndex((y) => y.date === x.date)];

describe('holdsSince', () => {
	it('dates a goal to the first save of its latest run', () => {
		expect(holdsSince(saves, by(['done', 'open', 'done', 'done']))).toEqual({
			date: '2200.03.01',
			exact: true
		});
	});

	it('says "by" when the run reaches the first save or a save that cannot tell', () => {
		expect(holdsSince(saves, by(['done', 'done', 'done', 'done']))).toEqual({
			date: '2200.01.01',
			exact: false
		});
		expect(holdsSince(saves, by(['open', 'unknown', 'done', 'done']))).toEqual({
			date: '2200.03.01',
			exact: false
		});
	});

	it('is null when the latest save does not show it', () => {
		expect(holdsSince(saves, by(['done', 'done', 'done', 'open']))).toBeNull();
	});
});

describe('seenAlong', () => {
	it('collects what any save listed', () => {
		const a = upgrade({
			kind: 'save',
			campaign: 'c',
			date: '1',
			anomalies: [{ planetId: 1, planet: '', systemId: 0, category: '' }]
		});
		const b = upgrade({
			kind: 'save',
			campaign: 'c',
			date: '2',
			anomalies: [{ planetId: 2, planet: '', systemId: 0, category: '' }]
		});
		expect(seenAlong([a, b]).anomalies).toEqual([1, 2]);
	});
});
