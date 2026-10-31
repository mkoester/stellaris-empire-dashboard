import { describe, expect, it } from 'vitest';
import {
	researchRate,
	researchTicks,
	techCostFactor,
	deficits,
	expiries,
	leaderPoolRefresh,
	fromDays,
	rolls,
	timedOut,
	monthTicks,
	scheduleQueue,
	toDays,
	traditionCost,
	upcoming,
	type GameData
} from './events.ts';
import type { Progress, Snapshot } from './types.ts';

// The UNE 3 campaign at 2200.03.01 and 2200.04.01, checked against the in-game screens.
const data: GameData = {
	techs: {
		tech_physics_1: { name: 'Quantum Computing', cost: 1500, area: 'physics', tier: 1 },
		tech_planetary_unification: {
			name: 'Societal Unification',
			cost: 1000,
			area: 'society',
			tier: 1
		}
	},
	agendas: { agenda_unlock_slot: { name: 'Expand The Council', cost: 7000, unlockedBy: [] } },
	policies: [],
	factionTypes: [],
	situationTypes: {},
	projects: {},
	anomalyCategories: {},
	actionTimers: {},
	councilPositions: {},
	depositCategories: {},
	prescriptedNames: {},
	scriptedTriggers: {},
	speciesRights: [],
	councilorSkill: {},
	focus: { categories: {}, cards: {}, rewards: {} },
	jobs: {},
	edicts: {},
	traits: {},
	speciesClasses: {},
	archetypes: {},
	planetClasses: {},
	names: {},
	districtColors: {},
	identityNames: {},
	diploNames: {},
	resolutionCategories: {},
	resolutionGroups: {},
	resolutions: {},
	resolutionCostMult: {},
	shroud: { patrons: {}, callings: {}, deeds: {} },
	habitatEffects: {},
	habitability: { traits: {}, planet: {} },
	blockers: [],
	capEffects: {},
	dlcs: [],
	blockerInfo: {},
	traditionTrees: {},
	perks: {},
	flagColors: {},
	ethicAxes: {},
	ethicOrder: [],
	ethicRules: {},
	electionTypes: {},
	buildingUnlocks: {},
	civicAuthority: {},
	attractionSources: [],
	authorities: [],
	anomalyLevels: { GEN_PLAYGROUND_CAT: 3 },
	costs: { district: {}, ship: {}, building: {}, deposit: {}, module: {}, starbaseBuilding: {} },
	districtJobs: {},
	buildingJobs: {},
	buildDays: {},
	depositCategory: {},
	buildingCategory: {},
	growthModifiers: {},
	starbaseSlots: {},
	resourceInfo: {},
	personalities: {},
	attitudes: {},
	opinionModifiers: {},
	edictModifiers: {},
	techRequirements: {},
	defines: {
		EMPIRE_SIZE_BASE: 100,
		EMPIRE_SIZE_TECH_COST_PENALTY: 0.002,
		EMPIRE_SIZE_COUNCIL_AGENDA_COST_PENALTY: 0.001,
		EMPIRE_SIZE_TRADITION_COST_PENALTY: 0.002,
		TRADITION_COST_AMOUNTS: 300,
		TRADITION_COST_TRADITION: 8,
		TRADITION_COST_TRADITION_EXP: 1.8
	}
};

const progress = (physics: number, agenda: number): Progress => ({
	research: [{ area: 'physics', tech: 'tech_physics_1', progress: physics }],
	researched: [],
	agenda: { key: 'agenda_unlock_slot', progress: agenda },
	traditionsTaken: 0,
	nextElection: '2210.01.01',
	costSettings: { technology: 1, traditions: 1 }
});

const snap = (date: string, p: Progress, extra: Partial<Snapshot> = {}) =>
	({
		date,
		progress: p,
		empireSize: 50,
		stockpile: { unity: 146.21 },
		balance: { unity: 35.403 },
		income: { physics_research: 14.02 },
		colonies: [],
		...extra
	}) as unknown as Snapshot;

const prev = snap('2200.03.01', progress(28.49205, 84));
const latest = snap('2200.04.01', progress(42.79314, 126));

