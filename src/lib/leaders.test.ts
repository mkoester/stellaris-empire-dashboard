import { describe, expect, it } from 'vitest';
import {
	baseLeaderCost,
	leaderCostFactors,
	leaderLimits,
	leaderOrder,
	leaderRoles,
	leaderUpkeep,
	traitRoles,
	upkeepFactors
} from './leaders.ts';
import type { Facts } from './triggers.ts';
import type { Explanation, LeaderInfo, Modifier, Snapshot } from './types.ts';

const mod = (key: string, value: number): Modifier => ({
	key,
	value,
	label: key,
	positiveIsGood: true
});
const ex = (modifiers: Modifier[], title = ''): Explanation => ({
	title,
	description: null,
	modifiers,
	text: null,
	facts: []
});
const leader = (l: Partial<LeaderInfo>): LeaderInfo => ({
	id: 1,
	name: 'Cosha Boxley',
	class: 'scientist',
	level: 3,
	bonus: 1,
	age: 40,
	traits: ['leader_trait_curator'],
	job: null,
	species: null,
	council: false,
	ruler: false,
	...l
});
const explain = {
	'ltrait:leader_trait_curator': ex([], 'Curator'),
	'ltrait-councilor:leader_trait_curator': ex([mod('country_research_mult', 0.05)]),
	'ltrait-modifier:leader_trait_curator': ex([mod('ship_anomaly_research_speed_mult', 0.1)]),
	'ltrait-self:leader_trait_curator': ex([mod('leader_age', 10)]),
	'ltrait-planet:leader_trait_curator': ex([mod('planet_stability_add', 2)]),
	// a class's effects per skill level (static modifiers skill_*)
	'modifier:skill_commander_navy': ex([mod('ship_fire_rate_mult', 0.03)])
};

