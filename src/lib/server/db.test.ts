import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Snapshot } from '#lib/types.ts';
import { askGone, goneToAsk, keepCampaign } from './campaigns.ts';
import {
	campaignName,
	deleteCampaign,
	galaxyOf,
	getSetting,
	headCampaign,
	headId,
	history,
	lastNode,
	loadedNode,
	nodes,
	openDb,
	readFiles,
	record,
	refresh,
	setParent,
	setSetting,
	VERSION
} from './db.ts';

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
	budget: null,
	construction: null,
	orbitalStations: null,
	techQueued: null,
	techPermanent: null,
	score: null,
	fleets: null,
	idleLeaders: null,
	traditions: null,
	ascensionPerks: null,
	canDetox: null,
	habitatSites: null,
	habitats: null,
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
	subjects: null,
	galcom: null,
	claims: null,
	factions: null,
	combats: null,
	shroud: null,
	warLostDate: null,
	tradeDeals: null,
	gameVersion: null,
	dlcs: null,
	mods: null,
	countryType: null,
	policyFlags: null,
	countryFlags: null,
	council: null,
	councilSlots: null,
	edictTimes: null,
	galaxy: null,
	countries: null,
	relations: null,
	firstContacts: null,
	situations: null,
	anomalies: null,
	specialProjects: null,
	digSites: null,
	stationsSeen: null,
	surveyedAll: null,
	focus: null,
	techOptions: null,
	leaderList: null,
	speciesRights: null,
	timelineId: null,
	previousTimelineId: null,
	logEvents: null,
	ticks: null
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

	it("names each campaign after the empire in its latest save, not a game.log node's blank", () => {
		const db = openDb(':memory:');
		record(db, { ...snap('2200.01.01', 'a'), empireName: 'Old name' }, 't');
		record(db, { ...snap('2201.01.01', 'b'), empireName: 'New name' }, 't');
		record(db, { ...snap('2201.02.01', 'l'), kind: 'log', empireName: '' }, 'game.log');
		record(db, { ...snap('2200.01.01', 'x'), campaign: 'other', empireName: 'Other' }, 't');
		expect(campaignName(db, 'c')).toBe('New name');
		expect(campaignName(db, 'other')).toBe('Other');
		expect(campaignName(db, 'unknown')).toBe('');
	});
});