describe('game calendar', () => {
	it('counts the month starts between two dates', () => {
		expect(monthTicks('2207.03.01', '2207.03.10')).toBe(0);
		expect(monthTicks('2207.02.01', '2207.03.10')).toBe(1);
		expect(monthTicks('2206.12.15', '2207.02.01')).toBe(2);
	});

	it('round-trips dates through 30-day months', () => {
		expect(fromDays(toDays('2200.04.01'))).toBe('2200.04.01');
		expect(fromDays(toDays('2200.12.30') + 1)).toBe('2201.01.01');
		// fractional progress (Alpha Centauri Prime, 2207.03.10): no '2207.03.12.880000000004657'
		expect(fromDays(toDays('2207.03.10') + 2.88)).toBe('2207.03.13');
	});
});

describe('upcoming', () => {
	const events = upcoming(latest, prev, data);
	const of = (kind: string) => events.find((e) => e.kind === kind)!;

	it('dates research from the measured rate and the scaled cost (game: 108 months)', () => {
		expect(of('research')).toMatchObject({
			what: 'Quantum Computing',
			months: 108,
			date: '2209.04.01'
		});
	});

	it('dates the next tradition (game: 153.79 missing, by 2200.09.01)', () => {
		expect(of('tradition')).toMatchObject({ date: '2200.09.01', months: 5 });
	});

	it('dates the agenda from its measured progress (game says 163 months; we round up)', () => {
		expect(of('agenda')).toMatchObject({ what: 'Expand The Council', months: 164 });
	});

	it('measures the agenda across month starts: a mid-month save adds no progress', () => {
		// 2207.03.10 (manual) holds the same progress as the 03.01 autosave
		const before = snap('2200.03.01', progress(28.49205, 84));
		const tick = snap('2200.04.01', progress(42.79314, 126));
		const mid = snap('2200.04.10', progress(47, 126));
		const agenda = upcoming(mid, tick, data, [before, tick]).find((e) => e.kind === 'agenda');
		expect(agenda).toMatchObject({ months: 164 });
	});

	it('includes the election and sorts by date', () => {
		expect(events.map((e) => e.kind)).toEqual(['tradition', 'research', 'election', 'agenda']);
	});

	it('measures research per month start, not over a short window holding one', () => {
		// Planetforgers, society (Volcanic Forge): the 03.01 autosave precedes March's chunk, so
		// 03.01 → 03.05 holds a whole month (+34.8); 4 days scaled to a month made it +260.8.
		// The game: 42 months for 2750 − 1315.66 at ~34/month.
		const soc = (date: string, p: number) =>
			snap(date, {
				...progress(0, 0),
				research: [{ area: 'society', tech: 'tech_volcanic_forge', progress: p }]
			});
		const saves = [soc('2212.01.01', 1151.36336), soc('2212.02.01', 1226.94667)];
		const tick = soc('2212.03.01', 1280.88469);
		const now = soc('2212.03.05', 1315.66288);
		expect(researchRate('tech_volcanic_forge', now, [...saves, tick])).toBeCloseTo(34.78, 2);
		expect(researchRate('tech_volcanic_forge', tick, saves)).toBeCloseTo(53.94, 2);
		expect(researchRate('tech_volcanic_forge', now, [])).toBeNull();
		expect(researchRate('tech_volcanic_forge', soc('2212.03.20', 1315.66288), [now])).toBeNull();
		expect(researchTicks('2212.03.01', '2212.03.05')).toBe(1);
		expect(researchTicks('2212.02.01', '2212.03.01')).toBe(1);
		expect(researchTicks('2212.02.15', '2212.03.05')).toBe(1);
		expect(researchTicks('2212.03.05', '2212.03.30')).toBe(0);
	});

	it('scales tech costs by tier (game, 2212.03.05: 1575, 1312, 2200, 2750)', () => {
		const at = (base: number, tier: number) => Math.floor(base * techCostFactor(tier) + 1e-9);
		expect([at(1500, 1), at(1250, 1), at(2000, 2), at(2500, 2)]).toEqual([1575, 1312, 2200, 2750]);
	});

	it('falls back to income when there is no earlier save', () => {
		expect(upcoming(latest, null, data).find((e) => e.kind === 'research')!.detail).toContain(
			'+14.0'
		);
	});

	it('queues construction one item after the other, only the first exact', () => {
		const withQueue = snap('2200.04.01', progress(0, 0), {
			colonies: [
				{
					planetId: 3,
					name: 'Earth',
					buildSlots: 1,
					buildQueue: [
						{ kind: 'district', name: 'district_city', progress: 90, needed: 120 },
						{ kind: 'building', name: 'building_x', progress: 0, needed: 60 }
					]
				}
			]
		} as Partial<Snapshot>);
		const built = upcoming(withQueue, null, data).filter((e) => e.kind === 'construction');
		expect(built.map((e) => [e.date, e.exact, e.queuedAfter, e.act])).toEqual([
			['2200.05.01', true, 1, false], // the next item takes over: information
			['2200.07.01', false, 0, true] // the queue runs empty: act
		]);
	});
});

