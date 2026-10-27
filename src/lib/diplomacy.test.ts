import { describe, expect, it } from 'vitest';
import {
	agglomerate,
	empireFacts,
	factsText,
	legendMatch,
	clusters,
	diplomacyView,
	ethicsHistory,
	levelOf,
	neighbours,
	pairOffsets,
	parseDiplomacyView,
	type DiploNode,
	type DiploSnap,
	type LegendKey
} from './diplomacy.ts';
import type { DiploCountry, Relation } from './types.ts';

describe('levelOf', () => {
	it("follows the game's intel levels", () => {
		expect(levelOf(9.9, 'government')).toBe(0);
		expect(levelOf(10, 'government')).toBe(1);
		expect(levelOf(19, 'diplomacy')).toBe(0);
		expect(levelOf(20, 'diplomacy')).toBe(1);
		expect(levelOf(49.9, 'diplomacy')).toBe(1);
		expect(levelOf(50, 'diplomacy')).toBe(2);
		expect(levelOf(100, 'diplomacy')).toBe(4);
	});
});

describe('diplomacyView', () => {
	const country = (id: number, c: Partial<DiploCountry> = {}): DiploCountry => ({
		id,
		capitalSystem: id * 10,
		overlord: null,
		federation: null,
		nomadic: false,
		relations: [],
		...c
	});
	const rel = (countryId: number, agreements: string[] = [], opinion = 0) => ({
		countryId,
		opinion,
		hostile: false,
		agreements
	});
	const ours = (countryId: number): Relation => ({
		countryId,
		name: `E${countryId}`,
		contact: true,
		communications: true,
		hostile: false,
		opinion: 0,
		trust: 0,
		threat: 0,
		borderRange: null,
		agreements: []
	});
	// us (0) and empires 1 and 2, which have a defensive pact and opinions of each other; 3 we
	// have not met, 4 is 1's subject
	const snap = (date: string, intel: Record<number, number>, pact = true): DiploSnap => ({
		date,
		countryId: 0,
		intel: Object.entries(intel).map(([id, v]) => ({ countryId: Number(id), intel: v })),
		diplomacy: [
			country(0),
			country(1, { relations: [rel(2, pact ? ['defensive_pact'] : [], 300), rel(3, ['embassy'])] }),
			country(2, { relations: [rel(1, pact ? ['defensive_pact'] : [], 250), rel(0, [], -20)] }),
			country(3),
			country(4, { overlord: 1 })
		],
		allWars: [],
		relations: [ours(1), ours(2), ours(4)],
		countries: [1, 2, 4].map((id) => ({
			id,
			name: `C${id}`,
			type: 'default',
			shipset: null,
			flagColor: 'red',
			ethics: ['ethic_xenophile'],
			authority: null,
			civics: [],
			governmentType: null,
			origin: null
		}))
	});
	const colors = { red: '#ff0000' };
	const pacts = (d: ReturnType<typeof diplomacyView>) =>
		d!.edges.filter((e) => e.kind === 'defensive_pact');

	it('shows a pact through either side at diplomacy level 2', () => {
		const d = diplomacyView([snap('2210.01.01', { 1: 10, 2: 50, 4: 10 })], colors, false)!;
		expect(d.nodes.map((n) => n.id)).toEqual([0, 1, 2, 4]); // 3 not met
		expect(pacts(d)).toMatchObject([{ from: 1, to: 2, stale: false }]);
		// 1's opinion of 2 needs diplomacy 2 on 1; theirs of us always shows
		expect(d.opinions['1:2']).toBeUndefined();
		expect(d.opinions['2:1']).toMatchObject({ value: 250 });
		expect(d.opinions['2:0']).toMatchObject({ value: -20 });
		expect(d.nodes.find((n) => n.id === 1)).toMatchObject({ color: '#ff0000', unmet: 0 });
		// the subject is public
		expect(d.edges).toContainEqual(expect.objectContaining({ kind: 'subject', from: 1, to: 4 }));
	});

	it('hides what our intel does not reach', () => {
		const d = diplomacyView([snap('2210.01.01', { 1: 40, 2: 5 })], colors, false)!;
		expect(pacts(d)).toEqual([]);
		expect(d.nodes.find((n) => n.id === 2)?.government).toBeNull();
		expect(d.nodes.find((n) => n.id === 1)?.government?.value.ethics).toEqual(['ethic_xenophile']);
	});

	it('keeps what intel showed before, unverified since then', () => {
		const d = diplomacyView(
			[snap('2210.01.01', { 1: 60, 2: 60 }), snap('2211.01.01', { 1: 15, 2: 15 })],
			colors,
			false
		)!;
		expect(pacts(d)).toMatchObject([{ asOf: '2210.01.01', stale: true }]);
		expect(d.opinions['1:2']).toMatchObject({ value: 300, stale: true });
		// 1's embassy with an empire we have not met counts as unmet
		expect(d.nodes.find((n) => n.id === 1)?.unmet).toBe(1);
	});

	it('drops a pact our intel saw end', () => {
		const d = diplomacyView(
			[snap('2210.01.01', { 1: 60, 2: 60 }), snap('2211.01.01', { 1: 60, 2: 60 }, false)],
			colors,
			false
		)!;
		expect(pacts(d)).toEqual([]);
	});

	it('shows everything with the cheat', () => {
		const d = diplomacyView([snap('2210.01.01', { 1: 0, 2: 0 })], colors, true)!;
		expect(d.nodes.map((n) => n.id)).toEqual([0, 1, 2, 3, 4]);
		expect(pacts(d)).toHaveLength(1);
		expect(d.edges).toContainEqual(expect.objectContaining({ kind: 'embassy', from: 1, to: 3 }));
	});
});

