import { describe, expect, it } from 'vitest';
import { gainRows, gains } from './outcomeGains.ts';
import type { OutcomeNode } from './outcomes.ts';

const ctx = { income: { physics_research: 100 }, values: { energy: 1, alloys: 4 } };
const res = (r: string, n: number): OutcomeNode => ({ t: 'res', r, n });

describe('gains', () => {
	it('a random: expected by the odds, sure only what every branch gives', () => {
		const g = gains(
			[
				{
					t: 'random',
					b: [
						{ w: 3, cond: false, e: [res('energy', 100), res('alloys', 10)] },
						{ w: 1, cond: false, e: [res('energy', 20)] }
					]
				}
			],
			ctx
		);
		expect(g.get('res:energy')).toEqual({ sure: 20, exp: 80 });
		expect(g.get('res:alloys')).toEqual({ sure: 0, exp: 7.5 });
	});
	it('an unsettled if is even odds, nothing without an else', () => {
		const g = gains([{ t: 'if', b: [[res('energy', 10)]], else: false }], ctx);
		expect(g.get('res:energy')).toEqual({ sure: 0, exp: 5 });
	});
	it('a choice takes the option worth most in trade', () => {
		const g = gains(
			[
				{
					t: 'event',
					id: 'x.1',
					title: null,
					e: [],
					o: [
						{ name: 'a', cond: false, e: [res('energy', 30)] },
						{ name: 'b', cond: false, e: [res('alloys', 10)] }
					]
				}
			],
			ctx
		);
		expect(g.get('res:alloys')).toEqual({ sure: 10, exp: 10 });
		expect(g.has('res:energy')).toBe(false);
	});
	it('months of income from the income, clamped', () => {
		const g = gains([{ t: 'months', r: 'physics_research', n: 12, min: 250, max: 100000 }], ctx);
		expect(g.get('res:physics_research')).toEqual({ sure: 1200, exp: 1200 });
		const low = gains([{ t: 'months', r: 'physics_research', n: 1, min: 250 }], ctx);
		expect(low.get('res:physics_research')?.sure).toBe(250);
		const unknown = gains([{ t: 'months', r: 'unity', n: 6 }], ctx);
		expect(unknown.get('item:6 months of unity income')).toEqual({ sure: 1, exp: 1 });
	});
	it("a dig site's done chapters count nothing", () => {
		const tree: OutcomeNode[] = [
			{ t: 'chapter', n: 1, difficulty: 1, e: [res('energy', 1)] },
			{ t: 'chapter', n: 2, difficulty: 2, e: [res('energy', 10)] }
		];
		expect(gains(tree, { ...ctx, next: 2 }).get('res:energy')?.exp).toBe(10);
	});
});

describe('gainRows', () => {
	it('sums sources, names them, resources first, months marked ≈', () => {
		const rows = gainRows(
			[
				{
					name: 'A',
					kind: 'anomaly',
					tree: [res('energy', 10), { t: 'tech', k: 'tech_x', name: 'X', p: 0.25 }]
				},
				{ name: 'B', kind: 'project', tree: [{ t: 'months', r: 'energy', n: 1 }] }
			],
			{ income: { energy: 5 }, values: {} },
			{ tech_x: 'Tech X' }
		);
		expect(
			rows.map((r) => [r.label, r.exp, r.approx, r.sources.map((s) => s.name), r.ref])
		).toEqual([
			['energy', 15, true, ['A', 'B'], null],
			['Tech X', 0.25, false, ['A'], 'tech:tech_x']
		]);
		expect(rows[0].sources.map((s) => s.kind)).toEqual(['anomaly', 'project']);
	});
});