describe('traditionCost', () => {
	it('is 300 for the first and grows with traditions taken and empire size', () => {
		expect(traditionCost(0, 50, 1, data.defines)).toBe(300);
		expect(traditionCost(1, 50, 1, data.defines)).toBe(343); // 342.2, rounded up
		expect(traditionCost(3, 50, 1, data.defines)).toBe(606); // the game's tooltip, 2026-10-19
		expect(traditionCost(0, 150, 1, data.defines)).toBe(330);
	});
});

describe('scheduleQueue', () => {
	const item = (left: number) => ({ progress: 0, needed: left });

	it('builds one at a time with one slot', () => {
		expect(
			scheduleQueue([item(30), item(60), item(10)], 1).map((p) => [p.doneIn, p.waitingAfter])
		).toEqual([
			[30, 2],
			[90, 1],
			[100, 0]
		]);
	});

	it('fills free slots in queue order with several (wilderness, arkships, mods)', () => {
		const plan = scheduleQueue([item(30), item(60), item(10)], 2);
		expect(plan.map((p) => [p.doneIn, p.startsNow, p.waitingAfter])).toEqual([
			[30, true, 1], // the third item takes its slot
			[60, true, 0], // nothing left to take this slot
			[40, false, 0]
		]);
	});
});

describe('upcoming shipyards', () => {
	it('lists ship queue items by the construction rules', () => {
		const s = snap('2200.12.01', progress(0, 0), {
			stations: [
				{
					id: 0,
					system: 'Sol',
					level: 'starport',
					modules: ['shipyard'],
					buildings: [],
					queue: [],
					slots: 1,
					arkship: false,
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
							{ kind: 'ship', name: 'corvette', progress: 0, needed: 60 }
						]
					}
				}
			]
		} as Partial<Snapshot>);
		const yard = upcoming(s, null, data).filter((e) => e.kind === 'shipyard');
		expect(yard.map((e) => [e.what, e.date, e.queuedAfter, e.act, e.detail])).toEqual([
			['colonizer "Byzantium"', '2201.09.14', 1, false, 'Sol starport'],
			['corvette', '2201.11.14', 0, true, 'Sol starport']
		]);
	});
});