describe('leaderRoles', () => {
	it('gives a scientist on the council and leading a science ship both roles, each at its level', () => {
		const seat = {
			leaderId: 1,
			name: 'Science Officer',
			ruler: false,
			council: 5, // level 3 + 1 own + 1 from the country
			effects: [{ now: mod('science_ship_survey_speed', 0.25) }]
		};
		const { roles, self } = leaderRoles(
			leader({ council: true, assigned: { kind: 'fleet', name: 'Voyager' } }),
			seat,
			explain
		);
		expect(roles.map((r) => [r.kind, r.name, r.level])).toEqual([
			['council', 'Science Officer', 5],
			['governor', null, 4], // not held: what it would do there
			['science ship', 'Voyager', 4]
		]);
		expect(roles[0].bonuses.map((b) => [b.source, b.modifiers.map((m) => m.key)])).toEqual([
			['Science Officer × 5', ['science_ship_survey_speed']],
			['Curator', ['country_research_mult']]
		]);
		// on a ship only what applies where it is assigned, not the governor's planet modifier
		const ship = roles.find((r) => r.kind === 'science ship')!;
		expect(ship.bonuses[0].modifiers.map((m) => m.key)).toEqual([
			'ship_anomaly_research_speed_mult'
		]);
		expect(self[0].modifiers.map((m) => m.key)).toEqual(['leader_age']);
	});

	it('governs a colony with the planet, sector and assigned-scope modifiers', () => {
		const { roles } = leaderRoles(
			leader({ class: 'official', governor: true, governs: 'Peshnab the Faithful' }),
			undefined,
			explain,
			1 // the country's councilor bonus
		);
		expect(roles.find((r) => r.active)).toEqual({
			kind: 'governor',
			name: 'Peshnab the Faithful',
			level: 4,
			active: true,
			bonuses: [
				{
					source: 'Curator',
					modifiers: [mod('planet_stability_add', 2), mod('ship_anomaly_research_speed_mult', 0.1)]
				}
			]
		});
		// and every other role an official can hold, not held: the council at its councilor level
		expect(roles.map((r) => [r.kind, r.active, r.level])).toEqual([
			['council', false, 5],
			['governor', true, 4],
			['galcom', false, 4],
			['federation', false, 4]
		]);
	});

	it("gives a commander's class effect per level where it commands, at its level", () => {
		const { roles } = leaderRoles(
			leader({ class: 'commander', assigned: { kind: 'fleet', name: 'Braulster Fleet' } }),
			undefined,
			{ 'modifier:skill_commander_navy': explain['modifier:skill_commander_navy'] }
		);
		const fleet = roles.find((r) => r.kind === 'fleet')!;
		expect(fleet.bonuses).toEqual([
			{ source: 'Commander × 4', modifiers: [mod('ship_fire_rate_mult', 0.12)] }
		]);
	});

	it("gives a governor's home-planet bonus only on its home, else marks it wasted", () => {
		const home = {
			'modifier:skill_official_background_planet_governor': ex([mod('planet_amenities_add', 200)])
		};
		const homeBonus = (l: Partial<LeaderInfo>) =>
			leaderRoles(
				leader({ class: 'official', home: 'Peshnab the Faithful', ...l }),
				undefined,
				home
			)
				.roles.find((r) => r.kind === 'governor')!
				.bonuses.find((b) => b.source.endsWith('home planet'))!;
		// Clyda Alford governs the arkship she is from (Roaming Korinth 2204.12)
		expect(
			homeBonus({ governor: true, governs: 'Peshnab the Faithful', governsHome: true })
		).toEqual({
			source: 'Official × 4: home planet',
			modifiers: [mod('planet_amenities_add', 800)]
		});
		expect(homeBonus({ governor: true, governs: 'Gozam III', governsHome: false })).toMatchObject({
			wasted: true,
			note: 'wasted: governs Gozam III, not its home Peshnab the Faithful'
		});
		expect(homeBonus({}).note).toBe('governing its home, Peshnab the Faithful');
	});

	it("gives an official's delegate effects per level, the engine's", () => {
		const roles = leaderRoles(leader({ class: 'official' }), undefined, {}).roles;
		expect(roles.find((r) => r.kind === 'galcom')!.bonuses).toEqual([
			{
				source: 'Official × 4',
				modifiers: [
					{ key: 'diplo_weight_mult', value: 0.4, label: 'Diplomatic Weight', positiveIsGood: true }
				]
			}
		]);
	});

	it("applies a trait's triggered modifiers by what the leader and the save tell", () => {
		// Righteous (4.5.3): crime by the empire's kind; one by class; one the save cannot answer
		const when = (leaf: string, value: string) => ({ leaf, value });
		const righteous = {
			'ltrait:leader_trait_righteous': ex([], 'Righteous'),
			'ltrait-planet:leader_trait_righteous': ex([
				{ ...mod('planet_crime_add', -25), when: when('trait_is_gestalt_check', 'no') },
				{
					...mod('planet_crime_no_happiness_add', -25),
					when: when('trait_is_gestalt_check', 'yes')
				},
				{ ...mod('planet_stability_add', 1), when: when('leader_class', 'commander') },
				{ ...mod('planet_amenities_add', 5), when: when('owner', 'scope') }
			])
		};
		const governor = (government: string[]) =>
			leaderRoles(
				leader({ class: 'official', traits: ['leader_trait_righteous'], governor: true }),
				undefined,
				righteous,
				0,
				{ government } as unknown as Facts
			).roles.find((r) => r.kind === 'governor')!.bonuses[0];
		const individualist = governor(['ethic_egalitarian']);
		expect(individualist.modifiers.map((m) => m.key)).toEqual([
			'planet_crime_add',
			'planet_amenities_add'
		]);
		expect(individualist.note).toBe('may apply, if owner (…)');
		expect(governor(['auth_hive_mind']).modifiers.map((m) => m.key)).toEqual([
			'planet_crime_no_happiness_add',
			'planet_amenities_add'
		]);
	});

	it('shows an idle leader what its class could do, none held', () => {
		const { roles } = leaderRoles(leader({}), undefined, explain);
		expect(roles.map((r) => [r.kind, r.active])).toEqual([
			['council', false],
			['governor', false],
			['science ship', false]
		]);
		expect(roles[2].bonuses[0].modifiers.map((m) => m.key)).toEqual([
			'ship_anomaly_research_speed_mult'
		]);
	});
});