describe('galaxy', () => {
	const sys = (name: string) => ({
		id: 1,
		name,
		x: 0,
		y: 0,
		star: 'sc_g',
		lanes: [],
		visited: true,
		owned: true,
		ownerId: 0,
		bodies: [],
		megastructures: []
	});
	it("keeps the campaign's latest galaxy apart, not in each snapshot", () => {
		const db = openDb(':memory:');
		const a = record(db, { ...snap('2201.01.01', 'a'), galaxy: [sys('new')] }, 't').nodeId;
		// a reload of an older save: its galaxy is not the latest
		record(db, { ...snap('2200.06.01', 'b'), galaxy: [sys('old')] }, 't');
		expect(galaxyOf(db, 'c')).toEqual({
			date: '2201.01.01',
			systems: [sys('new')],
			surveyedAll: null
		});
		expect(history(db, a)[0].galaxy).toBeNull();
		expect(galaxyOf(db, 'other')).toBeNull();
	});

	it('keeps the lists as if surveyed with the galaxy, and reads rows from before them', () => {
		const db = openDb(':memory:');
		const surveyedAll = { expansion: [], habitatSites: [] };
		const a = record(db, { ...snap('2201.01.01', 'a'), galaxy: [sys('x')], surveyedAll }, 't');
		expect(galaxyOf(db, 'c')?.surveyedAll).toEqual(surveyedAll);
		expect(history(db, a.nodeId)[0].surveyedAll).toBeNull();
		// a row written before 2026-10-18: the systems alone
		db.prepare("UPDATE galaxy SET json = ? WHERE campaign = 'c'").run(JSON.stringify([sys('y')]));
		expect(galaxyOf(db, 'c')).toEqual({
			date: '2201.01.01',
			systems: [sys('y')],
			surveyedAll: null
		});
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

	it("keeps the log's events, daily stockpiles and timeline id through the merge and a re-read", () => {
		const db = openDb(':memory:');
		const events = [{ date: '2200.01.20', kind: 'colony' as const, fields: ['Mars'] }];
		const ticks = [{ date: '2200.01.30', stockpile: { energy: 3 } }];
		const log = { ...logSnap('2200.02.01', 2, 5), timelineId: 123456, logEvents: events, ticks };
		const id = record(db, log, 'game.log').nodeId;
		record(db, saveSnap('2200.02.01', 2, 5), 'b.sav');
		refresh(db, saveSnap('2200.02.01', 2, 5));
		expect(history(db, id)[0]).toMatchObject({
			pops: 42,
			timelineId: 123456,
			logEvents: events,
			ticks
		});
	});
});

describe('loading a save', () => {
	const at = (date: string, fingerprint: string, timelineId: number | null) => ({
		...snap(date, fingerprint),
		timelineId
	});

	it('finds the loaded save by its timeline id, and places what follows below it, not guessed', () => {
		const db = openDb(':memory:');
		const jan = record(db, at('2200.01.01', 'a', 111111), 't').nodeId;
		const mid = record(db, at('2200.01.15', 'b', 111111), 't').nodeId; // a manual save that month
		record(db, at('2200.02.01', 'c', 222222), 't');
		record(db, at('2200.03.01', 'd', 333333), 't');

		expect(loadedNode(db, 'c', '2200.01.15', 111111)).toBe(mid);
		expect(loadedNode(db, 'c', '2200.01.10', 111111)).toBe(jan); // a save the dashboard never read
		expect(loadedNode(db, 'c', '2200.01.15', 999999)).toBeNull();
		expect(loadedNode(db, 'other', '2200.01.15', 111111)).toBeNull();

		const next = record(db, at('2200.02.01', 'e', 444444), 't', jan).nodeId;
		expect(nodes(db).find((n) => n.id === next)).toMatchObject({ parentId: jan, ambiguous: false });
	});
});

describe('migrations', () => {
	const tmpDb = () => join(mkdtempSync(join(tmpdir(), 'db-')), 'dashboard.sqlite');
	const version = (db: DatabaseSync) =>
		(db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
	const addColumn = (db: DatabaseSync) => db.exec('ALTER TABLE node ADD COLUMN note TEXT');

	it('builds a new DB at the current version', () => {
		const db = openDb(':memory:');
		expect(version(db)).toBe(VERSION);
		record(db, snap('2200.01.01', 'a'), 't');
		expect(nodes(db)).toHaveLength(1);
	});

	it("takes over 0.1.0's DB, history and settings kept, without a copy", () => {
		const file = tmpDb();
		// 0.1.0's tables are the base; it marked them in `state`, not in `user_version`
		const base = openDb(file);
		record(base, snap('2200.01.01', 'a'), 't');
		setSetting(base, 'theme', 'dark');
		base.exec("INSERT INTO state VALUES ('schema', '15'); PRAGMA user_version = 0;");
		base.close();

		const db = openDb(file);
		expect(version(db)).toBe(15);
		expect(nodes(db)).toHaveLength(1);
		expect(getSetting(db, 'theme')).toBe('dark');
		expect(db.prepare("SELECT 1 FROM state WHERE key = 'schema'").get()).toBeUndefined();
		expect(existsSync(file.replace('.sqlite', '.v15.sqlite'))).toBe(false);
	});

	it('gives a version-15 DB of a build before 0.1.0 the tables it lacks', () => {
		const file = tmpDb();
		const base = openDb(file);
		record(base, snap('2200.01.01', 'a'), 't');
		base.exec(
			"DROP TABLE save_file; INSERT INTO state VALUES ('schema', '15'); PRAGMA user_version = 0;"
		);
		base.close();

		const db = openDb(file);
		expect(nodes(db)).toHaveLength(1);
		expect(readFiles(db)).toEqual(new Map());
	});

	it('runs the steps a DB lacks, after a copy of it', () => {
		const file = tmpDb();
		const db = openDb(file);
		record(db, snap('2200.01.01', 'a'), 't');
		db.close();

		const migrated = openDb(file, [addColumn]);
		expect(version(migrated)).toBe(16);
		migrated.prepare("UPDATE node SET note = 'x'").run();
		expect(nodes(migrated)).toHaveLength(1);
		migrated.close();
		expect(nodes(openDb(file.replace('.sqlite', '.v15.sqlite')))).toHaveLength(1);
		expect(version(openDb(file, [addColumn]))).toBe(16); // and not again
	});

	it('builds a new DB through every step', () => {
		const db = openDb(':memory:', [addColumn]);
		expect(version(db)).toBe(16);
		db.prepare("UPDATE node SET note = 'x'").run();
	});

	it('rolls a failing step back and keeps the version', () => {
		const file = tmpDb();
		openDb(file).close();
		const broken = (db: DatabaseSync) => {
			addColumn(db);
			throw new Error('broken step');
		};
		expect(() => openDb(file, [broken])).toThrow('broken step');
		const db = new DatabaseSync(file);
		expect(version(db)).toBe(15);
		expect(() => db.prepare('SELECT note FROM node').all()).toThrow();
	});

	it('refuses a DB of a newer dashboard and leaves it as it is', () => {
		const file = tmpDb();
		const newer = openDb(file, [addColumn]);
		record(newer, snap('2200.01.01', 'a'), 't');
		newer.close();
		expect(() => openDb(file)).toThrow(/newer dashboard/);
		expect(nodes(openDb(file, [addColumn]))).toHaveLength(1);
	});

	it('refuses a development DB from before 0.1.0 instead of dropping it', () => {
		const file = tmpDb();
		const old = new DatabaseSync(file);
		old.exec(`CREATE TABLE state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
			INSERT INTO state VALUES ('schema', '14');`);
		old.close();
		expect(() => openDb(file)).toThrow(/before 0.1.0/);
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

describe('refresh', () => {
	it('replaces a stored reading without moving the head', () => {
		const db = openDb(':memory:');
		const first = record(db, snap('2200.01.01', 'a', 1), 's').nodeId;
		const head = record(db, snap('2201.01.01', 'b', 2), 's').nodeId;
		expect(refresh(db, snap('2200.01.01', 'a', 5))?.nodeId).toBe(first);
		expect(headId(db)).toBe(head);
		expect(history(db, head).map((s) => s.stockpile.energy)).toEqual([5, 2]);
	});

	it('leaves out a save not in the graph (its campaign deleted), and the head with it', () => {
		const db = openDb(':memory:');
		const head = record(db, snap('2200.01.01', 'a'), 's').nodeId;
		expect(refresh(db, snap('2200.02.01', 'b'))).toBeNull();
		expect(nodes(db)).toHaveLength(1);
		expect(headId(db)).toBe(head);
	});
});

describe('catching up on another campaign', () => {
	const other = (date: string, fingerprint: string) => ({
		...snap(date, fingerprint),
		campaign: 'o'
	});

	it('places its saves after its own last node and leaves the head where the player is', () => {
		const db = openDb(':memory:');
		const head = record(db, snap('2200.01.01', 'a'), 's').nodeId;
		const o1 = record(db, other('2300.01.01', 'x'), 's', null, lastNode(db, 'o')).nodeId;
		const o2 = record(db, other('2300.02.01', 'y'), 's', null, o1).nodeId;
		expect(headId(db)).toBe(head);
		expect(nodes(db).find((n) => n.id === o1)?.parentId).toBeNull();
		expect(nodes(db).find((n) => n.id === o2)?.parentId).toBe(o1);
		expect(lastNode(db, 'o')).toBe(o2);
	});
});

describe('deleteCampaign', () => {
	it("forgets the campaign's nodes, snapshots and galaxy, and nothing else", () => {
		const db = openDb(':memory:');
		record(db, snap('2200.01.01', 'a'), 's');
		record(db, { ...snap('2300.01.01', 'x'), campaign: 'o', galaxy: [] }, 's');
		expect(headCampaign(db)).toBe('o');
		deleteCampaign(db, 'o');
		expect(nodes(db).map((n) => n.campaign)).toEqual(['c']);
		expect(galaxyOf(db, 'o')).toBeNull();
		expect(db.prepare('SELECT count(*) AS n FROM snapshot').get()).toEqual({ n: 1 });
		expect(headId(db)).toBeNull(); // the head was there
	});
});

describe('campaigns to ask about', () => {
	const row = (campaign: string, onDisk: boolean) => ({
		campaign,
		name: '',
		date: '2200.01.01',
		nodes: 1,
		onDisk
	});

	it('are those without saves on disk the player has not kept', () => {
		const rows = [row('here', true), row('gone', false), row('kept', false)];
		expect(goneToAsk(rows, ['kept']).map((r) => r.campaign)).toEqual(['gone']);
	});

	it('come from the history, named after the empire, and stop once kept', () => {
		const db = openDb(':memory:');
		record(db, snap('2200.01.01', 'a'), 's');
		record(db, { ...snap('2300.01.01', 'x'), campaign: 'o', empireName: 'Other' }, 's');
		expect(askGone(db, new Set(['c']))).toEqual([
			{ campaign: 'o', name: 'Other', date: '2300.01.01', nodes: 1, onDisk: false }
		]);
		keepCampaign(db, 'o');
		expect(askGone(db, new Set(['c']))).toEqual([]);
	});
});
