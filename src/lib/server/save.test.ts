import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
	buildQueue,
	countryIds,
	colonyGrowth,
	colonyJobs,
	displayName,
	envoys,
	knownSystems,
	migration,
	megaShipyards,
	stations,
	expansion,
	hops,
	militaryFleets,
	sectorBySystem,
	sectors,
	speciesInfo,
	planetBudget,
	shipCounts,
	strata,
	countryModifiers,
	market,
	marketOrders,
	progress,
	readSave,
	sumSources,
	toSnapshot,
	tradeDeals,
	wars,
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
	leaders: {},
	monthlyTrades: undefined,
	market: undefined,
	popJobs: {},
	popGroups: {},
	fleets: {},
	ships: {},
	shipDesigns: {},
	automationResources: undefined,
	systems: {},
	sectors: {},
	speciesDb: {},
	wars: {},
	tradeDeals: {},
	starbases: {},
	megastructures: {},
	bypasses: {},
	naturalWormholes: {},
	globalFlags: {},
	countryNames: {},
	// as in the 2201.06.01 save: a city district with a filled Government Zone and an empty one
	districtsDb: {
		'1': { type: 'district_city', level: 3, zones: [0, 1] },
		'2': { type: 'district_generator', level: 2, zones: 4294967295 },
		'3': { type: 'district_mining', level: 0 },
		'4': { type: 'district_farming', level: 1 }
	},
	zones: {
		'0': { type: 'zone_default', buildings: [0, 2] },
		'1': { type: 'zone_research_unity' }
	},
	buildings: {
		'0': { type: 'building_capital', position: 0 },
		'2': { type: 'building_holo_theatres' }
	},
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
				balance: { planet_jobs: { energy: 6 } },
				// automatic market trades, as in the 2200.04.01 save (game top bar: energy +38 = 118 − 80)
				trade_income: { monthly_trades: { minerals: 42 } },
				trade_expenses: { monthly_trades: { energy: 80 } },
				trade_balance: { monthly_trades: { energy: -80, minerals: 42 } }
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
		expect(s.income).toEqual({ energy: 15, food: 2, minerals: 42 });
		expect(s.expenses).toEqual({ energy: 84, alloys: 1 });
		expect(s.balance).toEqual({ energy: -74, minerals: 42 });
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
				colonizing: false,
				growth: null,
				pops: 4800,
				employed: 3300,
				civilians: 1500,
				stability: 75.2,
				freeHousing: 0,
				freeAmenities: 0,
				planetClass: '',
				planetSize: 0,
				deposits: [],
				planet: { deposits: [], modifiers: [] },
				districts: 5,
				districtList: [
					{
						type: 'district_city',
						built: 3,
						zones: [
							{ type: 'zone_default', buildings: ['building_capital', 'building_holo_theatres'] },
							{ type: 'zone_research_unity', buildings: [] }
						]
					},
					{ type: 'district_generator', built: 2, zones: [] },
					{ type: 'district_mining', built: 0, zones: [] }
				],
				buildQueue: [
					{ kind: 'district', name: 'district_city', progress: 83, needed: 600 },
					{ kind: 'clear_deposit_blocker', name: 'd_decrepit_dwellings', progress: 90, needed: 120 }
				],
				buildSlots: 1,
				jobs: [],
				openJobs: 0,
				strata: [],
				happiness: null,
				habitability: null,
				sector: null,
				automation: { enabled: false, settings: [] },
				produces: {},
				upkeep: {}
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
			society_queue: [{ progress: 56.56, technology: 'tech_planetary_unification' }],
			technology: ['tech_corvettes', 'tech_starbase_1'],
			level: [1, 1]
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
			researched: ['tech_corvettes', 'tech_starbase_1'],
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

describe('marketOrders', () => {
	it("lists the country's standing orders", () => {
		const trades = [
			{ trade_data: { trade_type: 'market_sell', resource: 'energy', country: 0 }, amount: 80 },
			{ trade_data: { trade_type: 'market_buy', resource: 'minerals', country: 0 }, amount: 42 },
			{ trade_data: { trade_type: 'market_buy', resource: 'food', country: 5 }, amount: 10 }
		];
		expect(marketOrders(trades, 0)).toEqual([
			{ kind: 'sell', resource: 'energy', amount: 80 },
			{ kind: 'buy', resource: 'minerals', amount: 42 }
		]);
		expect(marketOrders(undefined, 0)).toEqual([]);
	});
});