describe('the graph', () => {
	it('spreads the edges of one pair', () => {
		expect(
			pairOffsets([
				{ from: 1, to: 2 },
				{ from: 2, to: 1 },
				{ from: 1, to: 3 },
				{ from: 1, to: 2 }
			])
		).toEqual([-1, 0, 0, 1]);
	});

	it('finds an empire and its partners', () => {
		expect([
			...neighbours(
				[
					{ from: 1, to: 2 },
					{ from: 3, to: 1 },
					{ from: 4, to: 5 }
				],
				1
			)
		]).toEqual([1, 2, 3]);
	});

	it('repairs a stored view', () => {
		expect(parseDiplomacyView({ layout: 'x', hiddenEdges: ['embassy', 'nope'] })).toEqual({
			communicationsOnly: true,
			kinds: ['empires'],
			layout: 'circle',
			hiddenEdges: ['embassy'],
			cluster: 'blocs',
			threshold: 100,
			ethicsDistance: 3,
			cohesionFloor: -0.3,
			details: true
		});
		expect(parseDiplomacyView({ layout: 'map', cluster: 'pacts' })).toMatchObject({
			layout: 'map',
			cluster: 'pacts'
		});
	});
});

describe('clusters', () => {
	const node = (id: number, n: Partial<DiploNode> = {}): DiploNode => ({
		id,
		name: `E${id}`,
		type: 'default',
		kind: 'empires',
		color: null,
		us: false,
		nomadic: false,
		communications: true,
		intel: 50,
		government: null,
		capital: null,
		federation: null,
		origin: null,
		overlord: null,
		unmet: 0,
		...n
	});
	const known = <T>(value: T) => ({ value, asOf: '2210.01.01', stale: false });
	const LIMITS = { threshold: 100, ethicsDistance: 3, cohesionFloor: -0.3 };

	it('merges the groups that like each other most, ignoring what is unknown', () => {
		const like: Record<string, number> = { '1:2': 300, '2:3': 150, '1:3': 120, '3:4': -50 };
		const aff = (a: number, b: number) => like[`${Math.min(a, b)}:${Math.max(a, b)}`] ?? null;
		expect(agglomerate([1, 2, 3, 4], aff, 100)).toEqual([[4], [3, 1, 2]]);
		expect(agglomerate([1, 2, 3, 4], aff, 200)).toEqual([[3], [4], [1, 2]]);
	});

	it('groups by blocs, opinion and pacts', () => {
		const nodes = [
			node(1, { federation: known('Alliance') }),
			node(2, { federation: known('Alliance') }),
			node(3, { overlord: 1 }),
			node(4)
		];
		const ids = (cs: { ids: number[] }[]) => cs.map((c) => [...c.ids].sort());
		const blocs = clusters({ opinions: {} }, nodes, [], 'blocs', LIMITS);
		expect(ids(blocs)).toEqual([[1, 2, 3], [4]]);
		expect(blocs[0].label).toBe('Alliance');

		const opinions = { '1:4': known(200), '4:1': known(100), '2:3': known(-100) };
		expect(ids(clusters({ opinions }, nodes, [], 'opinion', LIMITS))).toEqual([[1, 4], [2], [3]]);

		const edges = [
			{ kind: 'defensive_pact', from: 2, to: 3, asOf: '', stale: false },
			{ kind: 'war', from: 1, to: 2, asOf: '', stale: false }
		];
		expect(ids(clusters({ opinions: {} }, nodes, edges, 'pacts', LIMITS))[0]).toEqual([2, 3]);
	});

	it('groups by ethics and by federation fit, unknown ethics alone', () => {
		const axes = {
			ethic_authoritarian: { axis: 'col', pos: -1 },
			ethic_egalitarian: { axis: 'col', pos: 1 },
			ethic_xenophile: { axis: 'xen', pos: 1 },
			ethic_xenophobe: { axis: 'xen', pos: -1 },
			ethic_pacifist: { axis: 'mil', pos: 1 },
			ethic_militarist: { axis: 'mil', pos: -1 },
			ethic_materialist: { axis: 'spi', pos: 1 },
			ethic_gestalt_consciousness: { axis: 'hive', pos: 0 }
		};
		const defines = {
			FEDERATION_BASE_ETHICS: 3,
			FEDERATION_ETHICS_PENALTY: -0.15,
			FEDERATION_OPPOSING_ETHICS_PENALTY: -0.5
		};
		const gov = (...ethics: string[]) =>
			known({ ethics, authority: null, governmentType: null, civics: [] });
		const nodes = [
			node(1, { government: gov('ethic_egalitarian', 'ethic_xenophile', 'ethic_pacifist') }),
			node(2, { government: gov('ethic_egalitarian', 'ethic_xenophile', 'ethic_materialist') }),
			node(3, { government: gov('ethic_authoritarian', 'ethic_xenophobe', 'ethic_militarist') }),
			node(4, { government: gov('ethic_gestalt_consciousness') }),
			node(5)
		];
		const ids = (cs: { ids: number[] }[]) => cs.map((c) => [...c.ids].sort());
		const data = { axes, defines };
		// 1 and 2: 2 steps apart, 4 unique ethics — together in both; 3 opposes them on every axis
		const byEthics = clusters({ opinions: {} }, nodes, [], 'ethics', LIMITS, data);
		expect(ids(byEthics)).toEqual([[1, 2], [3], [4], [5]]);
		expect(byEthics[0]).toMatchObject({
			shared: ['ethic_egalitarian', 'ethic_xenophile'],
			penalty: -0.15
		});
		// the federation rule has no gestalt gap: the gestalt costs 3 only one ethic more
		expect(ids(clusters({ opinions: {} }, nodes, [], 'federation', LIMITS, data))).toEqual([
			[1, 2],
			[3, 4],
			[5]
		]);
		// a floor of 0 allows no ethic beyond three
		expect(
			ids(
				clusters({ opinions: {} }, nodes, [], 'federation', { ...LIMITS, cohesionFloor: 0 }, data)
			)
		).toEqual([[1], [2], [3], [4], [5]]);
	});
});

