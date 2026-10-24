import { describe, expect, it } from 'vitest';
import { changeGain, producible, rankFor, type ProduceOption } from './produce.ts';

const option = (id: string, fields: Partial<ProduceOption>): ProduceOption => ({
	id,
	kind: 'district',
	what: id,
	label: id,
	where: 'Earth',
	colony: null,
	count: 1,
	cost: {},
	upkeep: {},
	output: {},
	pops: 0,
	days: 0,
	groups: [],
	basis: 'measured',
	...fields
});

describe('changeGain', () => {
	it('takes each output change’s share of what its group yields now', () => {
		const flows = { 'job:miner': { minerals: 40 }, jobs: { minerals: 40, energy: 60 } };
		expect(
			changeGain(
				[
					{ label: 'e', month: 0, target: 'output', groups: ['job:miner'], pct: 0.1 },
					{
						label: 'e',
						month: 0,
						target: 'output',
						groups: ['jobs'],
						resource: 'energy',
						pct: 0.05
					},
					{ label: 'e', month: 0, target: 'cost', groups: ['district'], pct: -0.2 }
				],
				flows
			)
		).toEqual({ minerals: 4, energy: 3 });
	});
});

describe('rankFor', () => {
	const options = [
		// 500 minerals for +8 alloys, eating 16 minerals and 2 energy a month
		option('foundry', {
			cost: { minerals: 500 },
			upkeep: { energy: 2 },
			output: { alloys: 8, minerals: -16 }
		}),
		// 50 alloys for +6 energy
		option('solar', { kind: 'module', cost: { alloys: 50 }, output: { energy: 6 } }),
		option('nothing', { output: { unity: 1 } })
	];
	it('prices each option per unit over the horizon, cheapest first', () => {
		const rows = rankFor('alloys', options, {}, 60, 4 * 1.3);
		expect(rows.map((r) => r.option.id)).toEqual(['foundry']);
		const [r] = rows;
		expect(r.gain).toBe(8);
		expect(r.uses).toBe(18); // 2 energy + 16 minerals at 1 trade each
		expect(r.perUnit).toBeCloseTo((500 + 60 * 18) / (60 * 8));
		// buying 8 alloys costs 41.6 a month; the foundry saves 41.6 − 18 = 23.6 → 500 / 23.6
		expect(r.payback).toBeCloseTo(500 / 23.6);
	});
	it('does not net what else an option yields against its price', () => {
		const district = option('mining', {
			cost: { minerals: 300 },
			upkeep: { energy: 1 },
			output: { minerals: 18, alloys: 2 }
		});
		const [r] = rankFor('alloys', [district], {}, 60, 5);
		expect(r.also).toBe(18);
		expect(r.perUnit).toBeCloseTo((300 + 60) / 120);
	});
	it('has no payback without a market price, or when buying is cheaper for good', () => {
		expect(rankFor('alloys', options, {}, 60, null)[0].payback).toBeNull();
		expect(rankFor('alloys', options, {}, 60, 2)[0].payback).toBeNull();
	});
	it('lists what can be produced in the given order', () => {
		expect(producible(options, ['energy', 'minerals', 'alloys'])).toEqual([
			'energy',
			'alloys',
			'unity'
		]);
	});
});
