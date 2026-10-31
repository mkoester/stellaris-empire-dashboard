import { describe, expect, it } from 'vitest';
import { upgrade } from '#lib/upgrade.ts';
import type { Colony, GalaxySystem, GameData, Snapshot } from '#lib/types.ts';
import type { Target } from './replay.ts';
import {
	autoGoals,
	orderResearch,
	orderTraditions,
	traditionName,
	check,
	groupOf,
	label,
	unavailable,
	validTarget,
	type LabelCtx,
	type PlanCtx
} from './kinds.ts';

const colony = (planetId: number, extra: Partial<Colony> = {}) =>
	({
		planetId,
		name: `Colony ${planetId}`,
		colonizing: false,
		districtList: [],
		buildQueue: [],
		...extra
	}) as Colony;

const save = (s: Partial<Snapshot> = {}): Snapshot =>
	upgrade({
		kind: 'save',
		campaign: 'c',
		date: '2210.01.01',
		countryId: 0,
		progress: {
			research: [{ area: 'physics', tech: 'tech_b', progress: 10 }],
			researched: ['tech_a'],
			agenda: null,
			traditionsTaken: 0,
			nextElection: null,
			costSettings: { technology: 1, traditions: 1 }
		},
		...s
	});

const system = (id: number, extra: Partial<GalaxySystem> = {}): GalaxySystem => ({
	id,
	name: `S${id}`,
	x: 0,
	y: 0,
	star: 'sc_g',
	lanes: [],
	visited: true,
	owned: false,
	ownerId: null,
	bodies: [],
	megastructures: [],
	...extra
});

const data = {
	techs: {
		tech_a: { name: 'A', cost: 1, area: 'physics', tier: 1 },
		tech_c: { name: 'C', cost: 1, area: 'physics', tier: 1 }
	},
	techRequirements: {
		tech_c: { prerequisites: [], potential: { never: true }, rare: false, dangerous: false }
	},
	traditionTrees: {},
	perks: {},
	names: { district_city: 'City District' },
	focus: { categories: {}, cards: {}, rewards: {} },
	situationTypes: {},
	identityNames: { auth_democratic: 'Democratic' },
	anomalyCategories: {},
	civicAuthority: { civic_imperial_cult: { require: ['auth_imperial'], forbid: [] } }
} as unknown as PlanCtx['data'];

const ctx = (
	latest: Snapshot,
	galaxy: GalaxySystem[] = [],
	over: Partial<PlanCtx> = {}
): PlanCtx => ({
	latest,
	galaxy,
	data,
	possible: (p) => (p && 'never' in p ? false : true),
	reach: [],
	districtCap: () => ({ cap: 3, blocked: 1 }),
	megaFit: () => false,
	seen: { anomalies: [], digSites: [], situations: [], contacts: [] },
	...over
});
const state = (
	kind: string,
	target: Record<string, string | number>,
	c: PlanCtx,
	checked = false
) => check(kind, target, checked, c).state;