describe('countryModifiers', () => {
	it('dates the timed ones, −1 is permanent (shape of the 4.0.1 save at 2312)', () => {
		const country = {
			timed_modifier: {
				items: [
					{ modifier: 'galactic_market_founder', days: -1 },
					{ modifier: 'celebrate_diversity', days: 3535 }
				]
			}
		};
		expect(countryModifiers({ country, date: '2312.01.01' })).toEqual([
			{ key: 'galactic_market_founder', until: null },
			{ key: 'celebrate_diversity', until: '2321.10.26' }
		]);
		expect(
			countryModifiers({
				country: { timed_modifier: { items: { modifier: 'x', days: -1 } } },
				date: '2200.01.01'
			})
		).toEqual([{ key: 'x', until: null }]);
	});
});

describe('market', () => {
	// internal_market_fluctuations as in the 2207.03.10 save, as jomini returns repeated keys
	const internal = {
		country: [0, 1, 2],
		resources: [{ energy: -15.92241, minerals: 0.67149 }, { alloys: 9.78464 }, []]
	};

	it("reads the country's internal market, the basic five at 0 unless moved", () => {
		expect(
			market({ countryId: 0, country: {}, market: { internal_market_fluctuations: internal } })
		).toEqual({
			galactic: false,
			fluctuations: { energy: -15.92241, minerals: 0.67149, food: 0, consumer_goods: 0, alloys: 0 }
		});
		// an empty block, and a country missing from the list
		expect(
			market({ countryId: 2, country: {}, market: { internal_market_fluctuations: internal } })
				.fluctuations.energy
		).toBe(0);
		expect(market({ countryId: 9, country: {}, market: {} }).fluctuations.alloys).toBe(0);
	});

	it('reads a single country, which jomini returns unlisted', () => {
		const one = { country: 0, resources: { food: 2 } };
		expect(
			market({ countryId: 0, country: {}, market: { internal_market_fluctuations: one } })
				.fluctuations.food
		).toBe(2);
	});

	it('reads the galactic market once the country has access, by resource index', () => {
		const galactic = market({
			countryId: 0,
			country: { flags: { has_market_access: 62900000 } },
			market: {
				fluctuations: [-10, 5, 0, 0, 0, 0, 0, 0, 0, 20, 0, 3],
				galactic_market_resources: [1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
				internal_market_fluctuations: internal
			}
		});
		expect(galactic).toEqual({
			galactic: true,
			fluctuations: { energy: -10, minerals: 5, food: 0, consumer_goods: 20, alloys: 0 }
		});
	});
});

describe('colonyJobs', () => {
	// Shapes as in the 2200.04.01 save (Earth's pop_jobs).
	const popJobs = {
		'299': {
			type: 'civilian',
			workforce: 1906,
			max_workforce: -1,
			pop_groups: [{ pop_group: 1, amount: 1907 }]
		},
		'300': { type: 'servant', workforce: -1, max_workforce: -1, pop_groups: [{}] },
		'326': {
			type: 'farmer',
			workforce: 800,
			max_workforce: 800,
			pop_groups: [{ pop_group: 1, amount: 800 }]
		},
		'327': {
			type: 'miner',
			workforce: 300,
			max_workforce: 400,
			pop_groups: { pop_group: 1, amount: 300 }
		}
	};

	it('lists worked jobs, skips placeholders and sums open positions', () => {
		expect(colonyJobs(popJobs, [299, 300, 326, 327, 999])).toEqual({
			jobs: [
				{ type: 'civilian', pops: 1907, filled: 1906, positions: null },
				{ type: 'farmer', pops: 800, filled: 800, positions: 800 },
				{ type: 'miner', pops: 300, filled: 300, positions: 400 }
			],
			openJobs: 100
		});
	});
});

describe('colonyGrowth', () => {
	it('reads last month by cause, emigration against the colony (Earth, 2204.07)', () => {
		expect(
			colonyGrowth({
				growth_and_size: { month_start_size: 5431, growth: -15 },
				species: {
					key: 2365587457,
					value: {
						categories: {
							key: ['civilian', 'ruler', 'specialist', 'worker'],
							value: [{ growth: -14 }, { growth: 0 }, { growth: -1 }, { growth: 0 }]
						}
					}
				},
				current_month_growth_details: {
					key: ['GROWTH_CAT_EMIGRATION', 'GROWTH_CAT_GROWTH', 'GROWTH_CAT_PROMOTION'],
					value: [18, 3, 0]
				}
			})
		).toEqual({
			net: -15,
			by: { emigration: -18, growth: 3, promotion: 0 },
			byStratum: { civilian: -14, ruler: 0, specialist: -1, worker: 0 }
		});
	});

	it('reads a single detail and a single stratum (the new colony)', () => {
		expect(
			colonyGrowth({
				growth_and_size: { growth: 18 },
				species: { value: { categories: { key: 'worker', value: { growth: 18 } } } },
				current_month_growth_details: { key: 'GROWTH_CAT_IMMIGRATION', value: 18 }
			})
		).toEqual({ net: 18, by: { immigration: 18 }, byStratum: { worker: 18 } });
		expect(colonyGrowth(undefined)).toBeNull();
	});
});

describe('knownSystems', () => {
	it('lists visited and own systems with the hyperlanes between them, each once', () => {
		const systems = {
			'380': {
				name: { key: 'NAME_Sol' },
				coordinate: { x: -6, y: 279 },
				hyperlane: [{ to: 52 }, { to: 135 }, { to: 9 }]
			},
			'52': {
				name: { key: 'NAME_Alpha_Centauri' },
				coordinate: { x: 11, y: 296 },
				hyperlane: [{ to: 380 }]
			},
			'135': {
				name: { key: 'NAME_Sirius' },
				coordinate: { x: -30, y: 269 },
				hyperlane: { to: 380 }
			},
			'9': { name: { key: 'NAME_Unknown' }, coordinate: { x: 0, y: 0 }, hyperlane: { to: 380 } }
		};
		const r = knownSystems(
			{
				country: { visited_objects: [380, 52], capital: 3 },
				systems,
				planets: { '3': { coordinate: { origin: 380 } } }
			},
			new Set([135])
		);
		expect(r.map((s) => [s.name, s.owned, s.capital, s.lanes])).toEqual([
			['Sol', false, true, []],
			['Alpha Centauri', false, false, [380]],
			['Sirius', true, false, [380]]
		]);
	});
});

describe('migration', () => {
	// Shapes as in the 2207.03.10 save, plus a foreign colony as a migration treaty would add one.
	const growth = (key: string | string[], value: number | number[], net: number) => ({
		growth_and_size: { growth: net },
		current_month_growth_details: { key, value }
	});
	const raw = {
		countryId: 0,
		// a treaty with 11 (shape assumed); 12 is a stranger whose colonies migrate among themselves
		country: {
			relations_manager: {
				relation: [
					{ owner: 0, country: 11, migration_pact: true },
					{ owner: 0, country: 12, contact: true }
				]
			}
		},
		empireName: 'United Nations of Earth 3',
		countryNames: { '11': 'Tiyanki Matriarchy' },
		systems: {
			'380': { name: { key: 'NAME_Sol' }, coordinate: { x: -89, y: 72 } },
			'52': { name: { key: 'NAME_Alpha_Centauri' }, coordinate: { x: -68, y: 72 } },
			'7': { name: { key: 'NAME_Far' }, coordinate: { x: 10, y: 5 } }
		},
		planets: {
			'3': { name: { key: 'NAME_Earth' }, colony: 0, owner: 0, coordinate: { origin: 380 } },
			'159': { name: { key: 'NAME_Prime' }, colony: 33, owner: 0, coordinate: { origin: 52 } },
			'900': { name: { key: 'NAME_Quiet' }, colony: 40, owner: 11, coordinate: { origin: 7 } },
			'901': { name: { key: 'NAME_Busy' }, colony: 41, owner: 11, coordinate: { origin: 7 } },
			'902': { name: { key: 'NAME_Elsewhere' }, colony: 42, owner: 12, coordinate: { origin: 7 } }
		},
		colonies: {
			'0': {
				last_month_growth_data: growth(['GROWTH_CAT_EMIGRATION', 'GROWTH_CAT_GROWTH'], [18, 3], -15)
			},
			'33': { last_month_growth_data: growth('GROWTH_CAT_IMMIGRATION', 18, 18) },
			'40': { last_month_growth_data: growth('GROWTH_CAT_GROWTH', 2, 2) },
			'41': { last_month_growth_data: growth('GROWTH_CAT_IMMIGRATION', 5, 5) },
			'42': { last_month_growth_data: growth('GROWTH_CAT_IMMIGRATION', 9, 9) }
		}
	};

	it('lists own colonies always and foreign ones with migration', () => {
		const rows = migration(raw);
		expect(rows.map((r) => [r.name, r.owner, r.immigration, r.emigration, r.system])).toEqual([
			['Earth', 'United Nations of Earth 3', 0, 18, 'Sol'],
			['Prime', 'United Nations of Earth 3', 18, 0, 'Alpha Centauri'],
			['Busy', 'Tiyanki Matriarchy', 5, 0, 'Far']
		]);
		expect(rows[0]).toMatchObject({ own: true, x: -89, y: 72 });
	});
});

describe('envoys', () => {
	it('counts envoys and those on an assignment', () => {
		const own = [
			{ class: 'envoy' },
			{ class: 'envoy', location: { type: 'first_contact_system', assignment: 'first_contact' } },
			{ class: 'scientist', location: { assignment: 'research' } }
		];
		expect(envoys(own)).toEqual({ used: 1, total: 2 });
	});
});

describe('strata', () => {
	it('sums pop groups per stratum, happiness weighted by size', () => {
		const groups = {
			'1': { key: { category: 'civilian' }, size: 1911, happiness: 0.95, habitability: 1 },
			'2': { key: { category: 'worker' }, size: 1800, happiness: 0.5, habitability: 0.5 },
			'3': { key: { category: 'worker' }, size: 200, happiness: 1 },
			'4': { key: { category: 'ruler' }, size: 0, happiness: 1 },
			'5': { key: { category: 'specialist' }, size: 1299 }
		};
		const r = strata(groups, [1, 2, 3, 4, 5, 99]);
		expect(r.strata).toEqual([
			{ category: 'civilian', size: 1911, happiness: 0.95 },
			{ category: 'worker', size: 2000, happiness: 0.55 },
			{ category: 'specialist', size: 1299, happiness: null }
		]);
		expect(r.happiness).toBeCloseTo((1911 * 0.95 + 2000 * 0.55) / 3911);
		expect(r.habitability).toBeCloseTo((1911 + 1800 * 0.5) / 3711);
		expect(strata({}, []).happiness).toBeNull();
		expect(strata({}, []).habitability).toBeNull();
	});
});

describe('shipCounts', () => {
	it('counts ships by design size, grouped by the fleet class', () => {
		const counts = shipCounts({
			country: { fleets_manager: { owned_fleets: [{ fleet: 0 }, { fleet: 1 }, { fleet: 3 }] } },
			fleets: {
				'0': { ship_class: 'shipclass_starbase', ships: 0 },
				'1': { ship_class: 'shipclass_science_ship', ships: [1] },
				'3': { ship_class: 'shipclass_military', ships: [3, 4, 5] }
			},
			ships: Object.fromEntries(
				[0, 1, 3, 4, 5].map((id) => [
					id,
					{ ship_design_implementation: { design: id === 0 ? 17 : id === 1 ? 20 : 30 } }
				])
			),
			shipDesigns: {
				'17': { growth_stages: [{ ship_size: 'starbase_starport' }] },
				'20': { growth_stages: [{ ship_size: 'science' }] },
				'30': { growth_stages: [{ ship_size: 'corvette' }] }
			}
		});
		expect(counts).toEqual([
			{ group: 'station', size: 'starbase_starport', count: 1 },
			{ group: 'civilian', size: 'science', count: 1 },
			{ group: 'military', size: 'corvette', count: 3 }
		]);
	});
});

describe('planetBudget', () => {
	it('keeps the planet and pop sources with their income and expenses', () => {
		expect(
			planetBudget({
				income: { planet_artisans: { consumer_goods: 47 }, country_base: { energy: 20 } },
				expenses: { planet_artisans: { minerals: 25 }, pop_category_workers: { consumer_goods: 5 } }
			})
		).toEqual([
			{ source: 'planet_artisans', income: { consumer_goods: 47 }, expenses: { minerals: 25 } },
			{ source: 'pop_category_workers', income: {}, expenses: { consumer_goods: 5 } }
		]);
	});
});

describe('empire overview', () => {
	// Shapes as in the 2200.05.01 save: Sol (380) with Earth (3, owned) and Mars (5).
	const systems = {
		'380': { name: { key: 'NAME_Sol' }, hyperlane: [{ to: 135 }, { to: 52 }], colonies: [3] },
		'135': { name: { key: 'NAME_Sirius' }, hyperlane: [{ to: 380 }, { to: 7 }] },
		'52': { hyperlane: { to: 380 } },
		'7': { name: { key: 'NAME_Far' }, hyperlane: [{ to: 135 }] }
	};
	const planets = {
		'0': {
			name: { key: 'NAME_Sol' },
			planet_class: 'pc_g_star',
			controller: 0,
			coordinate: { origin: 380 }
		},
		'3': { planet_class: 'pc_continental', owner: 0, controller: 0, coordinate: { origin: 380 } },
		'5': {
			name: { key: 'NAME_Mars' },
			planet_class: 'pc_barren',
			planet_size: 13,
			coordinate: { origin: 380 },
			planet_modifier: 'pm_mineral_poor',
			timed_modifier: { items: [{ modifier: 'terraforming_candidate', days: -1 }] },
			deposits: [7, 8]
		},
		'9': {
			name: { key: 'NAME_Faraway' },
			planet_class: 'pc_ocean',
			planet_size: 20,
			coordinate: { origin: 7 }
		},
		'10': { planet_class: 'pc_gas_giant', planet_size: 30, coordinate: { origin: 7 } }
	};

	it('counts hyperlane jumps breadth-first', () => {
		expect(Object.fromEntries(hops(systems, 380))).toEqual({ '380': 0, '135': 1, '52': 1, '7': 2 });
	});

	it('lists surveyed, unowned rocky planets nearest first', () => {
		const country = {
			capital: 3,
			surveyed_deposit_holders: [0, 3, 5, 9, 10].map((id) => ({ type: 0, id }))
		};
		// as on Earth at 2207.03.10: a blocker hiding a feature
		const deposits = {
			'7': { type: 'd_minerals_3', deposit_holder: { type: 0, id: 5 } },
			'8': { type: 'd_failing_infrastructure_earth', swap_type: 'd_delhi_sprawl' }
		};
		expect(
			expansion({ countryId: 0, country, planets, systems, deposits, date: '2200.05.01' })
		).toEqual([
			{
				planetId: 5,
				name: 'Mars',
				planetClass: 'pc_barren',
				size: 13,
				system: 'Sol',
				jumps: 0,
				beyond: 0,
				via: [],
				modifier: 'pm_mineral_poor',
				candidate: 'terraforming_candidate',
				planet: {
					deposits: [
						{ key: 'd_minerals_3', swap: null },
						{ key: 'd_failing_infrastructure_earth', swap: 'd_delhi_sprawl' }
					],
					modifiers: [{ key: 'terraforming_candidate', until: null }]
				}
			},
			{
				planetId: 9,
				name: 'Faraway',
				planetClass: 'pc_ocean',
				size: 20,
				system: 'Far',
				jumps: 2,
				beyond: 2,
				via: [],
				modifier: null,
				candidate: null,
				planet: { deposits: [], modifiers: [] }
			}
		]);
	});

	it('reads sectors with their systems and colonies', () => {
		const r = sectors({
			country: { sectors: { owned: 0 } },
			sectors: { '0': { name: { key: 'NAME_Earth' }, systems: [380], type: 'core_sector' } },
			systems
		});
		expect(r).toEqual([{ name: 'Earth', type: 'core', systems: 1, colonies: 1 }]);
	});

	it('maps systems to their sector', () => {
		const r = sectorBySystem({
			country: { sectors: { owned: [0, 1] } },
			sectors: {
				'0': { name: { key: 'NAME_Earth' }, systems: [380, 52] },
				'1': { name: { key: 'NAME_Cradle' }, systems: 60 }
			}
		});
		expect([...r]).toEqual([
			[380, 'Earth'],
			[52, 'Earth'],
			[60, 'Cradle']
		]);
	});

	it('names fleets from their %SEQ% template and keeps military ones', () => {
		const fleets = militaryFleets({
			planets: { '2669': { coordinate: { origin: 135 } } },
			systems,
			country: { fleets_manager: { owned_fleets: [{ fleet: 1 }, { fleet: 3 }] } },
			fleets: {
				'1': { ship_class: 'shipclass_science_ship', ships: 1 },
				'3': {
					ship_class: 'shipclass_military',
					ships: [3, 4, 5],
					military_power: 176.625,
					movement_manager: { coordinate: { origin: 380 }, state: 'move_system' },
					current_order: { orbit_planet_order: { orbitable: { planet: 2669 } } },
					name: {
						key: '%SEQ%',
						variables: [
							{ key: 'fmt', value: { key: 'HUMAN1_FLEET' } },
							{ key: 'num', value: { key: '1' } }
						]
					}
				}
			}
		});
		expect(fleets).toEqual([
			{
				name: '1st Fleet',
				ships: 3,
				power: 176.625,
				route: {
					at: 'Sol',
					moving: true,
					stops: [{ system: 'Sirius', jumps: 1, unexplored: true }]
				}
			}
		]);
	});

	it('sums pops per species over the colonies and names prescripted species', () => {
		const r = speciesInfo({
			country: { controlled_colonies: 0 },
			colonies: { '0': { pop_groups: [1, 2] } },
			popGroups: {
				'1': { key: { species: 77 }, size: 1911 },
				'2': { key: { species: 77 }, size: 1800 }
			},
			speciesDb: {
				'77': {
					name: { key: 'PRESCRIPTED_species_name_humans1' },
					class: 'HUM',
					traits: { trait: ['trait_organic', 'trait_adaptive'] }
				}
			}
		});
		expect(r).toEqual([
			{
				id: '77',
				name: 'Humans',
				cls: 'HUM',
				traits: ['trait_organic', 'trait_adaptive'],
				pops: 3711
			}
		]);
	});
});

describe('stations', () => {
	// Shapes as in the 2200.12.01 save: the Sol starport with a shipyard, two ships queued.
	const raw = {
		countryId: 0,
		deposits: {},
		systems: {
			'380': { name: { key: 'NAME_Sol' }, starbases: 0 },
			'52': { name: { key: 'NAME_Alpha_Centauri' }, starbases: 42 }
		},
		starbases: {
			'0': {
				level: 'starbase_level_starport',
				modules: { '0': 'shipyard', '1': 'solar_panel_network' },
				buildings: { '0': 'crew_quarters' },
				build_queue: 2,
				shipyard_build_queue: 3
			},
			'9': { level: 'starbase_level_outpost', build_queue: 50 }, // someone else's
			// an outpost of the country's: its queue sits at the station ship (16778307), not at 42
			'42': { level: 'starbase_level_outpost', build_queue: 4195, station: 16778307 }
		},
		shipDesigns: {
			'2009': {
				name: { key: 'HUMAN1_SHIP_Byzantium' },
				growth_stages: [{ ship_size: 'colonizer' }]
			},
			'2197': {
				name: { key: 'S Empty', literal: true },
				growth_stages: [{ ship_size: 'corvette' }]
			}
		},
		construction: {
			queue_mgr: {
				queues: {
					'2': { owner: 0, location: { type: 0, id: 0 }, simultaneous: 1, type: 'starbase' },
					'3': {
						owner: 0,
						location: { type: 0, id: 0 },
						simultaneous: 1,
						type: 'ships',
						items: [7, 8]
					},
					'50': { owner: 4, location: { type: 0, id: 9 }, type: 'starbase' },
					'4195': { owner: 0, location: { type: 0, id: 16778307 }, type: 'starbase' },
					'60': {
						owner: 0,
						location: { type: 5, id: 12 },
						simultaneous: 2,
						type: 'ships',
						items: []
					}
				}
			},
			item_mgr: {
				items: {
					'7': {
						progress: 77,
						progress_needed: 360,
						buildable_colony_ship: { ship_design_implementation: { design: 2009 } }
					},
					'8': {
						progress: 0,
						progress_needed: 60,
						buildable_ship: { ship_design_implementation: { design: 2197 } }
					}
				}
			}
		},
		megastructures: {
			'12': { type: 'mega_shipyard_3', owner: 0, coordinate: { origin: 380 } },
			'13': { type: 'mega_shipyard_1', owner: 4 }
		}
	};

	it('lists own starbases with their queues, the shipyard and its ships named by size and design', () => {
		expect(stations(raw)).toEqual([
			{
				id: 0,
				system: 'Sol',
				level: 'starport',
				modules: ['shipyard', 'solar_panel_network'],
				buildings: ['crew_quarters'],
				queue: [],
				slots: 1,
				shipyard: {
					slots: 1,
					queue: [
						{
							kind: 'colony_ship',
							name: 'colonizer',
							design: 'Byzantium',
							progress: 77,
							needed: 360
						},
						{ kind: 'ship', name: 'corvette', design: 'S Empty', progress: 0, needed: 60 }
					]
				},
				arkship: false
			},
			{
				id: 42,
				system: 'Alpha Centauri',
				level: 'outpost',
				modules: [],
				buildings: [],
				queue: [],
				slots: 1,
				shipyard: null,
				arkship: false
			}
		]);
	});

	it('lists own mega shipyards, with a ships queue located at them if there is one', () => {
		expect(megaShipyards(raw)).toEqual([
			{ id: 12, type: 'mega_shipyard_3', system: 'Sol', queue: [], slots: 2 }
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
		expect(
			displayName({
				key: 'PLANET_NAME_FORMAT',
				variables: [
					{ key: 'PARENT', value: { key: 'NAME_Barnards_Star' } },
					{ key: 'NUMERAL', value: { key: 'I', literal: true } }
				]
			})
		).toBe('Barnards Star I');
		// a ship: name and prefix; the prefix text ("UNS") lives in localisation only
		expect(
			displayName({
				key: 'PREFIX_NAME_FORMAT',
				variables: [
					{ key: 'NAME', value: { key: 'HUMAN1_SHIP_Armstrong' } },
					{ key: 'PREFIX', value: { key: 'PRESCRIPTED_ship_prefix_humans1' } }
				]
			})
		).toBe('Armstrong');
		expect(displayName({ key: 'HUMAN1_CHR_Gabriela' })).toBe('Gabriela');
		expect(
			displayName({
				key: 'NEW_COLONY_NAME_1',
				variables: [{ key: 'NAME', value: { key: 'NAME_Alpha_Centauri' } }]
			})
		).toBe('Alpha Centauri Prime');
	});
});

describe('milestone fields', () => {
	// shapes as in the 2207.03.10 save (agenda cooldowns from an AI empire's government)
	const country = {
		...raw.country,
		ruler: 318767105,
		owned_leaders: [318767105, 129],
		government: {
			type: 'gov_representative_democracy',
			authority: 'auth_democratic',
			civics: ['civic_beacon_of_liberty', 'civic_idealistic_foundation'],
			origin: 'origin_default',
			council_agenda_cooldowns: {
				council_agenda: 'agenda_arkship_engineering_military',
				start_date: '2211.08.01'
			}
		},
		ethos: { ethics: ['ethic_fanatic_egalitarian', 'ethic_xenophile'] },
		active_policies: [
			{ policy: 'diplomatic_stance', selected: 'diplo_stance_expansionist' },
			{ policy: 'war_philosophy', selected: 'unrestricted_wars' }
		],
		last_date_war_lost: '0.01.01'
	};
	const leaders = {
		'318767105': { class: 'official', name: { full_names: { key: 'Ada' } } },
		'129': { class: 'scientist', name: { full_names: { key: 'Bo' } } },
		'184549376': 'none' // a removed leader leaves this behind
	};
	const s = toSnapshot({ ...raw, country, leaders }, 'camp');

	it('lists all hired leaders and the ruler', () => {
		expect(s.leaderRoster).toEqual([
			{ id: 318767105, class: 'official', name: 'Ada' },
			{ id: 129, class: 'scientist', name: 'Bo' }
		]);
		expect(s.ruler).toEqual({ id: 318767105, name: 'Ada' });
	});

	it('reads agendas on cooldown, policies, government and the last lost war', () => {
		expect(s.agendasDone).toEqual(['agenda_arkship_engineering_military']);
		expect(s.policies).toEqual({
			diplomatic_stance: 'diplo_stance_expansionist',
			war_philosophy: 'unrestricted_wars'
		});
		expect(s.government).toEqual([
			'civic_beacon_of_liberty',
			'civic_idealistic_foundation',
			'ethic_fanatic_egalitarian',
			'ethic_xenophile',
			'auth_democratic'
		]);
		expect(s.governmentType).toBe('gov_representative_democracy');
		expect(s.origin).toBe('origin_default');
		expect(s.warLostDate).toBe('0.01.01');
	});

	// ASSUMED shapes: no war or trade deal seen in a save yet
	const names = { '0': 'UNE', '4': 'Tzynn', '7': 'Blorg' };
	it('finds wars the country is in, with the other side as enemies', () => {
		const w = {
			'1': {
				name: { key: 'War of Aggression' },
				start_date: '2210.01.01',
				attackers: [{ country: 4 }],
				defenders: [{ country: 0 }, { country: 7 }]
			},
			'2': { attackers: { country: 4 }, defenders: { country: 7 } },
			'3': 'none'
		};
		expect(wars({ wars: w, countryId: 0, countryNames: names })).toEqual([
			{ id: '1', name: 'War of Aggression', start: '2210.01.01', enemies: ['Tzynn'] }
		]);
		expect(countryIds(w).sort()).toEqual([0, 4, 4, 7, 7]);
	});

	it('finds trade deals naming the country and reads both sides (assumed shape)', () => {
		const d = {
			'5': {
				first: { country: 4, monthly_resources: { minerals: 20 }, sensor_link: 'yes' },
				second: {
					country: 0,
					resources: { energy: 100 },
					monthly: [{ resource: 'food', amount: 5 }]
				},
				date: '2230.05.01',
				length: 10
			},
			'6': { first: { country: 4 }, second: { country: 7 } }
		};
		const [deal, ...more] = tradeDeals({ tradeDeals: d, countryId: 0, countryNames: names });
		expect(more).toEqual([]);
		expect(deal).toMatchObject({
			id: '5',
			partner: 'Tzynn',
			start: '2230.05.01',
			years: 10,
			understood: true,
			gives: { monthly: { food: 5 }, once: { energy: 100 }, other: [] },
			gets: { monthly: { minerals: 20 }, once: {}, other: ['sensor_link'] }
		});
		expect(JSON.parse(deal.raw)).toEqual(d['5']);
	});

	it('keeps a deal it cannot read, everything under gives.other', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const [deal] = tradeDeals({
			tradeDeals: { '1': { parties: [{ country: 0 }, { country: 4 }], energy: 3 } },
			countryId: 0,
			countryNames: names
		});
		expect(deal).toMatchObject({ understood: false, partner: 'Tzynn', years: null });
		expect(deal.gives.once).toEqual({ energy: 3 });
		expect(warn).toHaveBeenCalledOnce();
		warn.mockRestore();
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
		expect(s.envoys?.total).toBeGreaterThan(0);
		expect(Object.values(s.leaders ?? {}).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
		expect(s.ships?.length).toBeGreaterThan(0);
		expect(s.colonies[0].happiness).toBeGreaterThan(0);
		expect(s.colonies[0].sector).not.toBeNull();
		expect(s.colonies[0].habitability).toBeGreaterThan(0);
		expect(s.colonies[0].habitability).toBeLessThanOrEqual(1);
		expect(s.governmentType).toMatch(/^gov_/);
		expect(s.origin).toMatch(/^origin_/);
		expect(s.governmentType).toMatch(/^gov_/);
		expect(s.origin).toMatch(/^origin_/);
		console.log(
			JSON.stringify({
				leaders: s.leaders,
				ships: s.ships,
				envoys: s.envoys,
				happiness: s.colonies[0].happiness,
				strata: s.colonies[0].strata,
				automation: s.colonies[0].automation,
				defaults: s.defaultAutomation,
				market: s.market
			})
		);
		console.log(JSON.stringify({ ...s, colonies: s.colonies.slice(0, 3) }, null, 1));
	}, 30_000);
});
