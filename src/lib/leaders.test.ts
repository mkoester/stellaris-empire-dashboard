import { describe, expect, it } from 'vitest';
import { leaderRoles } from './leaders.ts';
import type { Explanation, LeaderInfo, Modifier } from './types.ts';

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
	'ltrait-planet:leader_trait_curator': ex([mod('planet_stability_add', 2)])
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
			['science ship', 'Voyager', 4]
		]);
		expect(roles[0].bonuses.map((b) => [b.source, b.modifiers.map((m) => m.key)])).toEqual([
			['Science Officer', ['science_ship_survey_speed']],
			['Curator', ['country_research_mult']]
		]);
		// on a ship only what applies where it is assigned, not the governor's planet modifier
		expect(roles[1].bonuses[0].modifiers.map((m) => m.key)).toEqual([
			'ship_anomaly_research_speed_mult'
		]);
		expect(self[0].modifiers.map((m) => m.key)).toEqual(['leader_age']);
	});

	it('governs a colony with the planet, sector and assigned-scope modifiers', () => {
		const { roles } = leaderRoles(
			leader({ class: 'official', governor: true, governs: 'Peshnab the Faithful' }),
			undefined,
			explain
		);
		expect(roles).toEqual([
			{
				kind: 'governor',
				name: 'Peshnab the Faithful',
				level: 4,
				bonuses: [
					{
						source: 'Curator',
						modifiers: [
							mod('planet_stability_add', 2),
							mod('ship_anomaly_research_speed_mult', 0.1)
						]
					}
				]
			}
		]);
	});

	it('holds nothing when idle', () => {
		expect(leaderRoles(leader({}), undefined, explain).roles).toEqual([]);
	});
});