describe('goal checks', () => {
	it('tech: researched, being researched, ruled out for the empire', () => {
		const c = ctx(save());
		expect(state('tech', { tech: 'tech_a' }, c)).toBe('done');
		expect(state('tech', { tech: 'tech_b' }, c)).toBe('progress');
		expect(state('tech', { tech: 'tech_c' }, c)).toBe('blocked');
	});

	it("outpost: ours by the branch's save; blocked once another empire holds it", () => {
		const s = save({
			knownSystems: [{ id: 1, name: 'S1', x: 0, y: 0, owned: true, capital: false, lanes: [] }]
		});
		const c = ctx(s, [system(1), system(2, { ownerId: 5 }), system(3)]);
		expect(state('outpost', { system: 1 }, c)).toBe('done');
		expect(state('outpost', { system: 2 }, c)).toBe('blocked');
		expect(state('outpost', { system: 3 }, c)).toBe('open');
	});

	it('colony: settling, settled, taken by someone else', () => {
		const galaxy = [
			system(1, {
				bodies: [
					{
						id: 10,
						name: 'P',
						class: 'pc_arid',
						size: 16,
						star: false,
						moonOf: null,
						ownerId: 7,
						colonized: true,
						deposits: [],
						anomaly: null,
						dist: 1
					}
				]
			})
		];
		expect(
			state('colony', { planet: 4 }, ctx(save({ colonies: [colony(4, { colonizing: true })] })))
		).toBe('progress');
		expect(state('colony', { planet: 4 }, ctx(save({ colonies: [colony(4)] })))).toBe('done');
		expect(state('colony', { planet: 10 }, ctx(save(), galaxy))).toBe('blocked');
	});

	it('districts: counted, and blocked when the cap (blockers cleared) is too low', () => {
		const s = save({
			colonies: [colony(4, { districtList: [{ type: 'district_city', built: 2, zones: [] }] })]
		});
		expect(state('district', { planet: 4, district: 'district_city', count: 2 }, ctx(s))).toBe(
			'done'
		);
		expect(state('district', { planet: 4, district: 'district_city', count: 4 }, ctx(s))).toBe(
			'progress'
		);
		expect(state('district', { planet: 4, district: 'district_city', count: 5 }, ctx(s))).toBe(
			'blocked'
		);
	});

	it('anomaly: in progress while listed, done once gone after being seen', () => {
		const listed = save({ anomalies: [{ planetId: 9, planet: 'X', systemId: 1, category: 'a' }] });
		expect(state('anomaly', { planet: 9 }, ctx(listed))).toBe('progress');
		expect(state('anomaly', { planet: 9 }, ctx(save({ anomalies: [] })))).toBe('unknown');
		const seen = { anomalies: [9], digSites: [], situations: [], contacts: [] };
		expect(state('anomaly', { planet: 9 }, ctx(save({ anomalies: [] }), [], { seen }))).toBe(
			'done'
		);
	});

	it('first contact: aborted is blocked, finished done', () => {
		const fc = (status: string) =>
			save({
				firstContacts: [
					{
						id: 1,
						countryId: 3,
						name: 'Them',
						systemId: 1,
						leaderId: null,
						leaderName: null,
						date: '',
						daysLeft: null,
						difficulty: 1,
						clues: 0,
						stage: '1',
						status
					}
				]
			});
		expect(state('contact', { country: 3 }, ctx(fc('aborted')))).toBe('blocked');
		expect(state('contact', { country: 3 }, ctx(fc('finished')))).toBe('done');
		expect(state('contact', { country: 3 }, ctx(fc('in_progress')))).toBe('open');
	});

	it('an arkship visit is done once counted (for an avoid goal: it happened)', () => {
		const s = save({
			wanderlust: {
				categories: [],
				visits: [{ systemId: 5, system: 'S5', date: '2205.01.01', categories: [] }],
				complete: false
			}
		});
		expect(check('wanderlust_visit', { system: 5 }, false, ctx(s))).toEqual({
			state: 'done',
			why: 'counted 2205.01.01'
		});
		expect(state('wanderlust_visit', { system: 6 }, ctx(s))).toBe('open');
		expect(state('wanderlust_visit', { system: 6 }, ctx(save()))).toBe('unknown');
	});

	it('civic: held, or blocked by an authority it needs', () => {
		const s = save({ government: ['auth_democratic', 'civic_x'] });
		expect(state('identity', { key: 'civic_x' }, ctx(s))).toBe('done');
		expect(state('identity', { key: 'civic_imperial_cult' }, ctx(s))).toBe('blocked');
	});

	it('starbase level: reached, or not yet', () => {
		const st = (level: string) =>
			save({
				stations: [
					{
						id: 1,
						system: 'S1',
						systemId: 1,
						level,
						modules: [],
						buildings: [],
						queue: [],
						slots: 0,
						shipyard: null,
						arkship: false
					}
				]
			});
		expect(state('station_level', { system: 1, level: 'starport' }, ctx(st('starhold')))).toBe(
			'done'
		);
		expect(state('station_level', { system: 1, level: 'citadel' }, ctx(st('starhold')))).toBe(
			'open'
		);
	});

	it('megastructure: built and ours, or blocked when the system does not fit', () => {
		const galaxy = [system(1, { owned: true, megastructures: ['ring_world_2'] }), system(2)];
		expect(
			state('megastructure', { system: 1, structure: 'ring_world' }, ctx(save(), galaxy))
		).toBe('done');
		expect(
			state('megastructure', { system: 2, structure: 'ring_world' }, ctx(save(), galaxy))
		).toBe('blocked');
	});

	it('free goals are ticked off by hand', () => {
		expect(state('free', {}, ctx(save()))).toBe('open');
		expect(state('free', {}, ctx(save()), true)).toBe('done');
	});
});

describe('labels, groups, targets', () => {
	const names: LabelCtx = {
		data,
		system: (id) => `S${id}`,
		planet: (id) => `P${id}`,
		country: (id) => `E${id}`
	};

	it('names goals, the player’s title first', () => {
		expect(label('district', { planet: 4, district: 'district_city', count: 3 }, '', names)).toBe(
			'3 × City District on P4'
		);
		expect(label('outpost', { system: 2 }, 'chokepoint', names)).toBe('chokepoint');
		expect(groupOf('tech')).toBe('research');
		expect(groupOf('nope')).toBe('other');
	});

	it('checks targets against the kind’s fields', () => {
		expect(validTarget('survey', { system: 3 })).toBe(true);
		expect(validTarget('survey', { system: 3, extra: 1 })).toBe(false);
		expect(validTarget('tech', { tech: '' })).toBe(false);
		expect(validTarget('free', {})).toBe(true);
	});
});