describe('upcoming civilian ships', () => {
	const order = (progress: number) => ({
		kind: 'research_anomaly',
		target: 'Proxima Centauri b',
		progress,
		orderId: 41,
		anomaly: 'GEN_PLAYGROUND_CAT' // level 3, scientist level 2: 180 days
	});
	const ship = (progress: number, queue = 1) => ({
		fleetId: 1,
		name: 'Armstrong',
		kind: 'science_ship',
		stance: 'evasive',
		automation: null,
		leader: null,
		leaderLevel: 2,
		order: order(progress),
		queue: Array(queue).fill({
			kind: 'survey_planet',
			target: 'Barnards Star IV',
			progress: 0,
			orderId: 42
		}),
		route: { at: 'Sol', moving: false, stops: [] },
		parked: null
	});
	const idle = {
		fleetId: 9,
		name: 'Taiwan',
		kind: 'colonizer',
		stance: 'evasive',
		automation: null,
		leader: null,
		order: null,
		queue: [],
		route: { at: 'Sol', moving: false, stops: [] },
		parked: null
	};

	it('dates the current order from the measured rate and flags idle ships', () => {
		const prev = snap('2202.04.01', progress(0, 0), {
			civilianShips: [ship(37.2)]
		} as Partial<Snapshot>);
		const now = snap('2202.05.01', progress(0, 0), {
			civilianShips: [ship(73.2, 6), idle]
		} as Partial<Snapshot>);
		const rows = upcoming(now, prev, data).filter((e) => e.kind === 'ship');
		expect(rows.map((e) => [e.what, e.date, e.queuedAfter, e.act])).toEqual([
			['colonizer idle', '2202.05.01', undefined, true],
			['anomaly Proxima Centauri b', '2202.07.30', 6, false] // (180 − 73.2) / 36 a month
		]);
	});
});

describe('upcoming colonization', () => {
	it('dates a colony being settled from its colonists (Alpha Centauri Prime, 2202.07)', () => {
		const colony = (pops: number) => ({
			planetId: 159,
			name: 'Alpha Centauri Prime',
			colonizing: true,
			pops,
			buildQueue: [],
			buildSlots: 1
		});
		const prev = snap('2202.06.01', progress(0, 0), {
			colonies: [colony(1)]
		} as unknown as Partial<Snapshot>);
		const now = snap('2202.07.01', progress(0, 0), {
			colonies: [colony(4)]
		} as unknown as Partial<Snapshot>);
		const [e] = upcoming(now, prev, data).filter((e) => e.kind === 'colonization');
		expect(e).toMatchObject({ what: 'Alpha Centauri Prime', months: 32, act: false });
		expect(upcoming(now, null, data).find((e) => e.kind === 'colonization')!.detail).toContain(
			'base rate'
		);
	});
});

describe('leaderPoolRefresh', () => {
	// Roaming Korinth 2204.10.01 (4.5.3): a pool filled 2200.01.01, the game showing "Refreshes
	// 2205.01.01"
	const pool = [
		{ id: 272, class: 'official', added: '2200.01.01' },
		{ id: 273, class: 'official', added: '2200.01.01' },
		{ id: 277, class: 'commander', added: '2200.01.01' },
		{ id: 290, class: 'scientist', added: '2203.06.15' } // joined later: not when it refreshes
	];

	it('is due the define after the earliest leader joined the pool', () => {
		const [r] = leaderPoolRefresh({ date: '2204.10.01', leaderPool: pool }, 1800);
		expect(r).toMatchObject({ date: '2205.01.01', months: 3, kind: 'leaders', exact: false });
		expect(r.detail).toBe('2 officials, 1 commander, 1 scientist to pick from until then');
	});

	it('says nothing without a pool, or one the save does not hold', () => {
		expect(leaderPoolRefresh({ date: '2204.10.01', leaderPool: [] }, 1800)).toEqual([]);
		expect(leaderPoolRefresh({ date: '2204.10.01', leaderPool: null }, 1800)).toEqual([]);
	});
});

describe('deficits', () => {
	it('dates when a stockpile runs out at its balance, and flags one already empty', () => {
		const events = deficits({
			date: '2208.04.01',
			stockpile: { energy: 100, minerals: 0, alloys: 500, physics_research: 0 },
			balance: { energy: -30, minerals: -5, alloys: 12, physics_research: -1, food: -0.001 }
		});
		expect(events[0].ref).toBe('modifier:energy_deficit');
		expect(events.map((e) => [e.what, e.date, e.months, e.act])).toEqual([
			['energy runs out', '2208.08.01', 4, true],
			['minerals in deficit', '2208.04.01', 0, true]
		]);
	});
});

