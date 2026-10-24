import { describe, expect, it } from 'vitest';
import { jobFlows, jobRows, jobSources, openJobs, stratumName, withFlows } from './jobs.ts';
import type { BudgetSource } from './types.ts';

describe('jobRows', () => {
	const info = {
		farmer: { name: 'Farmer', category: 'worker' },
		foundry: { name: 'Metallurgist', category: 'specialist' },
		civilian: { name: 'Civilian', category: 'civilian' }
	};

	it('sums jobs over colonies and orders them by stratum, then pops', () => {
		const rows = jobRows(
			[
				{ type: 'civilian', pops: 1907, filled: 1906, positions: null },
				{ type: 'farmer', pops: 800, filled: 800, positions: 800 },
				{ type: 'foundry', pops: 150, filled: 150, positions: 150 },
				{ type: 'farmer', pops: 100, filled: 100, positions: 200 },
				{ type: 'unknown_job', pops: 5, filled: 5, positions: 5 }
			],
			info
		);
		expect(rows.map((r) => [r.name, r.pops, r.positions])).toEqual([
			['Metallurgist', 150, 150],
			['Farmer', 900, 1000],
			['Civilian', 1907, null],
			['unknown_job', 5, 5]
		]);
	});

	it("a gestalt's drones in the game's order: complex, menial, maintenance (Yorphia 2201.10)", () => {
		const drones = {
			maintenance_drone: { name: 'Maintenance Drone', category: 'maintenance_drone' },
			mining_drone: { name: 'Mining Drone', category: 'simple_drone' },
			replicator: { name: 'Replicator', category: 'complex_drone' }
		};
		const rows = jobRows(
			[
				{ type: 'maintenance_drone', pops: 1386, filled: 1385, positions: null },
				{ type: 'mining_drone', pops: 800, filled: 800, positions: 800 },
				{ type: 'replicator', pops: 300, filled: 300, positions: 300 }
			],
			drones
		);
		expect(rows.map((r) => stratumName(r.category))).toEqual([
			'complex drone',
			'menial drone',
			'maintenance drone'
		]);
	});
});

describe('jobFlows', () => {
	const info = {
		farmer: { name: 'Farmer', category: 'worker' },
		foundry: { name: 'Metallurgist', category: 'specialist' },
		technician: { name: 'Technician', category: 'worker' },
		primitive_farmer: { name: 'Farmer', category: 'worker' }
	};
	// Sources as in the 2200.05.01 budget.
	const budget: BudgetSource[] = [
		{ source: 'planet_farmers', income: { food: 107.26 }, expenses: {} },
		{ source: 'planet_metallurgists', income: { alloys: 10.16 }, expenses: { minerals: 10.8 } },
		{ source: 'planet_technician', income: { energy: 74.5 }, expenses: {} },
		{ source: 'planet_buildings', income: {}, expenses: { energy: 11 } },
		{ source: 'pop_category_workers', income: { trade: 3.6 }, expenses: {} }
	];

	it('maps planet_<job> sources to job types by key or name, plural or not', () => {
		expect(jobFlows(budget, info, {})).toEqual({
			farmer: { food: 107.26 },
			foundry: { alloys: 10.16, minerals: -10.8 },
			technician: { energy: 74.5 }
		});
	});

	it('gives a planet its pops share, marked as estimated when partial', () => {
		const rows = jobRows([{ type: 'farmer', pops: 200, filled: 200, positions: 200 }], info);
		const [r] = withFlows(rows, { farmer: { food: 100 } }, { farmer: 800 });
		expect(r.flows).toEqual({ food: 25 });
		expect(r.estimated).toBe(true);
		expect(withFlows(rows, { farmer: { food: 100 } }, { farmer: 200 })[0].estimated).toBe(false);
	});
});

describe('jobSources for a gestalt', () => {
	// Yorphia 2203.10.01 (Machine Intelligence): drone jobs book under the organic jobs' sources.
	const info = {
		technician: { name: 'Technician', category: 'worker', budgetSource: 'planet_technician' },
		technician_drone: {
			name: 'Technician Drone',
			category: 'simple_drone',
			budgetSource: 'planet_technician'
		},
		patrol_drone: { name: 'Patrol Drone', category: 'complex_drone', budgetSource: 'planet_jobs' },
		evaluator: { name: 'Evaluator', category: 'complex_drone', budgetSource: 'planet_jobs' },
		replicator: {
			name: 'Replicator',
			category: 'complex_drone',
			budgetSource: 'planet_pop_assemblers'
		}
	};
	const budget: BudgetSource[] = [
		{ source: 'planet_technician', income: { energy: 60 }, expenses: {} },
		{ source: 'planet_jobs', income: { unity: 9 }, expenses: { energy: 3 } },
		{ source: 'planet_pop_assemblers', income: {}, expenses: { minerals: 12 } }
	];

	it('gives a source to the job the empire works with it', () => {
		const s = jobSources(budget, info, {
			technician_drone: 300,
			patrol_drone: 100,
			replicator: 50
		});
		expect(s.technician_drone).toEqual({ income: { energy: 60 }, expenses: {} });
		expect(s.technician).toBeUndefined();
		expect(s.replicator).toEqual({ income: {}, expenses: { minerals: 12 } });
		expect(s.patrol_drone).toEqual({ income: { unity: 9 }, expenses: { energy: 3 } });
	});

	it('splits a source several worked jobs share by pops, marked shared', () => {
		const s = jobSources(budget, info, { patrol_drone: 100, evaluator: 200 });
		expect(s.patrol_drone).toEqual({ income: { unity: 3 }, expenses: { energy: 1 }, shared: true });
		expect(s.evaluator).toEqual({ income: { unity: 6 }, expenses: { energy: 2 }, shared: true });
	});

	it('marks rows of a shared source as estimated', () => {
		const rows = jobRows([{ type: 'evaluator', pops: 200, filled: 200, positions: 200 }], info);
		expect(
			withFlows(rows, { evaluator: { unity: 6 } }, undefined, new Set(['evaluator']))[0]
		).toMatchObject({ estimated: true });
	});
});

describe('openJobs', () => {
	// Earth 2200.05: 1 open job, an enforcer post, with crime automation on.
	const jobs = [
		{ type: 'enforcer', pops: 99, filled: 99, positions: 100 },
		{ type: 'miner', pops: 400, filled: 400, positions: 400 },
		{ type: 'civilian', pops: 1911, filled: 1911, positions: null }
	];
	const automation = (enabled: boolean, settings: string[]) => ({ enabled, settings });

	it('sets open enforcer posts apart when crime automation is on', () => {
		expect(
			openJobs({ openJobs: 1, jobs, automation: automation(true, ['planet_automation_crime']) })
		).toEqual({
			open: 0,
			reserved: 1
		});
	});

	it('counts them when automation or its crime setting is off', () => {
		expect(
			openJobs({ openJobs: 1, jobs, automation: automation(false, ['planet_automation_crime']) })
		).toEqual({
			open: 1,
			reserved: 0
		});
		expect(openJobs({ openJobs: 1, jobs, automation: automation(true, []) }).reserved).toBe(0);
	});
});