describe('nomads', () => {
	const nomad = (extra: Partial<Snapshot> = {}) =>
		save({
			situations: [
				{
					id: 1,
					type: 'situation_nomad_economy',
					progress: 0,
					monthly: null,
					approach: null,
					stage: null
				}
			],
			...extra
		});

	it('build no outposts, but waystations and arkships', () => {
		expect(state('outpost', { system: 3 }, ctx(nomad(), [system(3)]))).toBe('blocked');
		expect(unavailable(nomad())).toEqual(['outpost', 'colony']);
		expect(state('colony', { planet: 4 }, ctx(nomad()))).toBe('blocked');
		expect(unavailable(save())).toEqual(['waystation', 'arkship']);
		expect(state('waystation', { system: 3 }, ctx(save(), [system(3)]))).toBe('blocked');
		expect(state('arkship', { type: 'military', count: 1 }, ctx(save()))).toBe('blocked');
	});

	it('waystation: done once a waystation of ours is there; first survey an unowned system', () => {
		const body = {
			id: 9,
			name: 'P',
			class: 'pc_barren',
			size: 5,
			star: false,
			moonOf: null,
			ownerId: null,
			colonized: false,
			deposits: [],
			anomaly: null,
			dist: 1
		};
		const unsurveyed = [system(3, { bodies: [{ ...body, surveyed: false }] })];
		expect(check('waystation', { system: 3 }, false, ctx(nomad(), unsurveyed))).toEqual({
			state: 'open',
			why: 'survey it first (1 bodies left)'
		});
		const built = nomad({
			stations: [
				{
					id: 1,
					system: 'S3',
					systemId: 3,
					level: 'waystation_1',
					modules: [],
					buildings: [],
					queue: [],
					slots: 0,
					shipyard: null,
					arkship: false
				}
			]
		});
		expect(state('waystation', { system: 3 }, ctx(built, unsurveyed))).toBe('done');
	});

	it('arkships: counted per type over every tier', () => {
		const s = nomad({
			ships: [
				{ group: 'station', size: 'military_arkship_tier_1', count: 1 },
				{ group: 'station', size: 'military_arkship_tier_2', count: 1 }
			]
		});
		expect(state('arkship', { type: 'military', count: 2 }, ctx(s))).toBe('done');
		expect(check('arkship', { type: 'science', count: 1 }, false, ctx(s))).toEqual({
			state: 'open',
			why: '0 of 1'
		});
	});
});

describe('autoGoals', () => {
	it('lists every tradition of an adopted tree and each perk taken', () => {
		const trees = {
			traditionTrees: {
				exp: {
					name: 'Expansion',
					traditions: [
						{ key: 'tr_exp_adopt', name: 'A', role: 'adopt' },
						{ key: 'tr_exp_1', name: 'B', role: 'normal' },
						{ key: 'tr_exp_finish', name: 'F', role: 'finish' }
					]
				},
				other: { name: 'Other', traditions: [{ key: 'tr_o_adopt', name: 'O', role: 'adopt' }] }
			}
		};
		const goals = autoGoals(
			save({ traditions: ['tr_exp_adopt'], ascensionPerks: ['ap_x'] }),
			trees
		);
		expect(goals.map((g) => g.id)).toEqual([
			'auto-tr-tr_exp_adopt',
			'auto-tr-tr_exp_1',
			'auto-tr-tr_exp_finish',
			'auto-ap-ap_x'
		]);
		expect(
			state('tradition', { tradition: 'tr_exp_adopt' }, ctx(save({ traditions: ['tr_exp_adopt'] })))
		).toBe('done');
	});
});

