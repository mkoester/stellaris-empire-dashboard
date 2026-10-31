import { describe, expect, it } from 'vitest';
import { milestones } from './milestones.ts';
import { upgrade } from './upgrade.ts';
import type { GalacticCommunity, Colony, LogEvent, Snapshot } from './types.ts';

const names = {
	techs: { tech_lasers_1: { name: 'Red Lasers', cost: 1, area: 'physics', tier: 1 } },
	agendas: { agenda_unlock_slot: { name: 'Expand The Council', cost: 7000, unlockedBy: [] } },
	edicts: {},
	names: { district_city: 'City District', building_research_lab_1: 'Research Lab' },
	perks: { ap_technological_ascendancy: 'Technological Ascendancy' },
	identityNames: {
		civic_technocracy: 'Technocracy',
		ethic_xenophile: 'Xenophile',
		gov_representative_democracy: 'Representative Democracy',
		gov_citizen_republic: 'Citizen Republic'
	},
	diploNames: { resolution_galactic_market_form: 'Form the Galactic Market' },
	traditionTrees: {
		tr_expansion: {
			name: 'Expansion',
			traditions: [
				{ key: 'tr_expansion_adopt', name: 'Expansion', role: 'adopt' },
				{ key: 'tr_expansion_colonization_fever', name: 'Colonization Fever', role: 'normal' }
			]
		}
	}
};

const colony = (planetId: number, name: string, colonizing = false) =>
	({ planetId, name, colonizing }) as Colony;
const save = (date: string, s: Partial<Snapshot> = {}) =>
	upgrade({ kind: 'save', campaign: 'c', date, ...s });
const resolution = (id: number, type: string) => ({
	id,
	type,
	proposer: 'Cydran Concern',
	support: [],
	oppose: [],
	ours: null
});
const galcom = (g: Partial<GalacticCommunity> = {}): GalacticCommunity => ({
	formed: '2202.01.01',
	members: [],
	member: true,
	voting: null,
	proposed: [],
	passed: [],
	voteEnds: null,
	nextVote: null,
	weights: {},
	categoryTimers: {},
	globalFlags: [],
	...g
});
const log = (date: string) => upgrade({ kind: 'log', campaign: 'c', date });
const labels = (snaps: Snapshot[]) => milestones(snaps, names).map((m) => `${m.date} ${m.label}`);

const built = (planetId: number, name: string, districts: [string, number, string[]][]): Colony =>
	({
		planetId,
		name,
		colonizing: false,
		districtList: districts.map(([type, n, buildings]) => ({
			type,
			built: n,
			zones: buildings.length ? [{ type: 'zone_research', buildings }] : []
		}))
	}) as Colony;

