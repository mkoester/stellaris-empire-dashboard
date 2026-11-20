import { describe, expect, it } from 'vitest';
import { antiCrime, crimeColony, crimeLords, type CrimeColony } from './crime.ts';

// 4 enforcer jobs (400 workforce) hold 100 crime down to 20: 120 before them
const colony: CrimeColony = {
	crime: 20,
	enforcers: 400,
	enforcerUpkeep: { consumer_goods: 4 },
	open: 1000,
	idle: 50,
	perWorkforce: { energy: 0.05 }
};

describe('antiCrime', () => {
	it('needs 1/25 − 1/35 of a job fewer per crime point above the target', () => {
		const e = antiCrime(colony);
		// 120 crime before enforcers, 95 above 25: 3.8 jobs at 25, 2.71 at 35
		expect(e.enforcersWithout).toBeCloseTo(380);
		expect(e.enforcersWith).toBeCloseTo((95 / 35) * 100);
		const freed = 380 - (95 / 35) * 100;
		expect(e.monthly.energy).toBeCloseTo(0.05 * freed);
		expect(e.upkeep.consumer_goods).toBeCloseTo((-4 * freed) / 400);
		// +2 energy on the kept ones against today's 4 (the modifier books today's)
		expect(e.upkeep.energy).toBeCloseTo(((95 / 35) * 100 - 400) / 50);
		expect(e.stability).toBeCloseTo((-0.2 * freed) / 100);
		expect(e.crimeWith).toBe(e.crimeWithout);
	});
	it('frees nothing where crime stays under the target without enforcers', () => {
		const e = antiCrime({ ...colony, crime: 10, enforcers: 0 });
		expect(e.enforcersWith).toBe(0);
		expect(e.monthly.energy ?? 0).toBeCloseTo(0);
	});
	it('counts freed workforce only into open jobs', () => {
		const e = antiCrime({ ...colony, open: 10 });
		expect(e.monthly.energy).toBeCloseTo(0.05 * 10);
	});
});

describe('crimeLords', () => {
	it('takes criminal workforce past the unemployed, and enforcers for +50 % crime, from jobs', () => {
		const e = crimeLords(colony);
		// 200 + 3 per crime point at 25, less 50 unemployed
		expect(e.criminalsTaken).toBe(225);
		// 180 crime: 155 above 25 against 95 → 2.4 more jobs
		expect(e.enforcersWith - e.enforcersWithout).toBeCloseTo(240);
		expect(e.monthly.energy).toBeCloseTo(-0.05 * (225 + 240));
		expect(e.upkeep.consumer_goods).toBeCloseTo((4 * 240) / 400);
	});
	it('raises crime itself where it stays under the target', () => {
		const e = crimeLords({ ...colony, crime: 12, enforcers: 0 });
		expect(e.crimeWithout).toBe(12);
		expect(e.crimeWith).toBe(18);
		expect(e.enforcersWith).toBe(0);
	});
	it('takes no criminals from jobs where the unemployed fill them', () => {
		expect(crimeLords({ ...colony, idle: 500 }).criminalsTaken).toBe(0);
		// 12 crime → 18 under the deal: 254 criminals
		expect(crimeLords({ ...colony, crime: 12, enforcers: 0, idle: 0 }).criminalsTaken).toBe(254);
	});
});

describe('crimeColony', () => {
	it('splits enforcers from the jobs that would take freed workforce', () => {
		const c = crimeColony(
			[
				{ type: 'enforcer', filled: 200, flows: { consumer_goods: -2 } },
				{ type: 'criminal', filled: 100, flows: {} },
				{ type: 'technician', filled: 300, flows: { energy: 18, minerals: -3 } }
			],
			12,
			100,
			-5
		)!;
		expect(c.enforcers).toBe(200);
		expect(c.enforcerUpkeep).toEqual({ consumer_goods: 2 });
		expect(c.perWorkforce.energy).toBeCloseTo(0.06);
		expect(c.perWorkforce.minerals).toBeCloseTo(-0.01);
		expect(c.idle).toBe(0);
	});
	it('is null without crime in the save', () => {
		expect(crimeColony([], null, 0, 0)).toBeNull();
	});
});
