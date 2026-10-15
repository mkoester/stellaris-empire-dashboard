import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	buildQueue,
	displayName,
	progress,
	readSave,
	sumSources,
	toSnapshot,
	type RawSave
} from './save.ts';

const raw: RawSave = {
	date: '2210.03.01',
	tick: 3700,
	randomCount: 123,
	countryId: 0,
	empireName: 'Yastun Devourers',
	endGameStart: 150,
	galaxy: { technology: 1.25, traditions: 1 },
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
			employable_pops: 4800,
			civilian: 1500,
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
	},
	// Shapes as in a 4.5.2 save (2200.04.01, AI empires' queues).
	construction: {
		queue_mgr: { queues: { '2': { owner: 0, type: 'planet', items: [5, 4] }, '3': { owner: 0 } } },
		item_mgr: {
			items: {
				'4': {
					queue: 2,
					progress: 90,
					progress_needed: 120,
					buildable_clear_deposit_blocker: { deposit: 443, planet: 21 }
				},
				'5': {
					queue: 2,
					progress: 83,
					progress_needed: 600,
					buildable_district: { district: 'district_city', planet: 21 }
				}
			}
		}
	},
	deposits: { '443': { type: 'd_decrepit_dwellings' } }
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
				employed: 3300,
				civilians: 1500,
				stability: 75.2,
				freeHousing: 0,
				freeAmenities: 0,
				districts: 3,
				buildQueue: [
					{ kind: 'district', name: 'district_city', progress: 83, needed: 600 },
					{ kind: 'clear_deposit_blocker', name: 'd_decrepit_dwellings', progress: 90, needed: 120 }
				]
			},
			expect.objectContaining({ planetId: -1, name: 'colony 9', districts: 1, buildQueue: [] })
		]);
	});
});

describe('buildQueue', () => {
	it('is empty for a queue without items or an unknown queue', () => {
		expect(buildQueue(raw, 3)).toEqual([]);
		expect(buildQueue(raw, 99)).toEqual([]);
	});
});

describe('progress', () => {
	// Shapes as in the 2200.04.01 save of the UNE 3 campaign.
	const country = {
		tech_status: {
			physics_queue: [{ progress: 42.79314, technology: 'tech_physics_1', date: '2200.01.01' }],
			society_queue: [{ progress: 56.56, technology: 'tech_planetary_unification' }]
		},
		government: { council_agenda: 'agenda_unlock_slot', council_agenda_progress: 126 },
		next_election: '2210.01.01'
	};

	it('reads current research, agenda, election and the galaxy cost sliders', () => {
		expect(progress({ country, galaxy: raw.galaxy })).toEqual({
			research: [
				{ area: 'physics', tech: 'tech_physics_1', progress: 42.79314 },
				{ area: 'society', tech: 'tech_planetary_unification', progress: 56.56 }
			],
			agenda: { key: 'agenda_unlock_slot', progress: 126 },
			traditionsTaken: 0,
			nextElection: '2210.01.01',
			costSettings: { technology: 1.25, traditions: 1 }
		});
	});

	it('has no agenda and default sliders when the save has none', () => {
		expect(progress({ country: {}, galaxy: undefined })).toMatchObject({
			research: [],
			agenda: null,
			nextElection: null,
			costSettings: { technology: 1, traditions: 1 }
		});
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
		expect(s.progress?.research.length).toBe(3);
		console.log(JSON.stringify({ ...s, colonies: s.colonies.slice(0, 3) }, null, 1));
	}, 30_000);
});
