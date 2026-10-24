import { describe, expect, it } from 'vitest';
import {
	at,
	changesOf,
	defaultWeights,
	rank,
	simulate,
	strategies,
	type Knobs,
	type TradeOption
} from './tradeoffs.ts';

// A mining station (100 minerals → 3 minerals, −1 energy) against a mining district (300 minerals
// → 200 miners at 0.02 minerals each = 4, −1 energy, 240 days).
const station: TradeOption = {
	id: 'station:9',
	kind: 'station',
	what: 'mining_station',
	label: 'mining station',
	where: 'Mars',
	colony: null,
	count: 1,
	cost: { minerals: 100 },
	upkeep: { energy: 1 },
	output: { minerals: 3 },
	pops: 0,
	days: 90,
	groups: ['station', 'station_gatherers']
};
const district: TradeOption = {
	id: 'district:3:district_mining',
	kind: 'district',
	what: 'district_mining',
	label: 'Mining District',
	where: 'Earth',
	colony: 3,
	count: 2,
	cost: { minerals: 300 },
	upkeep: { energy: 1 },
	output: { minerals: 4 },
	pops: 200,
	days: 240,
	groups: ['district', 'jobs', 'job:miner', 'stratum:worker']
};
const knobs: Knobs = { weights: defaultWeights(['minerals', 'energy']), changes: [], months: 24 };

describe('rank', () => {
	it('orders by payback: cost value over net value per month', () => {
		const [first, second] = rank([district, station], knobs);
		expect(first.id).toBe('station:9');
		expect(first.payback).toBe(50); // 100 / (3 − 1)
		expect(second.payback).toBe(100); // 300 / (4 − 1)
	});

	it('takes the changes in force by the month', () => {
		const cheaper = changesOf('Tech X', 6, { planet_districts_cost_mult: -0.2 });
		expect(rank([district], { ...knobs, changes: cheaper }, 5)[0].costValue).toBe(300);
		expect(rank([district], { ...knobs, changes: cheaper }, 6)[0].costValue).toBe(240);
	});
});

describe('changesOf', () => {
	it('maps modifier keys to what they change, the rest left out', () => {
		expect(
			changesOf('T', 3, {
				station_gatherers_produces_mult: 0.25,
				planet_miners_minerals_produces_mult: 0.1,
				planet_jobs_worker_produces_mult: 0.05,
				planet_jobs_simple_drone_produces_mult: 0.05,
				planet_jobs_energy_produces_mult: 0.1,
				country_unity_produces_mult: 0.1
			}).map(({ target, groups, resource }) => ({ target, groups, resource }))
		).toEqual([
			{ target: 'output', groups: ['station_gatherers'], resource: undefined },
			{ target: 'output', groups: ['job:miner'], resource: 'minerals' },
			{ target: 'output', groups: ['stratum:worker'], resource: undefined },
			{ target: 'output', groups: ['stratum:simple_drone'], resource: undefined },
			{ target: 'output', groups: ['jobs'], resource: 'energy' }
		]);
	});

	it("scales only the named resource of a job's output", () => {
		const [c] = changesOf('T', 0, { planet_miners_minerals_produces_mult: 0.5 });
		const both = { ...district, output: { minerals: 4, energy: 2 } };
		expect(at(both, [c], 0).output).toEqual({ minerals: 6, energy: 2 });
	});
});

describe('simulate', () => {
	const start = {
		stockpile: { minerals: 100, energy: 50 },
		income: { minerals: 50 },
		idle: { 3: 400 }
	};

	it('saves up for the next option and produces once it is built', () => {
		const run = simulate([station], start, { ...knobs, months: 4 }, { name: 'x' });
		expect(run.bought).toEqual([{ month: 0, label: 'mining station (Mars)' }]);
		// built at month 0, producing from month 3 (90 days): +3 minerals −1 energy on top
		expect(run.net).toEqual([50, 50, 50, 52, 52]);
	});

	it('needs idle pops for jobs, and builds a district as often as there is room', () => {
		const rich = { ...start, stockpile: { minerals: 10000 } };
		const run = simulate([district], { ...rich, idle: { 3: 300 } }, knobs, { name: 'x' });
		expect(run.bought).toHaveLength(1); // 300 idle pops: one district of 200
		const roomy = simulate([district], { ...rich, idle: { 3: 500 } }, knobs, { name: 'x' });
		expect(roomy.bought).toHaveLength(2); // count 2
	});

	it('waits for a cost cut when the strategy says so', () => {
		const cut = changesOf('Tech X', 6, { planet_districts_cost_mult: -0.5 });
		const rich = { ...start, stockpile: { minerals: 1000 } };
		const s = strategies([district], cut).find((x) => x.waitFor)!;
		const run = simulate([district], rich, { ...knobs, changes: cut }, s);
		expect(run.bought[0].month).toBe(6);
	});

	it('compares against building nothing', () => {
		const none = strategies([station], []).find((s) => s.none)!;
		expect(simulate([station], start, knobs, none).bought).toEqual([]);
	});
});
