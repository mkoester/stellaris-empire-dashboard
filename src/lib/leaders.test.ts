import { describe, expect, it } from 'vitest';
import { leaderLimits, leaderOrder, leaderRoles } from './leaders.ts';
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
			['Science Officer', ['science_ship_survey_speed']],
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
			{ source: 'commander × 4', modifiers: [mod('ship_fire_rate_mult', 0.12)] }
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
