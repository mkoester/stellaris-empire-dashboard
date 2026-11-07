import { describe, expect, it } from 'vitest';
import {
	closeFriends,
	highwayMarks,
	highwaySystem,
	highwayView,
	nextStep,
	readHighway,
	techState,
	unclaimable
} from './highway.ts';

// Shaped after run 43's save (2217.06.01): flags, variables, megastructure types as the mod writes them.
const flags = (...f: string[]) => Object.fromEntries(f.map((x) => [x, 62808000]));
const systems = {
	10: { flags: flags('ahw_ring', 'ahw_unclaimable', 'ahw_xst_a_1'), variables: { ahw_reach: 7 } },
	11: {
		flags: flags('ahw_ring', 'ahw_unclaimable', 'ahw_exit_1', 'ahw_exit_2', 'ahw_xst_b_1'),
		variables: { ahw_reach: 7 }
	},
	20: {
		flags: flags('ahw_portal', 'ahw_unclaimable', 'ahw_entry_1', 'ahw_studied'),
		hyperlane: [{ to: 30, length: 15 }]
	},
	21: {
		flags: flags('ahw_portal', 'ahw_unclaimable', 'ahw_entry_2', 'ahw_broken'),
		hyperlane: [{ to: 31, length: 15 }]
	},
	30: { owner: 0 },
	31: { owner: 5 },
	40: { flags: flags('suppress_archaeological_sites') }
};
const countryBlocks = {
	0: {
		name: { key: 'UNE' },
		flags: flags('ahw_highway_studied', 'ahw_grant_head_start'),
		variables: { ahw_got_theory: 0.65, ahw_got_construction: 0.65 },
		tech_status: {
			technology: ['tech_lasers_1', 'ahw_tech_gate_theory'],
			stored_techpoints_for_tech: { ahw_tech_gate_construction: 500 }
		},
		visited_objects: [10, 20, 30, 40]
	},
	5: {
		type: 'default',
		name: { key: 'Lavan Order' },
		flags: flags('ahw_highway_studied'),
		variables: { ahw_got_theory: 0.15, ahw_got_construction: 0.15 },
		tech_status: { physics_queue: [{ technology: 'ahw_tech_gate_theory', progress: 120 }] },
		visited_objects: [21, 31]
	},
	7: { type: 'default', name: { key: 'Nobody' }, visited_objects: [40] },
	8: { type: 'fallen_empire', name: { key: 'Fallen' }, visited_objects: [10, 11, 20, 21] },
	9: 'none'
};
const read = (
	globalFlags: string[] = ['ahw_sealed_2', 'ahw_express_awake', 'ahw_express_open_1']
) =>
	readHighway({
		systems,
		megastructures: {
			1: { type: 'ahw_gate_1', coordinate: { origin: 20 } },
			2: { type: 'ahw_gate_broken_2', coordinate: { origin: 21 } },
			3: { type: 'ahw_exitgate_1', coordinate: { origin: 11 } }
		},
		globalFlags,
		countryId: 0,
		countryBlocks,
		stationOwner: (s) => s?.owner ?? null,
		nameOf: (c) => c?.name?.key ?? '?',
		playerPortals: []
	})!;

describe('highwaySystem', () => {
	it('tells ring nodes, their reach, exits and stations from portals and regular systems', () => {
		expect(highwaySystem(Object.keys(systems[11].flags), systems[11].variables)).toEqual({
			kind: 'ring',
			reach: 7,
			exits: [1, 2],
			station: [1]
		});
		expect(highwaySystem(Object.keys(systems[21].flags))).toEqual({ kind: 'portal', pair: 2 });
		expect(highwaySystem(Object.keys(systems[40].flags))).toBeNull();
		expect(unclaimable(Object.keys(systems[20].flags))).toBe(true);
		expect(unclaimable(Object.keys(systems[40].flags))).toBe(false);
	});
});

describe('readHighway', () => {
	it('is null without a ring', () => {
		expect(
			readHighway({
				systems: { 40: systems[40] },
				megastructures: {},
				globalFlags: [],
				countryId: 0,
				countryBlocks: {},
				stationOwner: () => null,
				nameOf: () => '',
				playerPortals: []
			})
		).toBeNull();
	});
	it('reads portals: anchor, owner, gate stage, seal, exit node, ours', () => {
		const h = read();
		expect(h.nodes).toBe(2);
		expect(h.portals).toEqual([
			{
				systemId: 20,
				pair: 1,
				anchorId: 30,
				anchorOwnerId: 0,
				stage: 'repaired',
				sealed: false,
				exitId: 11,
				ours: true
			},
			{
				systemId: 21,
				pair: 2,
				anchorId: 31,
				anchorOwnerId: 5,
				stage: 'broken',
				sealed: true,
				exitId: 11,
				ours: false
			}
		]);
	});
	it('reads the express links: dormant before the mid game, then open or closed, stable for good', () => {
		expect(read().express).toEqual([{ link: 1, a: 10, b: 11, state: 'open' }]);
		expect(read([]).express[0].state).toBe('dormant');
		expect(read(['ahw_express_awake']).express[0].state).toBe('closed');
		expect(read(['ahw_express_stable_1']).express[0].state).toBe('stable');
	});
	it('reads what each country knows and how far its techs are; others only once on the highway', () => {
		const h = read();
		expect(h.us).toEqual({
			id: 0,
			name: 'UNE',
			studied: true,
			headStart: true,
			granted: { theory: 0.65, construction: 0.65 },
			techs: { theory: 'researched', construction: 500 },
			known: [10, 20]
		});
		expect(h.others.map((o) => [o.name, o.techs.theory, o.known])).toEqual([
			['Lavan Order', 120, [21]]
		]);
	});
});