describe('milestones', () => {
	it('records districts built and buildings done or replaced, per colony', () => {
		const ms = milestones(
			[
				save('2206.01.01', { colonies: [colony(3, 'Earth')] }), // before districts were read
				save('2206.02.01', {
					colonies: [built(3, 'Earth', [['district_city', 2, ['building_research_lab_1']]])]
				}),
				save('2206.03.01', {
					colonies: [
						built(3, 'Earth', [['district_city', 4, ['building_research_lab_2']]]),
						built(159, 'AC Prime', [['district_city', 1, []]]) // new: its founding counts
					]
				})
			],
			names
		);
		expect(
			ms
				.filter((m) => m.kind === 'district' || m.kind === 'building')
				.map((m) => [m.planetId, m.label])
		).toEqual([
			[3, 'district built: City District ×2 — Earth'],
			[3, 'building removed: Research Lab — Earth'],
			[3, 'building done: research lab 2 — Earth']
		]);
	});

	it("records a nomad arkship's districts like a planet's (its id is −1 − ship id)", () => {
		const ms = milestones(
			[
				save('2200.01.01', { colonies: [built(-1, 'Peshnab', [['district_ark_city', 1, []]])] }),
				save('2200.02.01', { colonies: [built(-1, 'Peshnab', [['district_ark_city', 2, []]])] })
			],
			names
		);
		expect(ms.map((m) => [m.planetId, m.kind])).toEqual([[-1, 'district']]);
	});

	it('follows a colony from landing to established, and notices gains and losses', () => {
		const ms = milestones(
			[
				save('2205.01.01', { colonies: [colony(3, 'Earth'), colony(9, 'Mars')] }),
				save('2205.02.01', { colonies: [colony(3, 'Earth'), colony(159, 'AC Prime', true)] }),
				save('2205.03.01', {
					colonies: [colony(3, 'Earth'), colony(159, 'AC Prime'), colony(77, 'Taken')]
				})
			],
			names
		);
		expect(ms.map((m) => [m.date, m.kind, m.planetId])).toEqual([
			['2205.02.01', 'colonization', 159],
			['2205.02.01', 'colony-lost', 9],
			['2205.03.01', 'colony', 159],
			['2205.03.01', 'colony-gained', 77]
		]);
		expect(ms[0].x).toBeCloseTo(2205 + 1 / 12);
	});

	it('names traditions, trees, perks, research and passed agendas from the game data', () => {
		expect(
			labels([
				save('2201.01.01', {
					traditions: [],
					ascensionPerks: [],
					agendasDone: [],
					progress: { researched: [] } as never
				}),
				save('2201.02.01', {
					traditions: ['tr_expansion_adopt', 'tr_expansion_colonization_fever'],
					ascensionPerks: ['ap_technological_ascendancy'],
					agendasDone: ['agenda_unlock_slot'],
					progress: { researched: ['tech_lasers_1'] } as never
				})
			])
		).toEqual([
			'2201.02.01 tradition tree adopted: Expansion',
			'2201.02.01 tradition: Colonization Fever',
			'2201.02.01 ascension perk: Technological Ascendancy',
			'2201.02.01 researched: Red Lasers',
			'2201.02.01 agenda passed: Expand The Council'
		]);
	});

	it('compares a field only between saves that have it, skipping mod-feed months', () => {
		const roster = [{ id: 1, name: 'Ada', class: 'scientist' }];
		expect(
			labels([
				save('2201.01.01'), // before the field existed: unknown, not "all new"
				save('2201.02.01', { leaderRoster: roster, colonies: [colony(3, 'Earth')] }),
				log('2201.03.01'), // the mod's line: no colonies, no roster
				save('2201.04.01', {
					leaderRoster: [...roster, { id: 2, name: 'Bo', class: 'admiral' }],
					colonies: [colony(3, 'Earth')]
				})
			])
		).toEqual(['2201.04.01 new admiral: Bo']);
	});

	it('dates a refreshed leader pool by its new leaders, not hiring the pool empty', () => {
		const pool = (ids: number[], added: string) =>
			ids.map((id) => ({ id, class: 'official', added }));
		expect(
			labels([
				save('2204.12.01', { leaderPool: pool([272, 273], '2200.01.01') }),
				save('2205.01.01', { leaderPool: pool([273], '2200.01.01') }), // one hired
				save('2205.02.01', { leaderPool: [] }), // the last one hired
				save('2205.03.01', { leaderPool: pool([301, 302], '2205.02.10') }) // an early refresh
			])
		).toEqual(['2205.02.10 recruitable leaders refreshed']);
	});

	it("dates an arkship's Wanderlust visits by the save's flags, the rest at the save", () => {
		const cat = (seen: number, done = false) => ({
			key: 'galactic_landmark',
			seen,
			count: 17,
			done
		});
		const visit = {
			systemId: 1,
			system: 'Sol',
			date: '2205.02.11',
			categories: ['galactic_landmark']
		};
		expect(
			labels([
				save('2205.02.01', { wanderlust: { categories: [cat(0)], visits: [], complete: false } }),
				save('2205.03.01', {
					wanderlust: { categories: [cat(1)], visits: [visit], complete: false }
				}),
				// a rise without a named system (the flag's spelling not as read), then the category done
				save('2205.04.01', {
					wanderlust: { categories: [cat(17, true)], visits: [visit], complete: false }
				})
			])
		).toEqual([
			'2205.02.11 Wanderlust: Sol (Galactic Landmarks)',
			'2205.04.01 Wanderlust: Galactic Landmarks 17 / 17',
			'2205.04.01 Wanderlust: Galactic Landmarks done'
		]);
	});

	it('reports systems, species changes, wars, rulers and policies', () => {
		const sp = { id: '1', name: 'Human', cls: 'HUM', pops: 10 };
		expect(
			labels([
				save('2202.01.01', {
					knownSystems: [{ id: 1, name: 'Sol', x: 0, y: 0, owned: true, capital: true, lanes: [] }],
					species: [{ ...sp, traits: ['trait_adaptive'] }],
					wars: [],
					warLostDate: '0.01.01',
					ruler: { id: 1, name: 'Ada' },
					policies: { war_philosophy: 'unrestricted_wars' }
				}),
				save('2202.02.01', {
					knownSystems: [
						{ id: 1, name: 'Sol', x: 0, y: 0, owned: true, capital: true, lanes: [] },
						{ id: 2, name: 'Sirius', x: 0, y: 0, owned: true, capital: false, lanes: [] }
					],
					species: [{ ...sp, traits: ['trait_adaptive', 'trait_strong'] }],
					wars: [
						{
							id: '5',
							name: 'Border War',
							start: '2202.01.20',
							enemies: ['Tzynn'],
							allies: [],
							attacker: true,
							goal: null,
							enemyGoal: null,
							exhaustion: null,
							enemyExhaustion: null,
							battles: []
						}
					],
					warLostDate: '0.01.01',
					ruler: { id: 2, name: 'Bo' },
					policies: { war_philosophy: 'liberation_wars' }
				}),
				save('2202.03.01', { wars: [], warLostDate: '2202.02.15' })
			])
		).toEqual([
			'2202.02.01 system gained: Sirius',
			'2202.02.01 war started: Border War (vs Tzynn)',
			'2202.02.01 species modified: Human (strong)',
			'2202.02.01 new ruler: Bo',
			'2202.02.01 war philosophy: liberation wars',
			'2202.03.01 war ended: Border War',
			'2202.03.01 war lost'
		]);
	});

	it('compares owned systems only between saves that list them', () => {
		const sys = (name: string) => ({
			id: 0,
			name,
			x: 0,
			y: 0,
			owned: true,
			capital: false,
			lanes: []
		});
		const station = (system: string) => ({ system }) as NonNullable<Snapshot['stations']>[number];
		expect(
			labels([
				// older readings: only the capital's starbase, no knownSystems
				save('2203.07.01', { stations: [station('Sol')] }),
				save('2203.08.10', { knownSystems: [sys('Sol'), sys('Alpha Centauri')] }),
				save('2203.09.01', { stations: [station('Sol')] }),
				save('2206.11.01', { knownSystems: [sys('Sol'), sys('Alpha Centauri'), sys('Sirius')] })
			])
		).toEqual(['2206.11.01 system gained: Sirius']);
	});

	it('names government changes, including its type and origin', () => {
		const gov = (government: string[], governmentType: string, origin: string) =>
			({ government, governmentType, origin }) as Partial<Snapshot>;
		expect(
			labels([
				save('2203.01.01', { government: null }), // before the fields were read
				save('2203.02.01', gov(['ethic_xenophile'], 'gov_representative_democracy', 'origin_x')),
				save('2203.03.01', gov(['civic_technocracy'], 'gov_citizen_republic', 'origin_x'))
			])
		).toEqual([
			'2203.03.01 + Technocracy',
			'2203.03.01 − Xenophile',
			'2203.03.01 government: Representative Democracy → Citizen Republic'
		]);
	});

	it('logs DLCs and mods switched on or off between saves', () => {
		expect(
			labels([
				save('2203.01.01'), // older snapshot: unknown, not "everything enabled"
				save('2203.02.01', { dlcs: ['Utopia', 'Megacorp'], mods: ['A'] }),
				save('2203.03.01', { dlcs: ['Utopia', 'Nomads'], mods: [] })
			])
		).toEqual([
			'2203.03.01 dlc enabled: Nomads',
			'2203.03.01 dlc disabled: Megacorp',
			'2203.03.01 mod disabled: A'
		]);
	});
});

