import { describe, expect, it } from 'vitest';
import { ambitions, displayName, ideologies, withNames } from './save.ts';

// Shaped like the 4.6 throwaway of 2026-11-24 (docs/save-format.md, "Ideologies", "Ambitions"):
// 2200.07.01 after codifying three tenets, 2200.08.01 after three ambition perks.
const name = (adjective: string, noun: string) => ({
	key: 'ideology_ajd_keyword',
	variables: [
		{ key: '1', value: { key: adjective } },
		{ key: '2', value: { key: noun } }
	]
});

describe('ideologies', () => {
	const raw = {
		galaxy: { ideologies_enabled: 'yes' },
		ideologies: {
			3: {
				type: 'militarist',
				origin: 234881064,
				custodian: 234881064,
				name: name('Human', 'Expansionism'),
				adopting_countries: 234881064,
				affected_systems: [1, 2]
			},
			18: {
				type: 'egalitarian',
				origin: 0,
				custodian: 0,
				name: name('Human', 'Liberalism'),
				adopting_countries: [0],
				affected_systems: [4, 11, 26],
				tenet_info: [
					{ tenet: 2, cooldown: '2200.06.01' },
					{ tenet: 0, cooldown: '2200.06.01' },
					{ tenet: 1, cooldown: '2200.06.01' }
				],
				pending_tenets: [
					{ tenets_rerolls_count: 0 },
					{ tenets: ['tenet_epistocracy', 'tenet_participation'], tenets_rerolls_count: 0 }
				]
			}
		},
		tenets: {
			0: { type: 'tenet_epistocracy', tier: 1 },
			1: { type: 'tenet_personal_accountability', tier: 2 },
			2: { type: 'tenet_laterality', tier: 3 }
		},
		countryBlocks: {
			0: {
				modules: {
					standard_ideology_module: {
						intel: { 3: { intel: 15, max_reached_intel: 15 }, 18: { intel: 100 } },
						adopted_ideology: 18,
						index: 3,
						value: 793.18796,
						past_monthly_strength_momenta: [0.38553, -3.61054, -3.58703],
						pending_levels: 0
					}
				}
			},
			5: { modules: { standard_ideology_module: {} } }, // knows nothing: left out
			6: { modules: {} }
		}
	};

	it('reads every ideology with its name, custodian, adopters and codified tenets by slot', () => {
		const r = ideologies(raw);
		expect(r.enabled).toBe(true);
		const ours = r.ideologies.find((i) => i.id === 18)!;
		expect(ours.name).toBe('Human Liberalism');
		expect(ours.adopters).toEqual([0]);
		expect(ours.tenets.map((t) => [t.key, t.tier])).toEqual([
			['tenet_epistocracy', 1],
			['tenet_personal_accountability', 2],
			['tenet_laterality', 3]
		]);
		// only open slots carry keys
		expect(ours.offered).toEqual([['tenet_epistocracy', 'tenet_participation']]);
		expect(ours.systems).toBe(3);
		expect(r.ideologies.find((i) => i.id === 3)?.adopters).toEqual([234881064]);
	});

	it("reads each empire's stand: strength, level, the last momentum and the ideologies it knows", () => {
		const r = ideologies(raw);
		expect(r.stands).toEqual([
			{
				countryId: 0,
				adopted: 18,
				strength: 793.18796,
				level: 3,
				momentum: -3.58703,
				pendingLevels: 0,
				intel: { 3: 15, 18: 100 }
			}
		]);
	});

	it('an empty galaxy: rule off, nothing founded', () => {
		const r = ideologies({ galaxy: {}, ideologies: {}, tenets: {}, countryBlocks: {} });
		expect(r).toEqual({ enabled: false, ideologies: [], stands: [] });
	});
});

describe('ambitions', () => {
	it('takes the last of the levels a save repeats from level 2 on', () => {
		// throwaway unitednationsofearth4_-337465913, 2200.10.01: the Falleran Star Dynasty on Force
		// of Will level 2 ("Utopian Missionaries" in game) read as no level at all (2026-11-24)
		const [row] = ambitions({
			countryBlocks: {
				16777219: {
					personality: 'utopian_missionaries',
					crisis_progression: {
						path: 'force_of_will_path',
						level: ['crisis_force_of_will_level_1', 'crisis_force_of_will_level_2']
					}
				}
			}
		});
		expect(row.level).toBe('crisis_force_of_will_level_2');
	});

	it("reads each empire's crisis path, its level (none yet) and its personality", () => {
		const rows = ambitions({
			countryBlocks: {
				0: {
					personality: 'honorbound_warriors',
					crisis_progression: { path: 'force_of_will_path', level: 'crisis_force_of_will_level_1' }
				},
				16777241: {
					personality: 'hyperthermia_empire',
					crisis_progression: { path: 'hyperthermia_path' }
				},
				234881064: {
					personality: 'became_the_crisis',
					crisis_progression: { path: 'nemesis_path', level: 'crisis_level_1' }
				},
				7: { personality: 'peaceful_traders' }
			}
		});
		expect(rows).toEqual([
			{
				countryId: 0,
				path: 'force_of_will_path',
				level: 'crisis_force_of_will_level_1',
				personality: 'honorbound_warriors'
			},
			{
				countryId: 16777241,
				path: 'hyperthermia_path',
				level: null,
				personality: 'hyperthermia_empire'
			},
			{
				countryId: 234881064,
				path: 'nemesis_path',
				level: 'crisis_level_1',
				personality: 'became_the_crisis'
			}
		]);
	});
});

describe('ideology names', () => {
	it('"$1$ $2$": a prescripted adjective takes the noun in its place', () => {
		const n = withNames({ PRESCRIPTED_species_adjective_humans1: 'Human $1$' }, () =>
			displayName(name('PRESCRIPTED_species_adjective_humans1', 'Liberalism'))
		);
		expect(n).toBe('Human Liberalism');
	});
	it('one word: the species name and the suffix for its last letter', () => {
		const word = (species: string, suffix: string) => ({
			key: 'ideology_single_word_format',
			variables: [
				{
					key: '1',
					value: {
						key: '%PREFIX%',
						variables: [
							{
								key: 'adjective',
								value: {
									key: '%ADJECTIVE%',
									variables: [{ key: 'adjective', value: { key: `SPEC_${species}` } }]
								}
							},
							{ key: '1', value: { key: suffix } }
						]
					}
				}
			]
		});
		expect(displayName(word('Raxycodium', 'ideo_suffix_2'))).toBe('Raxycodiumity');
		expect(displayName(word('Yru', 'ideo_suffix_1'))).toBe('Yrutism');
	});
});
