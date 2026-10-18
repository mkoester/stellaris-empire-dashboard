import { describe, expect, it } from 'vitest';
import { milestones } from './milestones.ts';
import { upgrade } from './upgrade.ts';
import type { Colony, Snapshot } from './types.ts';

const names = {
	techs: { tech_lasers_1: { name: 'Red Lasers', cost: 1, area: 'physics', tier: 1 } },
	agendas: { agenda_unlock_slot: { name: 'Expand The Council', cost: 7000 } },
	edicts: {},
	names: { district_city: 'City District', building_research_lab_1: 'Research Lab' },
	perks: { ap_technological_ascendancy: 'Technological Ascendancy' },
	identityNames: {
		civic_technocracy: 'Technocracy',
		ethic_xenophile: 'Xenophile',
		gov_representative_democracy: 'Representative Democracy',
		gov_citizen_republic: 'Citizen Republic'
	},
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
					wars: [{ id: '5', name: 'Border War', start: '2202.01.20', enemies: ['Tzynn'] }],
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
});