describe("milestones from the companion mod's events", () => {
	const ev = (date: string, kind: LogEvent['kind'], ...fields: string[]): LogEvent => ({
		date,
		kind,
		fields
	});

	it('re-dates the matching save-diffed milestone to the exact day, once', () => {
		const snaps = [
			save('2200.01.01', { colonies: [colony(1, 'Earth'), colony(2, 'Mars', true)] }),
			save('2200.02.01', {
				colonies: [colony(1, 'Earth'), colony(2, 'Mars')],
				logEvents: [ev('2200.01.17', 'colony', 'Mars')]
			})
		];
		expect(labels(snaps)).toEqual(['2200.01.17 colony established: Mars']);
	});

	it('keeps an event no save shows, and battles, which only the mod reports', () => {
		const snaps = [
			save('2200.01.01'),
			log('2200.02.01'),
			{
				...log('2200.03.01'),
				logEvents: [
					ev('2200.02.11', 'combat', 'Us', '1st Fleet', 'Pirates', 'Raiders', 'Sol'),
					ev('2200.02.12', 'leader-died', 'Ada')
				]
			}
		];
		expect(labels(snaps)).toEqual([
			'2200.02.11 battle at Sol: Us (1st Fleet) beat Pirates (Raiders)',
			'2200.02.12 leader died: Ada'
		]);
	});

	it('follows the Galactic Community: proposed, put to the vote, passed, failed, withdrawn', () => {
		const market = resolution(1, 'resolution_galactic_market_form');
		const growth = resolution(2, 'resolution_intergalacticdirective_regulated_growth');
		const recycling = resolution(3, 'resolution_ecology_recycling_initiatives');
		expect(
			labels([
				save('2210.01.01', { galcom: galcom({ proposed: [market, recycling] }) }),
				save('2210.02.01', {
					galcom: galcom({ proposed: [market, growth], voting: recycling })
				}),
				// the vote failed; the market was withdrawn; growth goes to the floor
				save('2210.03.01', { galcom: galcom({ proposed: [], voting: growth }) }),
				save('2210.04.01', { galcom: galcom({ passed: [growth], member: false }) })
			])
		).toEqual([
			'2210.02.01 resolution proposed: intergalacticdirective regulated growth (by Cydran Concern)',
			'2210.02.01 put to the vote: ecology recycling initiatives',
			'2210.03.01 put to the vote: intergalacticdirective regulated growth',
			'2210.03.01 resolution failed: ecology recycling initiatives',
			'2210.03.01 resolution withdrawn: Form the Galactic Market (by Cydran Concern)',
			'2210.04.01 we left the Galactic Community',
			'2210.04.01 resolution passed: intergalacticdirective regulated growth'
		]);
	});

	it('keeps a Galactic Community event in parts: action, resolution, proposer', () => {
		const market = resolution(1, 'resolution_galactic_market_form');
		const m = milestones(
			[
				save('2210.01.01', { galcom: galcom() }),
				save('2210.02.01', { galcom: galcom({ proposed: [market] }) })
			],
			names
		);
		expect(m.map((x) => x.galcom)).toEqual([
			{
				action: 'resolution proposed',
				resolution: 'resolution_galactic_market_form',
				by: 'Cydran Concern'
			}
		]);
	});

	it('does not take a save without a list of passed resolutions for everything passing', () => {
		const market = resolution(1, 'resolution_galactic_market_form');
		expect(
			labels([
				save('2210.01.01', { galcom: galcom({ passed: [] }) }),
				save('2210.02.01', { galcom: galcom({ passed: [market] }) })
			])
		).toEqual([]);
	});

	it('does not take a vote that passed for failed where the save had no list of passed ones', () => {
		const shield = resolution(1, 'resolution_mutualdefense_the_readied_shield');
		expect(
			labels([
				save('2207.12.01', { galcom: galcom({ voting: shield }) }),
				save('2208.01.01', { galcom: galcom({ passed: [] }) }), // read before READER 13
				save('2214.01.01', { galcom: galcom({ passed: [shield] }) })
			])
		).toEqual(['2208.01.01 resolution passed: mutualdefense the readied shield']);
	});
});