describe('ethicsHistory', () => {
	const snap = (date: string, intel: number, ethics: string[]): DiploSnap => ({
		date,
		countryId: 0,
		intel: [{ countryId: 1, intel }],
		diplomacy: [],
		allWars: [],
		relations: [],
		countries: [
			{
				id: 1,
				name: 'C1',
				type: 'default',
				shipset: null,
				flagColor: null,
				ethics,
				authority: null,
				civics: [],
				governmentType: null,
				origin: null
			}
		]
	});

	it('dates a change between the readings our intel saw', () => {
		const h = ethicsHistory(
			[
				snap('2210.01.01', 10, ['ethic_spiritualist', 'ethic_xenophile']),
				snap('2211.01.01', 5, ['ethic_materialist', 'ethic_xenophile']), // not seen
				snap('2212.01.01', 10, ['ethic_xenophile', 'ethic_materialist']),
				snap('2213.01.01', 10, ['ethic_materialist', 'ethic_xenophile'])
			],
			false
		);
		expect(h[1]).toEqual([
			{
				from: ['ethic_spiritualist', 'ethic_xenophile'],
				to: ['ethic_xenophile', 'ethic_materialist'],
				after: '2210.01.01',
				by: '2212.01.01'
			}
		]);
	});

	it('sees every save with the cheat', () => {
		const h = ethicsHistory(
			[snap('2210.01.01', 0, ['ethic_spiritualist']), snap('2211.01.01', 0, ['ethic_materialist'])],
			true
		);
		expect(h[1]).toMatchObject([{ after: '2210.01.01', by: '2211.01.01' }]);
	});
});