describe('leaderOrder', () => {
	it('puts the ruler first, then the highest level, ties officials, scientists, commanders', () => {
		const ls = [
			{ name: 'C', class: 'commander', level: 2 },
			{ name: 'S', class: 'scientist', level: 2 },
			{ name: 'Lo', class: 'official', level: 1 },
			{ name: 'R', class: 'official', level: 1, ruler: true },
			{ name: 'O', class: 'official', level: 2 },
			{ name: 'Hi', class: 'commander', level: 3 }
		];
		expect(ls.sort(leaderOrder).map((l) => l.name)).toEqual(['R', 'Hi', 'O', 'S', 'C', 'Lo']);
	});
});

describe('leaderLimits', () => {
	it('adds what the save shows held to the base 3, per class and for every class', () => {
		const s = {
			traditions: ['tr_diplomacy_finish'],
			ascensionPerks: [],
			edicts: [],
			policies: {},
			government: ['civic_technocracy'],
			origin: null,
			progress: { researched: ['tech_x'] },
			countryModifiers: [{ key: 'vitality_conservation' }]
		} as unknown as Snapshot;
		const cap = {
			'tradition:tr_diplomacy_finish': { official: 1 },
			'civic:civic_technocracy': { official: -1, scientist: 1 },
			'tech:tech_x': { commander: 1 },
			'modifier:vitality_conservation': { leader: 1 },
			'tradition:tr_not_taken': { official: 5 }
		};
		expect(leaderLimits(s, cap)).toEqual({ official: 4, scientist: 5, commander: 5 });
	});
});

describe('leader cost and upkeep', () => {
	it('costs 100, 175, 350 unity at levels 1–3 before modifiers', () => {
		expect([1, 2, 3].map(baseLeaderCost)).toEqual([100, 175, 350]);
	});

	it("applies the held cost modifiers and the seats' — 75 for a level-1 leader", () => {
		// Roaming Korinth 2204.12 (4.5.3): The Empire Needs You −25 %, the game's Recruitable Leaders 75
		const s = { traditions: ['tr_aptitude_the_empire_needs_you'] } as unknown as Snapshot;
		const cost = {
			'tradition:tr_aptitude_the_empire_needs_you': { leader: -0.25 },
			'tradition:tr_not_taken': { leader: -0.5 }
		};
		const f = leaderCostFactors(s, cost);
		expect(Math.round(baseLeaderCost(1) * f.official)).toBe(75);
		const seat = { effects: [{ now: mod('leader_scientists_cost_mult', -0.1) }] };
		expect(leaderCostFactors(s, cost, [seat]).scientist).toBeCloseTo(0.65);
	});

	it("reads the class's upkeep factor back from the budget, with each leader's own", () => {
		// commanders 3.3 unity for levels 2 and 1 → 0.55: 2.2 and 1.1, as the game shows
		const f = upkeepFactors(
			[
				{ class: 'commander', level: 2, own: 0 },
				{ class: 'commander', level: 1, own: 0 }
			],
			[{ source: 'leader_commanders', expenses: { unity: 3.3 } }]
		);
		expect(f.commander).toBeCloseTo(0.55);
		expect(f.official).toBeNull(); // no budget line
		expect(leaderUpkeep(2, f.commander!)).toBeCloseTo(2.2);
		// a leader whose trait halves its own upkeep shares the class's line
		const g = upkeepFactors(
			[
				{ class: 'commander', level: 2, own: -0.5 },
				{ class: 'commander', level: 1, own: 0 }
			],
			[{ source: 'leader_commanders', expenses: { unity: 1.3 } }] // 2·2·(0.55 − 0.5) + 2·1·0.55
		);
		expect(leaderUpkeep(2, g.commander!, -0.5)).toBeCloseTo(0.2);
	});
});

describe('traitRoles', () => {
	it("badges the roles a trait acts in; 'wherever assigned' as the class's assignments", () => {
		// the fixture's Curator: council, governor (planet), wherever assigned, itself
		expect(traitRoles('leader_trait_curator', 'scientist', explain)).toEqual([
			'council',
			'governor',
			'science ship',
			'itself'
		]);
		expect(traitRoles('leader_trait_curator', 'commander', explain)).toEqual([
			'council',
			'governor',
			'fleet',
			'army',
			'itself'
		]);
		expect(traitRoles('leader_trait_unknown', 'official', explain)).toEqual([]);
	});
});