describe('expiries', () => {
	// timers as the 4.5.2 game files set them: Arcane Deciphering waits on its cooldown modifier,
	// the curator's guidance on a timed flag, a Xuran deal blocks the other Xuran deals
	const timers: Pick<GameData, 'actionTimers'> = {
		actionTimers: {
			'modifier:arcane_deciphering_cooldown': [
				{
					kind: 'artifact_action',
					key: 'artifact_arcane_deciphering',
					name: 'Reverse-Engineer Arcane Technology',
					cooldown: true
				}
			],
			'flag:curator_guidance_cooldown': [
				{
					kind: 'enclave',
					key: 'leviathans.500.l',
					name: 'Point us towards interesting systems',
					cooldown: true
				}
			],
			'modifier:enclave_trade_1_xur': [
				{ kind: 'enclave', key: 'leviathans.130.a', name: '1 Exotic Gases', cooldown: false },
				{ kind: 'enclave', key: 'leviathans.130.d', name: '4 Exotic Gases', cooldown: true }
			]
		}
	};
	const base = {
		date: '2210.01.01',
		colonies: [],
		countryModifiers: null,
		countryTimedFlags: null,
		cooldowns: null,
		edictTimes: null,
		tradeDeals: null,
		galcom: null
	};
	const titles: Record<string, string> = { 'modifier:enclave_trade_1_xur': 'Xuran Deal' };
	const title = (ref: string) => titles[ref];

	it('names what becomes available again, and what an effect came from', () => {
		const rows = expiries(
			{
				...base,
				countryModifiers: [
					{ key: 'arcane_deciphering_cooldown', until: '2211.01.01' },
					{ key: 'enclave_trade_1_xur', until: '2220.01.01' },
					{ key: 'celebrate_diversity', until: '2215.06.01' },
					{ key: 'galactic_market_founder', until: null },
					{ key: 'gone', until: '2209.01.01' }
				],
				countryTimedFlags: [{ key: 'curator_guidance_cooldown', until: '2210.07.01' }]
			},
			timers,
			title
		);
		expect(rows.map((r) => [r.kind, r.sub, r.what, r.detail, r.act])).toEqual([
			[
				'cooldown',
				'artifact action',
				'Reverse-Engineer Arcane Technology available again',
				'arcane deciphering cooldown',
				true
			],
			['cooldown', 'enclave', '4 Exotic Gases available again', 'Xuran Deal', true],
			['expires', undefined, 'celebrate diversity ends', '', false],
			[
				'cooldown',
				'enclave',
				'Point us towards interesting systems available again',
				'cooldown',
				true
			]
		]);
		expect(rows[1].ref).toBe('modifier:enclave_trade_1_xur');
		expect(rows[3]).toMatchObject({ date: '2210.07.01', months: 6, exact: true });
	});

	it('shows an unnamed timed flag only with the spoiler switch', () => {
		const s = {
			...base,
			countryTimedFlags: [{ key: 'curator_clue_purchased', until: '2220.01.01' }]
		};
		expect(expiries(s, timers, title)).toEqual([]);
		// the companion mod's own tick flag never shows
		const tick = { ...base, countryTimedFlags: [{ key: 'sdash_tick_alive', until: '2210.01.04' }] };
		expect(expiries(tick, timers, title, true)).toEqual([]);
		expect(expiries(s, timers, title, true)).toMatchObject([
			{
				kind: 'expires',
				sub: 'timer',
				what: 'curator clue purchased ends',
				detail: 'event timer (spoiler)'
			}
		]);
	});

	it('links a colony’s timer to it', () => {
		const colony = {
			planetId: 7,
			name: 'Earth',
			planet: {
				deposits: [],
				modifiers: [{ key: 'arcane_deciphering_cooldown', until: '2211.01.01' }]
			},
			timedFlags: []
		};
		const [r] = expiries({ ...base, colonies: [colony] } as unknown as typeof base, timers, title);
		expect(r).toMatchObject({ planetId: 7, kind: 'cooldown' });
		expect(r.detail.startsWith('Earth · ')).toBe(true);
		// an effect from nothing named: the colony alone, no trailing separator
		const [e] = expiries(
			{
				...base,
				colonies: [
					{
						...colony,
						planet: { ...colony.planet, modifiers: [{ key: 'prosp_uni_mod', until: '2220.01.01' }] }
					}
				]
			} as unknown as typeof base,
			timers,
			title
		);
		expect(e.detail).toBe('Earth');
	});

	it('a bonus timer: the action stays possible, the timer’s effect comes back', () => {
		// Insult with Satisfying Insults: only an `if` in its effect waits on the modifier (the
		// game's tooltip: "We can not gain the benefit of Satisfying Insults until the current
		// modifier expires", while Insult itself is possible)
		const bonus: Pick<GameData, 'actionTimers'> = {
			actionTimers: {
				'modifier:satisfying_insult_recently': [
					{
						kind: 'diplomatic_action',
						key: 'action_insult',
						name: 'Insult',
						cooldown: false,
						bonus: true
					}
				]
			}
		};
		const rows = expiries(
			{ ...base, countryModifiers: [{ key: 'satisfying_insult_recently', until: '2215.01.01' }] },
			bonus,
			(ref) => (ref === 'modifier:satisfying_insult_recently' ? 'Satisfying Insult' : undefined)
		);
		expect(rows.map((r) => [r.kind, r.what, r.detail, r.act])).toEqual([
			['cooldown', 'Satisfying Insult available again', 'with the next Insult', true]
		]);
	});

	it('reform, focus, capital, rights, insults, edicts, trade deals and the GalCom recess', () => {
		const rows = expiries(
			{
				...base,
				// as the throwaway game's 2202.08.01 save read them (2026-10-25)
				cooldowns: {
					reform: '2220.01.01',
					focusDismiss: null,
					focusChange: '2210.06.01',
					capital: '2212.07.01',
					rights: [{ species: 'Humans', right: 'living standard', until: '2212.05.01' }],
					insults: [{ country: 'Cevellian Punishers', until: '2210.02.01' }]
				},
				edictTimes: [
					{ key: 'map_the_stars', start: '2209.01.01', end: '2211.01.01' },
					{ key: 'perpetual', start: null, end: null }
				],
				tradeDeals: [
					{ id: '1', partner: 'Lahtrepian', start: '2205.03.08', years: 10 } as never,
					{ id: '2', partner: 'Old', start: '2195.01.01', years: 10 } as never
				],
				galcom: { nextVote: '2210.03.01' } as never
			},
			timers,
			title
		);
		expect(rows.map((r) => [r.what, r.date])).toEqual([
			['Government reform possible', '2220.01.01'],
			['Change the focus priority possible', '2210.06.01'],
			['Moving the capital possible', '2212.07.01'],
			['Changing Humans living standard possible', '2212.05.01'],
			['Insulting Cevellian Punishers possible', '2210.02.01'],
			['map the stars ends', '2211.01.01'],
			['Trade deal with Lahtrepian ends', '2215.03.08'],
			['Galactic Community recess ends', '2210.03.01']
		]);
		expect(rows.every((r) => r.exact)).toBe(true); // the reform date too, checked in game
	});
});