describe('techState', () => {
	it('researched, in a queue with its progress, kept, or none', () => {
		expect(techState(countryBlocks[0], 'ahw_tech_gate_theory')).toBe('researched');
		expect(techState(countryBlocks[0], 'ahw_tech_gate_construction')).toBe(500);
		expect(techState(countryBlocks[5], 'ahw_tech_gate_theory')).toBe(120);
		expect(techState(countryBlocks[7], 'ahw_tech_gate_theory')).toBeNull();
	});
});

describe('highwayView', () => {
	const h = read();
	it('shows by default only what we know: our portal and what we visited', () => {
		const v = highwayView(h, { friends: new Set([5]), spoiler: false, cheat: false });
		expect(v.portals.map((p) => [p.systemId, p.why])).toEqual([[20, 'ours']]);
		expect(v.express.map((e) => [e.link, e.why])).toEqual([[1, 'ours']]);
		expect(v.others).toEqual([]);
		expect(v.known.sort()).toEqual([10, 11, 20]); // our exit node: the study reveals it
	});
	it('the spoiler adds what our friends know, the cheat everything', () => {
		const friend = highwayView(h, { friends: new Set([5]), spoiler: true, cheat: false });
		expect(friend.portals.map((p) => [p.systemId, p.why])).toEqual([
			[20, 'ours'],
			[21, 'friend']
		]);
		expect(friend.others.map((o) => [o.id, o.why])).toEqual([[5, 'friend']]);
		expect(highwayView(h, { friends: new Set(), spoiler: true, cheat: false }).others).toEqual([]);
		const all = highwayView(h, { friends: new Set(), spoiler: false, cheat: true });
		expect(all.portals.map((p) => p.why)).toEqual(['ours', 'cheat']);
		expect(all.others.map((o) => [o.id, o.why, o.friend])).toEqual([[5, 'cheat', false]]);
	});
});

describe('highwayMarks', () => {
	it('draws gate pairs and express links, usable ones solid', () => {
		const v = highwayView(read(), { friends: new Set(), spoiler: false, cheat: true });
		const m = highwayMarks(v, new Map([[20, 'Furon 51']]));
		expect(m.lines.map((l) => [l.kind, l.from, l.to, l.open])).toEqual([
			['gate', 20, 11, true],
			['gate', 21, 11, false],
			['express', 10, 11, true]
		]);
		expect(m.marks.find((x) => x.systemId === 20)?.title).toBe(
			'Portal Furon 51: gate repaired (ours)'
		);
		expect(m.marks.filter((x) => x.symbol === '⇶').map((x) => x.systemId)).toEqual([10, 11]);
	});
});

describe('closeFriends', () => {
	const c = (id: number, extra: object = {}) => ({
		id,
		overlord: null,
		federation: null,
		relations: [],
		...extra
	});
	it('federation, subjects either way, fellow subjects, defensive pacts, guarantees, war allies', () => {
		const friends = closeFriends(0, {
			diplomacy: [
				c(0, {
					federation: 'F',
					overlord: 9,
					relations: [
						{ countryId: 3, agreements: ['defensive_pact'] },
						{ countryId: 8, agreements: ['non_aggression_pledge', 'migration_access'] }
					]
				}),
				c(1, { federation: 'F' }),
				c(2, { overlord: 0 }),
				c(3),
				c(4, { relations: [{ countryId: 0, agreements: ['guarantee'] }] }),
				c(5, { overlord: 9 }),
				c(8),
				c(9),
				c(11)
			],
			wars: [{ attackers: [0, 11], defenders: [12] }]
		});
		expect([...friends].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 9, 11]);
	});
});

describe('nextStep', () => {
	const h = read();
	it('names what our gate needs next', () => {
		expect(nextStep(undefined, h.us)).toBe('no portal of ours found');
		expect(nextStep(h.portals[0], h.us)).toBe('repaired and open: usable, can be sealed');
		expect(nextStep({ ...h.portals[1], anchorOwnerId: 3 }, { ...h.us, id: 0 })).toMatch(
			/claim the anchor/
		);
		expect(
			nextStep({ ...h.portals[1], anchorOwnerId: 0, stage: 'broken' }, { ...h.us, studied: false })
		).toMatch(/study/);
		expect(nextStep({ ...h.portals[1], anchorOwnerId: 0, stage: 'studied' }, h.us)).toMatch(
			/research Highway Gate Theory and Construction/
		);
	});
});
