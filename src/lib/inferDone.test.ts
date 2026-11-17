import { describe, expect, it } from 'vitest';
import { inferDone, uniqueMarks, type Evidence } from './inferDone.ts';
import type { OutcomeNode } from './outcomes.ts';

const event = (e: OutcomeNode[], o: OutcomeNode[][] = []): OutcomeNode => ({
	t: 'event',
	id: 'x.1',
	title: null,
	e,
	o: o.map((oe) => ({ name: null, cond: false, e: oe }))
});
const mod = (k: string): OutcomeNode => ({ t: 'modifier', k, name: `${k} name` });
const dep = (k: string): OutcomeNode => ({ t: 'deposit', k, name: null });

const trees = {
	anomaly: {
		A: [event([], [[mod('only_a')], [mod('shared')]])],
		B: [
			{ t: 'random', b: [{ w: 1, cond: false, e: [mod('shared'), dep('d_b')] }] }
		] as OutcomeNode[]
	},
	project: {},
	dig_site: {
		S: [
			{ t: 'chapter', n: 1, difficulty: 1, e: [] },
			{ t: 'chapter', n: 2, difficulty: 2, e: [dep('d_s2')] }
		] as OutcomeNode[]
	}
};
const flags = {
	anomaly: { A: [{ k: 'found_a' }], B: [{ k: 'found_both' }] },
	project: { P: [{ k: 'found_both' }, { k: 'found_p' }] },
	dig_site: { S: [{ k: 'site_ch1', ch: 1 }] }
};
const ev = (e: Partial<Evidence>): Evidence => ({
	flags: new Set(),
	modifiers: new Set(),
	deposits: new Map(),
	...e
});

describe('uniqueMarks', () => {
	const marks = uniqueMarks(trees, flags);
	it('keeps only what one source gives, in options and branches too', () => {
		expect(marks.get('anomaly:A')?.map((m) => m.key)).toEqual(['found_a', 'only_a']);
		expect(marks.get('anomaly:B')?.map((m) => m.key)).toEqual(['d_b']);
		expect(marks.get('project:P')?.map((m) => m.key)).toEqual(['found_p']);
	});
	it('carries a dig site chapter', () => {
		expect(marks.get('dig_site:S')).toEqual([
			{ kind: 'flag', key: 'site_ch1', name: null, ch: 1 },
			{ kind: 'deposit', key: 'd_s2', name: null, ch: 2 }
		]);
	});
});

describe('inferDone', () => {
	const marks = uniqueMarks(trees, flags);
	it('nothing in the save: no answer', () => {
		expect(inferDone(marks.get('anomaly:A'), ev({}), 1)).toBeNull();
		expect(inferDone(undefined, ev({ flags: new Set(['found_a']) }), 1)).toBeNull();
	});
	it('a flag or a modifier says finished, named', () => {
		expect(inferDone(marks.get('anomaly:A'), ev({ modifiers: new Set(['only_a']) }), 1)).toEqual({
			status: 'finished',
			chapter: null,
			by: ['modifier only_a name']
		});
	});
	it('a deposit counts only on its own planet', () => {
		const d = ev({ deposits: new Map([[7, new Set(['d_b'])]]) });
		expect(inferDone(marks.get('anomaly:B'), d, 7)?.status).toBe('finished');
		expect(inferDone(marks.get('anomaly:B'), d, 8)).toBeNull();
		expect(inferDone(marks.get('anomaly:B'), d, null)).toBeNull();
	});
	it('a dig site: the furthest chapter, finished at the last', () => {
		const m = marks.get('dig_site:S');
		expect(inferDone(m, ev({ flags: new Set(['site_ch1']) }), 1, 2)).toMatchObject({
			status: 'chapter',
			chapter: 1
		});
		const both = ev({ flags: new Set(['site_ch1']), deposits: new Map([[1, new Set(['d_s2'])]]) });
		expect(inferDone(m, both, 1, 2)).toMatchObject({ status: 'finished', chapter: 2 });
	});
});