describe('timedOut', () => {
	const data = {
		agendas: { agenda_x: { name: 'Expand the Council', cost: null, unlockedBy: [] } },
		actionTimers: {
			'modifier:decision_cooldown': [
				{ kind: 'decision' as const, key: 'decision_x', name: 'Distribute Goods', cooldown: true }
			],
			'modifier:some_buff': [
				{ kind: 'decision' as const, key: 'decision_y', name: 'Buff', cooldown: false }
			]
		}
	};
	const colony = (planetId: number, name: string, until: string) => ({
		planetId,
		name,
		planet: { deposits: [], modifiers: [{ key: 'decision_cooldown', until }] },
		timedFlags: []
	});
	const save = (date: string, colonies: unknown[], extra = {}) =>
		({
			date,
			colonies,
			countryModifiers: [{ key: 'some_buff', until: '2210.06.01' }],
			countryTimedFlags: null,
			agendaCooldowns: null,
			cooldowns: null,
			...extra
		}) as unknown as Snapshot;

	it('keeps a run-out cooldown per colony until renewed, and an effect not at all', () => {
		const saves = [
			save('2210.01.01', [colony(1, 'Earth', '2210.03.01'), colony(2, 'Mars', '2210.04.01')]),
			save('2210.05.01', [
				{ ...colony(1, 'Earth', '2210.03.01'), planet: { deposits: [], modifiers: [] } },
				colony(2, 'Mars', '2211.01.01') // used again on Mars: renewed
			]),
			save('2210.07.01', [
				{ ...colony(1, 'Earth', '2210.03.01'), planet: { deposits: [], modifiers: [] } },
				colony(2, 'Mars', '2211.01.01')
			])
		];
		const rows = timedOut(saves, data);
		expect(rows.map((r) => [r.what, r.planetId, r.dismiss, r.months])).toEqual([
			['Distribute Goods available', 1, 'planet:1:modifier:decision_cooldown:2210.03.01', 0]
		]);
		expect(rows[0].detail).toBe('Earth · decision cooldown · since 2210.03.01');
		// dismissed: gone, until a later round runs out
		expect(timedOut(saves, data, undefined, new Set([rows[0].dismiss!]))).toEqual([]);
	});

	it('leaves out colonies no longer ours, and keeps agendas and the focus', () => {
		const saves = [
			save('2210.01.01', [colony(3, 'Lost', '2210.02.01')], {
				agendaCooldowns: [{ key: 'agenda_x', until: '2210.03.01' }],
				cooldowns: {
					reform: null,
					focusDismiss: '2210.04.01',
					focusChange: null,
					insults: [{ country: 'Cindarian Unity', until: '2210.02.01' }]
				}
			}),
			save('2210.06.01', [], { agendaCooldowns: [{ key: 'agenda_x', until: '2210.03.01' }] })
		];
		const rows = timedOut(saves, data);
		expect(rows.map((r) => r.what)).toEqual([
			'Expand the Council can be picked again',
			'Dismiss a focus card possible',
			'Insulting Cindarian Unity possible'
		]);
		expect(rows[2].dismiss).toBe('country:insult:Cindarian Unity:2210.02.01');
	});
});