describe('what we know of an empire', () => {
	const node = (id: number, n: Partial<DiploNode> = {}): DiploNode => ({
		id,
		name: `E${id}`,
		type: 'default',
		kind: 'empires',
		color: null,
		us: false,
		nomadic: false,
		communications: true,
		intel: 25,
		government: null,
		capital: null,
		federation: null,
		origin: null,
		overlord: null,
		unmet: 0,
		...n
	});
	const known = <T>(value: T, stale = false) => ({ value, asOf: '2210.01.01', stale });
	const names = {
		key: (k: string) => k.replace(/^[a-z]+_/, ''),
		empire: (id: number) => `E${id}`,
		system: (id: number) => (id === 7 ? 'Sol' : undefined)
	};

	it('lists what intel shows, and from which intel the rest would', () => {
		const n = node(1, {
			government: known(
				{
					ethics: ['ethic_xenophile'],
					authority: 'auth_democratic',
					governmentType: 'gov_republic',
					civics: ['civic_idealistic_foundation']
				},
				true
			),
			capital: known(7)
		});
		const d = { nodes: [node(0, { us: true, intel: null }), n], opinions: { '1:0': known(-20) } };
		const f = Object.fromEntries(empireFacts(n, d, names).map((x) => [x.label, x]));
		expect(f.Intel.value).toBe('25 (government 1, diplomacy 1)');
		expect(f.Government).toMatchObject({ value: 'republic, democratic', asOf: '2210.01.01' });
		expect(f.Origin.value).toBe('unknown — from intel 40');
		expect(f.Capital.value).toBe('Sol');
		expect(f['Opinion of us'].value).toBe('-20');
		expect(factsText('E1', empireFacts(n, d, names))).toContain(
			'Ethics: xenophile (unverified since 2210.01.01)'
		);
	});

	it('lights the empires a legend item stands for', () => {
		const nodes = [
			node(1, {
				government: known({
					ethics: ['ethic_pacifist'],
					authority: null,
					governmentType: null,
					civics: []
				})
			}),
			node(2),
			node(3),
			node(4)
		];
		const edges = [
			{ kind: 'defensive_pact', from: 2, to: 3, asOf: '', stale: false },
			{ kind: 'embassy', from: 3, to: 4, asOf: '', stale: true }
		];
		expect(legendMatch([], nodes, edges)).toBeNull();
		const m = legendMatch(['edge:defensive_pact', 'ethic:ethic_pacifist'], nodes, edges)!;
		expect([...m.nodes].sort()).toEqual([1, 2, 3]);
		expect([...m.edges]).toEqual(['defensive_pact:2:3']);
		expect([...legendMatch(['stale'], nodes, edges)!.nodes].sort()).toEqual([3, 4]);
	});

	it('lights an ethic with its fanatic variant, and by authority, civic and origin', () => {
		const axes = {
			ethic_pacifist: { axis: 'mil', pos: 1 },
			ethic_fanatic_pacifist: { axis: 'mil', pos: 2 },
			ethic_militarist: { axis: 'mil', pos: -1 }
		};
		const gov = (ethics: string[], authority: string, civics: string[]) =>
			known({ ethics, authority, governmentType: null, civics });
		const nodes = [
			node(1, { government: gov(['ethic_pacifist'], 'auth_democratic', ['civic_a']) }),
			node(2, { government: gov(['ethic_fanatic_pacifist'], 'auth_imperial', []) }),
			node(3, {
				government: gov(['ethic_militarist'], 'auth_democratic', ['civic_b']),
				origin: known('origin_x')
			})
		];
		const lit = (k: LegendKey) => [...legendMatch([k], nodes, [], axes)!.nodes].sort();
		expect(lit('ethics:ethic_pacifist')).toEqual([1, 2]);
		expect(lit('ethic:ethic_fanatic_pacifist')).toEqual([2]);
		expect(lit('authority:auth_democratic')).toEqual([1, 3]);
		expect(lit('civic:civic_b')).toEqual([3]);
		expect(lit('origin:origin_x')).toEqual([3]);
	});
});
