import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { displayName, readSave, sumSources, toSnapshot, type RawSave } from './save.ts';

const raw: RawSave = {
	date: '2210.03.01',
	tick: 3700,
	randomCount: 123,
	countryId: 0,
	empireName: 'Yastun Devourers',
	endGameStart: 150,
	country: {
		num_sapient_pops: 5000,
		empire_size: 50,
		starbase_capacity: 5,
		starbase_capacity_used: 1,
		used_naval_capacity: 15,
		controlled_colonies: [7, 9],
		modules: { standard_economy_module: { resources: { energy: 1200, minerals: 300 } } },
		budget: {
			current_month: {
				income: { planet_jobs: { energy: 10, food: 2 }, trade_policy: { energy: 5 } },
				expenses: { ships: { energy: 4, alloys: 1 } },
				balance: { planet_jobs: { energy: 6 } }
			}
		}
	},
	colonies: {
		'7': {
			num_sapient_pops: 4800,
			stability: 75.2,
			districts: [1, 2, 3],
			final_designation: 'col_capital'
		},
		'9': { num_sapient_pops: 200, districts: 4 }
	},
	planets: {
		'21': { colony: 7, owner: 0, build_queue: 2, name: { key: 'SPEC_Dar-Hesh_planet' } },
		'22': { owner: 0 },
		'23': 'none'
	}
};

describe('toSnapshot', () => {
	const s = toSnapshot(raw, 'camp');

	it('takes identity from date, tick and RNG counter', () => {
		expect(s).toMatchObject({ campaign: 'camp', date: '2210.03.01', fingerprint: '3700:123' });
	});

	it('dates the end game from the galaxy setting, and leaves it unknown when absent', () => {
		expect(s.endGameYear).toBe(2350);
		expect(toSnapshot({ ...raw, endGameStart: null }, 'camp').endGameYear).toBeNull();
	});

	it('reads stockpile and sums budget sources per resource', () => {
		expect(s.stockpile).toEqual({ energy: 1200, minerals: 300 });
		expect(s.income).toEqual({ energy: 15, food: 2 });
		expect(s.expenses).toEqual({ energy: 4, alloys: 1 });
		expect(s.pops).toBe(5000);
	});

	it('reads the top-bar counters', () => {
		expect(s).toMatchObject({ empireSize: 50, starbases: { used: 1, capacity: 5 }, navalUsed: 15 });
	});

	it('lists controlled colonies, joined to their planet when there is one', () => {
		expect(s.colonies).toEqual([
			{
				planetId: 21,
				name: 'Dar-Hesh',
				designation: 'col_capital',
				pops: 4800,
				employablePops: 0,
				stability: 75.2,
				freeHousing: 0,
				freeAmenities: 0,
				districts: 3,
				buildQueueId: 2
			},
			expect.objectContaining({ planetId: -1, name: 'colony 9', districts: 1, buildQueueId: null })
		]);
	});
});

describe('helpers', () => {
	it('sumSources ignores non-numeric values', () => {
		expect(sumSources({ a: { energy: 1, x: 'no' }, b: { energy: 2 } })).toEqual({ energy: 3 });
		expect(sumSources(undefined)).toEqual({});
	});

	it('displayName resolves templates and strips key decoration', () => {
		expect(displayName({ key: 'NAME_Bunker' })).toBe('Bunker');
		expect(
			displayName({
				key: '%ADJECTIVE%',
				variables: [
					{ key: 'adjective', value: { key: 'SPEC_Yastun' } },
					{ key: '1', value: { key: 'Devourers' } }
				]
			})
		).toBe('Yastun Devourers');
	});
});

// Real save, opt-in: STELLARIS_TEST_SAVE=<path to a .sav>.
const real = process.env.STELLARIS_TEST_SAVE;
describe.skipIf(!real)('real save', () => {
	it('parses into a plausible snapshot', async () => {
		const s = toSnapshot(await readSave(readFileSync(real!)), 'real');
		expect(s.date).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
		expect(s.empireName).not.toBe('');
		expect(Object.keys(s.stockpile).length).toBeGreaterThan(3);
		expect(Object.keys(s.income ?? {}).length).toBeGreaterThan(3);
		expect(s.colonies.length).toBeGreaterThan(0);
		expect(s.endGameYear).toBeGreaterThan(2200);
		expect(s.empireSize).toBeGreaterThan(0);
		expect(s.starbases?.capacity).toBeGreaterThan(0);
		console.log(JSON.stringify({ ...s, colonies: s.colonies.slice(0, 3) }, null, 1));
	}, 30_000);
});