describe('traditions in the order the game allows', () => {
	const t = (key: string, role = 'normal') => ({ key, name: key, role });
	const data = {
		traditionTrees: {
			sc: {
				name: 'Statecraft',
				traditions: [
					t('sc_adopt', 'adopt'),
					t('sc_a'),
					t('sc_b'),
					t('sc_c'),
					t('sc_finish', 'finish')
				]
			},
			cy: {
				name: 'Cybernetics',
				traditions: [t('cy_adopt', 'adopt'), t('cy_a'), t('cy_b'), t('cy_finish', 'finish')]
			}
		},
		traditionPrereqs: { sc_b: ['sc_a'] }
	};
	const g = (k: string) => ({ kind: 'tradition', target: { tradition: k } });
	const keys = (list: { target: { tradition?: unknown } }[]) => list.map((x) => x.target.tradition);

	it('auto goals: taken ones as picked, then the rest of the tree', () => {
		const out = autoGoals(save({ traditions: ['sc_adopt', 'sc_c', 'sc_a'] }), data);
		expect(out.map((x) => x.target.tradition)).toEqual([
			'sc_adopt',
			'sc_c',
			'sc_a',
			'sc_b',
			'sc_finish'
		]);
	});

	it('a planned adoption brings its tree; a planned pick its adoption and the picks it needs', () => {
		expect(autoGoals(save(), data, ['cy_adopt']).map((x) => x.target.tradition)).toEqual([
			'cy_a',
			'cy_b',
			'cy_finish'
		]);
		expect(autoGoals(save(), data, ['sc_b']).map((x) => x.target.tradition)).toEqual([
			'sc_adopt',
			'sc_a'
		]);
	});

	it('repairs an order: the finisher last, a pick after what it needs, taken ones first as picked', () => {
		// the user's stored order 2026-10-31: the finisher before a pick
		const stored = ['sc_finish', 'sc_b', 'sc_c', 'sc_a', 'sc_adopt'].map(g);
		expect(keys(orderTraditions(stored, data, []))).toEqual([
			'sc_adopt',
			'sc_c',
			'sc_a',
			'sc_b',
			'sc_finish'
		]);
		// free choices keep the plan's order: sc_c before sc_a as stored
		expect(keys(orderTraditions(['sc_adopt', 'sc_c', 'sc_a', 'sc_b'].map(g), data, []))).toEqual([
			'sc_adopt',
			'sc_c',
			'sc_a',
			'sc_b'
		]);
		expect(
			keys(orderTraditions(['sc_a', 'sc_adopt', 'sc_c'].map(g), data, ['sc_adopt', 'sc_c']))
		).toEqual(['sc_adopt', 'sc_c', 'sc_a']);
	});
});

describe('tradition labels and tier gates', () => {
	it('names a pick with its tree', () => {
		const data = {
			traditionTrees: {
				t: {
					name: 'Expansion',
					traditions: [
						{ key: 'a', name: 'A', role: 'adopt' },
						{ key: 'b', name: 'B', role: 'normal' },
						{ key: 'f', name: 'F', role: 'finish' }
					]
				}
			}
		};
		expect(['a', 'b', 'f'].map((k) => traditionName(k, data))).toEqual([
			'Expansion (adopt)',
			'Expansion: B',
			'Expansion (finished)'
		]);
	});

	it('counts the researched techs of a tier in an area', () => {
		const s = save();
		const c = ctx(s, [], {
			data: {
				...data,
				techs: { tech_a: { name: 'A', cost: 1, area: 'engineering', tier: 3 } }
			} as PlanCtx['data']
		});
		expect(check('tech_tier', { area: 'engineering', tier: 3, count: 6 }, false, c)).toEqual({
			state: 'progress',
			why: '1 of 6, 5 more'
		});
		expect(state('tech_tier', { area: 'engineering', tier: 3, count: 1 }, c)).toBe('done');
	});
});

describe('orderResearch', () => {
	it('puts a tech after the planned techs and tier gates it needs, gates in order', () => {
		const techs = {
			mega: { name: 'M', cost: 1, area: 'engineering', tier: 3 },
			pre: { name: 'P', cost: 1, area: 'engineering', tier: 1 },
			alt: { name: 'A', cost: 1, area: 'engineering', tier: 1 }
		} as unknown as GameData['techs'];
		const techRequirements = {
			mega: {
				prerequisites: ['pre'],
				anyOf: [['alt', 'x']],
				potential: null,
				rare: false,
				dangerous: false
			}
		} as unknown as GameData['techRequirements'];
		const tech = (t: string) => ({ kind: 'tech', target: { tech: t } as Target });
		const gate = (tier: number) => ({
			kind: 'tech_tier',
			target: { area: 'engineering', tier, count: 6 } as Target
		});
		// the user's stored order 2026-10-31: the tech among its gates, tier 3's gate before tier 2's
		const out = orderResearch([gate(1), tech('mega'), gate(2), tech('alt'), tech('pre')], {
			techs,
			techRequirements
		});
		expect(out.map((g) => g.target.tech ?? `tier ${g.target.tier}`)).toEqual([
			'tier 1',
			'tier 2',
			'alt',
			'pre',
			'mega'
		]);
	});
});
