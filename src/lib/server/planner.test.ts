import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Body, GalaxySystem, GameData, Snapshot } from '#lib/types.ts';
import { upgrade } from '#lib/upgrade.ts';
import { addPlanEvents, history, openDb, record, type Db } from './db.ts';

// planner.ts reads the process-wide state (`app.ts`: the DB, the game data), so the tests set it
// before importing — as docs/testing.md does for a throwaway test over a DB copy.
const state = { updates: new EventEmitter(), status: 'running' } as Record<string, unknown>;
(globalThis as Record<string, unknown>).__stellarisDashboard = state;
const { planSummary, plannedSystems, systemGoals } = await import('./planner.ts');

// only what the goals below read: the rest of the game data stays out of it
const gameData = {
	scriptedTriggers: {},
	shipKinds: {},
	techs: {},
	techRequirements: {},
	planetClasses: { pc_continental: { colonizable: true } },
	traditionTrees: {}
} as unknown as GameData;

const body = (id: number, o: Partial<Body> = {}): Body => ({
	id,
	name: `body ${id}`,
	class: 'pc_barren',
	size: 10,
	star: false,
	moonOf: null,
	ownerId: null,
	colonized: false,
	deposits: [],
	anomaly: null,
	dist: 10 * id,
	surveyed: true,
	...o
});
const system = (id: number, o: Partial<GalaxySystem> = {}): GalaxySystem => ({
	id,
	name: `Sol ${id}`,
	x: id,
	y: 0,
	star: 'sc_g',
	lanes: [],
	visited: true,
	owned: false,
	ownerId: null,
	bodies: [],
	megastructures: [],
	...o
});

const progress: Snapshot['progress'] = {
	research: [],
	researched: [],
	agenda: null,
	traditionsTaken: 0,
	nextElection: null,
	costSettings: { technology: 1, traditions: 1 }
};

let db: Db;
/** Records a save of `camp` and returns its node. */
const play = (date: string, galaxy: GalaxySystem[], o: Partial<Snapshot> = {}) =>
	record(
		db,
		upgrade({ kind: 'save', campaign: 'camp', date, fingerprint: date, progress, galaxy, ...o }),
		't'
	).nodeId;

beforeEach(() => {
	db = openDb(':memory:');
	Object.assign(state, { db, gameData, explanations: {} });
});

describe('systemGoals', () => {
	it('offers what fits the system: a survey, an outpost, a colony', () => {
		const node = play('2200.02.01', [
			system(1, {
				bodies: [body(10, { surveyed: false }), body(11, { class: 'pc_continental' })]
			}),
			system(2, { owned: true, bodies: [body(20)] })
		]);
		const kinds = (id: number) => systemGoals(history(db, node), id).map((g) => g.kind);
		expect(kinds(1)).toEqual(expect.arrayContaining(['survey', 'outpost', 'colony']));
		// surveyed and ours: neither
		expect(kinds(2)).not.toContain('survey');
		expect(kinds(2)).not.toContain('outpost');
		expect(kinds(2)).not.toContain('colony');
	});

	it('offers nothing before the first full save', () => {
		const node = play('2200.01.01', [system(1)], { progress: null });
		expect(systemGoals(history(db, node), 1)).toEqual([]);
	});
});

describe('the plan at a node', () => {
	const survey = {
		goal: 'g1',
		op: 'add' as const,
		data: { kind: 'survey', target: { system: 1 } }
	};

	it('is empty without a node or a plan', () => {
		expect(planSummary(null).keys).toEqual([]);
		expect(planSummary(999).keys).toEqual([]);
		const node = play('2200.02.01', [system(1)]);
		expect(planSummary(node).keys).toEqual([]);
		expect(plannedSystems(history(db, node), node)).toEqual({});
	});

	it('holds the goals added on its branch, by system', () => {
		const node = play('2200.02.01', [system(1, { bodies: [body(10, { surveyed: false })] })]);
		addPlanEvents(db, 'camp', node, [survey]);
		expect(planSummary(node).keys).toHaveLength(1);
		expect(Object.keys(plannedSystems(history(db, node), node))).toEqual(['1']);
	});

	it('follows the plan as it changes (the summary is cached by plan)', () => {
		const node = play('2200.02.01', [system(1)]);
		addPlanEvents(db, 'camp', node, [survey]);
		expect(planSummary(node).keys).toHaveLength(1);
		addPlanEvents(db, 'camp', node, [{ goal: 'g1', op: 'remove', data: {} }]);
		expect(planSummary(node).keys).toEqual([]);
	});

	it('keeps a goal to the branch it was added on', () => {
		const a = play('2200.02.01', [system(1)]);
		const b = play('2200.03.01', [system(1)]);
		addPlanEvents(db, 'camp', b, [survey]);
		expect(planSummary(b).keys).toHaveLength(1);
		expect(planSummary(a).keys).toEqual([]);
	});
});
