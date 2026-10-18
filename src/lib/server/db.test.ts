import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Snapshot } from '#lib/types.ts';
import { getSetting, headId, history, nodes, openDb, record, setParent, setSetting } from './db.ts';

const snap = (date: string, fingerprint: string, energy = 0): Snapshot => ({
	kind: 'save',
	campaign: 'c',
	date,
	fingerprint,
	countryId: 0,
	empireName: 'E',
	pops: 0,
	stockpile: { energy },
	income: {},
	expenses: {},
	balance: {},
	colonies: [],
	endGameYear: null,
	empireSize: null,
	starbases: null,
	navalUsed: null,
	envoys: null,
	marketOrders: [],
	countryModifiers: null,
	market: null,
	leaders: null,
	ships: null,
	defaultAutomation: null,
	automationBlocked: null,
	planetBudget: null,
	score: null,
	fleets: null,
	idleLeaders: null,
	traditions: null,
	ascensionPerks: null,
	canDetox: null,
	civilianShips: null,
	edicts: null,
	species: null,
	sectors: null,
	expansion: null,
	stations: null,
	migration: null,
	knownSystems: null,
	megaShipyards: null,
	progress: null,
	leaderRoster: null,
	ruler: null,
	agendasDone: null,
	policies: null,
	government: null,
	governmentType: null,
	origin: null,
	wars: null,
	warLostDate: null,
	tradeDeals: null
});

describe('db', () => {
	it('records a linear game, then a reload as a branch with its own history', () => {
		const db = openDb(':memory:');
		const a = record(db, snap('2200.01.01', 'a', 1), 't').nodeId;
		const b = record(db, snap('2201.01.01', 'b', 2), 't').nodeId;
		record(db, snap('2202.01.01', 'c', 3), 't');
		// reload of the 2201 save, played on differently
		const d = record(db, snap('2201.06.01', 'd', 9), 't').nodeId;

		expect(headId(db)).toBe(d);
		expect(nodes(db).find((n) => n.id === d)).toMatchObject({ parentId: b, ambiguous: true });
		expect(history(db, d).map((s) => s.stockpile.energy)).toEqual([1, 2, 9]);
		expect(a).toBe(1);
	});

	it('does not duplicate a state seen twice, but moves the head to it', () => {
		const db = openDb(':memory:');
		const a = record(db, snap('2200.01.01', 'a'), 't').nodeId;
		record(db, snap('2201.01.01', 'b'), 't');
		expect(record(db, snap('2200.01.01', 'a'), 't')).toEqual({
			nodeId: a,
			isNew: false,
			mismatches: []
		});
		expect(nodes(db)).toHaveLength(2);
		expect(headId(db)).toBe(a);
	});

	it('lets a guessed parent be corrected, but not into a cycle', () => {
		const db = openDb(':memory:');
		const a = record(db, snap('2200.01.01', 'a'), 't').nodeId;
		const b = record(db, snap('2201.01.01', 'b'), 't').nodeId;
		const c = record(db, snap('2200.06.01', 'c'), 't').nodeId; // guessed parent: a
		setParent(db, c, b);
		expect(nodes(db).find((n) => n.id === c)).toMatchObject({ parentId: b, ambiguous: false });
		expect(() => setParent(db, a, c)).toThrow(/cycle/);
	});
});

describe('merging the mod feed with saves', () => {
	const logSnap = (date: string, energy: number, net: number): Snapshot => ({
		...snap(date, `log-${date}-${energy}`, energy),
		kind: 'log',
		pops: null,
		income: null,
		expenses: null,
		balance: { energy: net }
	});
	const saveSnap = (date: string, energy: number, net: number): Snapshot => ({
		...snap(date, `save-${date}`, energy),
		pops: 42,
		balance: { energy: net }
	});

	it('keeps monthly log nodes between saves and folds a same-date save into its log node', () => {
		const db = openDb(':memory:');
		record(db, saveSnap('2200.01.01', 1, 5), 'a.sav');
		record(db, logSnap('2200.02.01', 2, 5), 'game.log');
		const merged = record(db, saveSnap('2200.02.01', 2, 5), 'b.sav');

		expect(merged).toMatchObject({ isNew: false, mismatches: [] });
		expect(nodes(db)).toHaveLength(2);
		expect(nodes(db)[1]).toMatchObject({ kind: 'save', ambiguous: false });
		expect(history(db, merged.nodeId).map((s) => s.pops)).toEqual([42, 42]); // the save won
	});

	it('folds a log line arriving after its autosave, and reports a disagreeing net income', () => {
		const db = openDb(':memory:');
		const saved = record(db, saveSnap('2200.01.01', 1, 5), 'a.sav').nodeId;
		const merged = record(db, logSnap('2200.01.01', 1, 7), 'game.log');
		expect(merged.nodeId).toBe(saved);
		expect(merged.mismatches).toEqual(['energy: mod 7 vs save 5']);
		expect(history(db, saved)[0].pops).toBe(42);
	});
});

describe('schema', () => {
	it('rebuilds a cache written by an older schema instead of failing on it', () => {
		const file = join(mkdtempSync(join(tmpdir(), 'db-')), 'd.sqlite');
		const old = new DatabaseSync(file);
		old.exec(`CREATE TABLE node (id INTEGER PRIMARY KEY, campaign TEXT);
			CREATE TABLE state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
			INSERT INTO node (campaign) VALUES ('stale');`);
		old.close();

		const db = openDb(file);
		expect(nodes(db)).toEqual([]);
		record(db, snap('2200.01.01', 'a'), 't');
		db.close();
		expect(nodes(openDb(file))).toHaveLength(1); // and a current one survives reopening
	});
});

describe('settings', () => {
	it('survives a schema change that drops the history', () => {
		const file = join(mkdtempSync(join(tmpdir(), 'db-')), 'd.sqlite');
		const db = openDb(file);
		expect(getSetting(db, 'theme')).toBeUndefined();
		setSetting(db, 'theme', 'dark');
		db.prepare("UPDATE state SET value = 'old' WHERE key = 'schema'").run();
		db.close();
		expect(getSetting(openDb(file), 'theme')).toBe('dark');
	});
});

describe('history', () => {
	it('keeps a snapshot an older dashboard stored and reads it in the current shape', () => {
		const db = openDb(':memory:');
		const { nodeId } = record(db, snap('2200.02.01', 'a'), 't');
		// as stored before jobs, market orders etc. existed — its save file long deleted
		const old = {
			kind: 'save',
			campaign: 'c',
			date: '2200.02.01',
			fingerprint: 'a',
			colonies: [{ planetId: 3, name: 'Earth' }]
		};
		db.prepare('UPDATE snapshot SET json = ? WHERE node_id = ?').run(JSON.stringify(old), nodeId);
		const [s] = history(db, nodeId);
		expect(s.marketOrders).toEqual([]);
		expect(s.colonies[0]).toMatchObject({ name: 'Earth', jobs: [], happiness: null });
	});

	it('refreshes the snapshot when a save is read again', () => {
		const db = openDb(':memory:');
		const { nodeId } = record(db, snap('2200.02.01', 'a', 1), 't');
		record(db, snap('2200.02.01', 'a', 7), 't');
		expect(history(db, nodeId)[0].stockpile.energy).toBe(7);
	});
});