describe('rolls', () => {
	it('dates the next roll of envoys and excavations', () => {
		const rows = rolls({
			date: '2214.02.01',
			firstContacts: [
				{
					name: 'Omega Menace',
					leaderId: 61,
					leaderName: 'Vel',
					daysLeft: 92.66,
					clues: 2,
					difficulty: 3,
					status: 'in_progress'
				},
				{
					name: 'No envoy',
					leaderId: null,
					leaderName: null,
					daysLeft: 30,
					clues: 0,
					difficulty: 1,
					status: 'in_progress'
				}
			],
			digSites: [
				{ type: 'site_lost_moments', excavating: true, daysLeft: 20, clues: 1, difficulty: 2 },
				{ type: 'site_tiyanki_graveyard', excavating: false, daysLeft: 90, clues: 0, difficulty: 3 }
			]
		} as never);
		expect(rows.map((r) => [r.what, r.date])).toEqual([
			['Next roll: Omega Menace', '2214.05.04'],
			['Next excavation roll: lost moments', '2214.02.21']
		]);
	});
});

describe('upcoming military fleets', () => {
	const fleet = (jumps: number) => ({
		fleetId: 5,
		name: '1st Fleet',
		ships: 3,
		power: 100,
		route: { at: 'Sol', moving: true, stops: [{ system: 'Sirius', jumps, unexplored: false }] }
	});
	it('dates the arrival from the measured days per jump, else assumed', () => {
		const before = snap('2210.01.01', progress(0, 0), { fleets: [fleet(6)] } as Partial<Snapshot>);
		const now = snap('2210.02.01', progress(0, 0), { fleets: [fleet(3)] } as Partial<Snapshot>);
		const [r] = upcoming(now, before, data).filter((e) => e.kind === 'fleet');
		expect(r).toMatchObject({
			what: '1st Fleet arrives at Sirius',
			date: '2210.03.01',
			exact: false,
			act: true
		});
		expect(r.detail).toContain('(measured)');
		const [alone] = upcoming(now, null, data).filter((e) => e.kind === 'fleet');
		expect(alone.detail).toContain('(assumed)');
	});
});
