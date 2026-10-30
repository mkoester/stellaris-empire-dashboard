import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { path, place } from '#lib/timeline.ts';
import { upgrade } from '#lib/upgrade.ts';
import type {
	GalaxySystem,
	ModInfo,
	ModVersionSeen,
	Resources,
	Snapshot,
	SourceKind,
	TimelineNode
} from '#lib/types.ts';

// The dashboard's own store: the save graph plus one snapshot per node. It is **history, not a
// cache**: the game keeps only its last few autosaves, so most snapshots can no longer be rebuilt.
// - A new snapshot field needs a default in `upgrade()` (#lib/upgrade.ts), which brings stored
//   snapshots up to date on read, and a `READER` bump (save.ts): `save_file` remembers which reader
//   read each save on disk, and a save is read again only when that changed.
// - The tables change only by a step appended to MIGRATIONS (`migrate`), never by dropping them.
//   A new DB is built the same way: the 0.1.0 tables, then every step.
// - The galaxy (`Snapshot.galaxy`: every system with its bodies) and the lists as if all were
//   surveyed (`Snapshot.surveyedAll`) are not stored per node (~1.6 MB at 2207.03.10): `galaxy`
//   keeps each campaign's latest reading, the snapshots go without them.

// The version is SQLite's `user_version`. 0.1.0 kept it as `state.schema` = '15'.
const BASE = 15;

/**
 * MIGRATIONS[i] brings the tables from version BASE + i to BASE + i + 1. Append only: a released
 * step has run on players' DBs, so it is never edited or removed.
 */
export const MIGRATIONS: ((db: Db) => void)[] = [
	// 16: each campaign numbers its own nodes (`seq`, the timeline's "#"; the user's ask
	// 2026-10-30), the existing ones in the order they were recorded. `id` stays global: links
	// (`?node=`) and the stored parents keep using it.
	(db) =>
		db.exec(`
			ALTER TABLE node ADD COLUMN seq INTEGER;
			UPDATE node SET seq = (SELECT count(*) FROM node m WHERE m.campaign = node.campaign AND m.id <= node.id);
			CREATE INDEX node_campaign_seq ON node (campaign, seq);
		`)
];

export const VERSION = BASE + MIGRATIONS.length;

export type Db = DatabaseSync;

export function openDb(file: string, steps = MIGRATIONS): Db {
	const db = new DatabaseSync(file);
	db.exec('PRAGMA journal_mode = WAL');
	migrate(db, file, steps);
	return db;
}

/**
 * The tables of 0.1.0 (version 15), where every DB starts. Builds before it added tables to
 * version 15 without a bump (a DB of 2026-10-18 lacks `save_file`), so a version-15 DB gets the
 * ones it is missing.
 */
function createBase(db: Db) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
		CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, json TEXT NOT NULL);
		CREATE TABLE IF NOT EXISTS node (
			id          INTEGER PRIMARY KEY,
			kind        TEXT NOT NULL,
			campaign    TEXT NOT NULL,
			date        TEXT NOT NULL,
			fingerprint TEXT NOT NULL,
			parent_id   INTEGER REFERENCES node(id),
			ambiguous   INTEGER NOT NULL DEFAULT 0,
			source      TEXT NOT NULL,
			observed_at TEXT NOT NULL,
			UNIQUE (campaign, fingerprint)
		);
		CREATE TABLE IF NOT EXISTS snapshot (
			node_id INTEGER PRIMARY KEY REFERENCES node(id),
			json    TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS mod_version (
			name      TEXT NOT NULL,
			version   TEXT,
			supported TEXT,
			updated   TEXT,
			seen_at   TEXT NOT NULL,
			game_date TEXT
		);
		CREATE TABLE IF NOT EXISTS galaxy (
			campaign TEXT PRIMARY KEY,
			date     TEXT NOT NULL,
			json     TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS save_file (
			path    TEXT PRIMARY KEY,
			version TEXT NOT NULL,
			reader  TEXT NOT NULL
		);
	`);
}

/** The DB's version: `user_version`, else 0.1.0's `state.schema`, else 0 for a new DB. */
function versionOf(db: Db): number {
	const v = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
	if (v) return v;
	const hasState = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'state'").get();
	if (!hasState) return 0;
	const row = db.prepare("SELECT value FROM state WHERE key = 'schema'").get() as
		{ value: string } | undefined;
	return row ? Number(row.value) : 0;
}

/**
 * Brings the tables to the current version, each step in its own transaction, after a copy of the
 * DB beside it (`dashboard.v15.sqlite`). Refuses a DB of a newer dashboard, or of a development
 * build before 0.1.0, rather than drop the history it holds.
 */
export function migrate(db: Db, file: string, steps = MIGRATIONS) {
	const latest = BASE + steps.length;
	const v = versionOf(db);
	if (v > latest)
		throw new Error(
			`${file} was written by a newer dashboard (version ${v}, this one knows up to ${latest}): start the newer one`
		);
	if (v !== 0 && v < BASE)
		throw new Error(`${file} is from a development build before 0.1.0 (version ${v})`);
	const inTransaction = (to: number, f: () => void) => {
		db.exec('BEGIN');
		try {
			f();
			db.exec(`PRAGMA user_version = ${to}`);
			db.exec('COMMIT');
		} catch (e) {
			db.exec('ROLLBACK');
			throw e;
		}
	};
	if (v <= BASE)
		inTransaction(BASE, () => {
			createBase(db);
			db.exec("DELETE FROM state WHERE key = 'schema'");
		});
	if (v !== 0 && v < latest && file !== ':memory:') {
		const copy = file.replace(/(\.sqlite)?$/, `.v${v}.sqlite`);
		if (!existsSync(copy)) db.prepare('VACUUM INTO ?').run(copy);
	}
	for (let i = Math.max(v, BASE); i < latest; i++) inTransaction(i + 1, () => steps[i - BASE](db));
}

/** A stored setting, or undefined when never set. */
export function getSetting(db: Db, key: string): unknown {
	const row = db.prepare('SELECT json FROM setting WHERE key = ?').get(key) as
		{ json: string } | undefined;
	return row ? JSON.parse(row.json) : undefined;
}

export function setSetting(db: Db, key: string, value: unknown) {
	db.prepare('INSERT OR REPLACE INTO setting (key, json) VALUES (?, ?)').run(
		key,
		JSON.stringify(value)
	);
}

type NodeRow = {
	id: number;
	kind: SourceKind;
	campaign: string;
	date: string;
	fingerprint: string;
	parent_id: number | null;
	ambiguous: number;
	seq: number | null;
};

const toNode = (r: NodeRow): TimelineNode => ({
	id: r.id,
	kind: r.kind,
	campaign: r.campaign,
	date: r.date,
	fingerprint: r.fingerprint,
	parentId: r.parent_id,
	ambiguous: r.ambiguous === 1,
	seq: r.seq ?? r.id
});

export function nodes(db: Db): TimelineNode[] {
	return (db.prepare('SELECT * FROM node ORDER BY id').all() as NodeRow[]).map(toNode);
}

export function headId(db: Db): number | null {
	const row = db.prepare("SELECT value FROM state WHERE key = 'head'").get() as
		{ value: string } | undefined;
	return row ? Number(row.value) : null;
}

/** The campaign currently being played, i.e. the head's; null before the first observation. */
export function headCampaign(db: Db): string | null {
	const id = headId(db);
	return nodes(db).find((n) => n.id === id)?.campaign ?? null;
}

/** The campaign's node observed last (where the player left it), or null for an unknown one. */
export function lastNode(db: Db, campaign: string): number | null {
	const row = db.prepare('SELECT max(id) AS id FROM node WHERE campaign = ?').get(campaign) as {
		id: number | null;
	};
	return row.id;
}

/**
 * Forgets a campaign's history: its nodes, snapshots and galaxy, and the head if it was there.
 * `save_file` keeps its rows, so saves still on disk are not read back in; the next new save of
 * the campaign starts it afresh.
 */
export function deleteCampaign(db: Db, campaign: string) {
	db.exec('BEGIN');
	try {
		if (headCampaign(db) === campaign) db.exec("DELETE FROM state WHERE key = 'head'");
		db.prepare(
			'DELETE FROM snapshot WHERE node_id IN (SELECT id FROM node WHERE campaign = ?)'
		).run(campaign);
		db.prepare('DELETE FROM node WHERE campaign = ?').run(campaign);
		db.prepare('DELETE FROM galaxy WHERE campaign = ?').run(campaign);
		db.exec('COMMIT');
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
}

/** The empire's name in the campaign's latest save ('' before one; game.log nodes carry none). */
export function campaignName(db: Db, campaign: string): string {
	const row = db
		.prepare(
			`SELECT json_extract(s.json, '$.empireName') AS name FROM node n
			JOIN snapshot s ON s.node_id = n.id
			WHERE n.campaign = ? AND n.kind = 'save' ORDER BY n.id DESC LIMIT 1`
		)
		.get(campaign) as { name: string | null } | undefined;
	return row?.name ?? '';
}

function setHeadTo(db: Db, id: number) {
	db.prepare("INSERT OR REPLACE INTO state (key, value) VALUES ('head', ?)").run(String(id));
}

function snapshotOf(db: Db, nodeId: number): Snapshot {
	const row = db.prepare('SELECT json FROM snapshot WHERE node_id = ?').get(nodeId) as {
		json: string;
	};
	return upgrade(JSON.parse(row.json));
}

export type Recorded = {
	nodeId: number;
	isNew: boolean;
	/** Resources whose mod-reported net income disagrees with the save's balance (merges only). */
	mismatches: string[];
};

/**
 * Adds an observation to the graph (or recognises it, or merges it) and makes it the head. With
 * `at`, it is placed as if `at` were the head, and the head stays: catching up on a campaign that
 * is not being played.
 */
export function record(
	db: Db,
	snap: Snapshot,
	source: string,
	loadedFrom: number | null = null,
	at?: number | null
): Recorded {
	const placement = place(nodes(db), at === undefined ? headId(db) : at, snap, loadedFrom);
	const setHead = (id: number) => at === undefined && setHeadTo(db, id);
	if (placement.kind === 'duplicate') {
		// Seen before: a save read by a newer dashboard has more fields — keep the fresh reading.
		if (snap.kind === 'save')
			db.prepare('UPDATE snapshot SET json = ? WHERE node_id = ?').run(
				stored(db, withLogFields(snap, snapshotOf(db, placement.nodeId))),
				placement.nodeId
			);
		setHead(placement.nodeId);
		return { nodeId: placement.nodeId, isNew: false, mismatches: [] };
	}
	if (placement.kind === 'merge') {
		const existing = snapshotOf(db, placement.nodeId);
		const [save, log] = snap.kind === 'save' ? [snap, existing] : [existing, snap];
		db.prepare("UPDATE node SET kind = 'save', fingerprint = ?, source = ? WHERE id = ?").run(
			save.fingerprint,
			snap.kind === 'save' ? source : sourceOf(db, placement.nodeId),
			placement.nodeId
		);
		db.prepare('UPDATE snapshot SET json = ? WHERE node_id = ?').run(
			stored(db, withLogFields(save, log)),
			placement.nodeId
		);
		setHead(placement.nodeId);
		return {
			nodeId: placement.nodeId,
			isNew: false,
			mismatches: compareBalances(log.balance, save.balance)
		};
	}

	db.exec('BEGIN');
	try {
		const { lastInsertRowid } = db
			.prepare(
				`INSERT INTO node (kind, campaign, date, fingerprint, parent_id, ambiguous, source, observed_at, seq)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?,
				   (SELECT coalesce(max(seq), 0) + 1 FROM node WHERE campaign = ?))`
			)
			.run(
				snap.kind,
				snap.campaign,
				snap.date,
				snap.fingerprint,
				placement.parentId,
				placement.ambiguous ? 1 : 0,
				source,
				new Date().toISOString(),
				snap.campaign
			);
		const nodeId = Number(lastInsertRowid);
		db.prepare('INSERT INTO snapshot (node_id, json) VALUES (?, ?)').run(nodeId, stored(db, snap));
		setHead(nodeId);
		db.exec('COMMIT');
		return { nodeId, isNew: true, mismatches: [] };
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
}

/**
 * Replaces the stored reading of a save seen before, without moving the head (a re-read by a newer
 * reader is no observation). A save not in the graph was read before and its campaign deleted
 * since (`deleteCampaign`): it stays out, null.
 */
export function refresh(db: Db, snap: Snapshot): Recorded | null {
	const row = db
		.prepare('SELECT id FROM node WHERE campaign = ? AND fingerprint = ?')
		.get(snap.campaign, snap.fingerprint) as { id: number } | undefined;
	if (!row) return null;
	db.prepare('UPDATE snapshot SET json = ? WHERE node_id = ?').run(
		stored(db, withLogFields(snap, snapshotOf(db, row.id))),
		row.id
	);
	return { nodeId: row.id, isNew: false, mismatches: [] };
}

/** A save's reading with what only the mod's log knows (events, daily stockpiles) kept from `log`. */
export function withLogFields(save: Snapshot, log: Snapshot): Snapshot {
	return {
		...save,
		timelineId: save.timelineId ?? log.timelineId,
		previousTimelineId: save.previousTimelineId ?? log.previousTimelineId,
		logEvents: save.logEvents ?? log.logEvents,
		ticks: save.ticks ?? log.ticks
	};
}

/**
 * The node of a loaded save, from the mod's `load` line: of the campaign's nodes in the month with
 * that timeline id, the latest not after the load's date (the save itself, if it was read). Six
 * random digits repeat across a long campaign, but hardly within one month's window.
 */
export function loadedNode(db: Db, campaign: string, date: string, id: number): number | null {
	const row = db
		.prepare(
			`SELECT n.id FROM node n JOIN snapshot s ON s.node_id = n.id
			WHERE n.campaign = ? AND n.date <= ? AND json_extract(s.json, '$.timelineId') = ?
			ORDER BY n.date DESC, n.id DESC LIMIT 1`
		)
		.get(campaign, date, id) as { id: number } | undefined;
	return row?.id ?? null;
}

/** A save file as last read: its `mtime:size` and the reader that read it. */
export type ReadFile = { version: string; reader: string };

/** The save files read so far, by path below the save folder. */
export function readFiles(db: Db): Map<string, ReadFile> {
	const rows = db.prepare('SELECT path, version, reader FROM save_file').all() as ({
		path: string;
	} & ReadFile)[];
	return new Map(rows.map((r) => [r.path, { version: r.version, reader: r.reader }]));
}

export function noteFile(db: Db, path: string, file: ReadFile) {
	db.prepare('INSERT OR REPLACE INTO save_file (path, version, reader) VALUES (?, ?, ?)').run(
		path,
		file.version,
		file.reader
	);
}

/**
 * A snapshot's stored JSON: its galaxy (and the lists as if all were surveyed) go to the
 * campaign's `galaxy` row, if it is the latest.
 */
function stored(db: Db, snap: Snapshot): string {
	if (snap.galaxy) {
		const row = db.prepare('SELECT date FROM galaxy WHERE campaign = ?').get(snap.campaign) as
			{ date: string } | undefined;
		if (!row || row.date <= snap.date)
			db.prepare('INSERT OR REPLACE INTO galaxy (campaign, date, json) VALUES (?, ?, ?)').run(
				snap.campaign,
				snap.date,
				JSON.stringify({ systems: snap.galaxy, surveyedAll: snap.surveyedAll })
			);
	}
	return JSON.stringify({ ...snap, galaxy: null, surveyedAll: null });
}

/** The campaign's galaxy as last read (its date), or null before the first save that has one. */
export function galaxyOf(
	db: Db,
	campaign: string
): { date: string; systems: GalaxySystem[]; surveyedAll: Snapshot['surveyedAll'] } | null {
	const row = db.prepare('SELECT date, json FROM galaxy WHERE campaign = ?').get(campaign) as
		{ date: string; json: string } | undefined;
	if (!row) return null;
	const v = JSON.parse(row.json);
	// rows before 2026-10-18 hold the systems alone
	return Array.isArray(v)
		? { date: row.date, systems: v, surveyedAll: null }
		: { date: row.date, systems: v.systems, surveyedAll: v.surveyedAll ?? null };
}

/**
 * Notes each installed mod's version and update time, when they differ from its last note (or it
 * is new), with the time of this start and the game date of the head: the mods tab's updates.
 */
export function noteModVersions(db: Db, mods: ModInfo[], seenAt: string, gameDate: string | null) {
	const last = db.prepare(
		'SELECT version, supported, updated FROM mod_version WHERE name = ? ORDER BY seen_at DESC LIMIT 1'
	);
	const add = db.prepare(
		'INSERT INTO mod_version (name, version, supported, updated, seen_at, game_date) VALUES (?, ?, ?, ?, ?, ?)'
	);
	for (const m of mods) {
		const prev = last.get(m.name) as
			{ version: string | null; supported: string | null; updated: string | null } | undefined;
		if (
			!prev ||
			prev.version !== m.version ||
			prev.supported !== m.supportedVersion ||
			prev.updated !== m.updated
		)
			add.run(m.name, m.version, m.supportedVersion, m.updated, seenAt, gameDate);
	}
}

/** Every note of `noteModVersions`, oldest first. */
export function modVersions(db: Db): ModVersionSeen[] {
	return (
		db
			.prepare(
				'SELECT name, version, supported, updated, seen_at, game_date FROM mod_version ORDER BY seen_at'
			)
			.all() as {
			name: string;
			version: string | null;
			supported: string | null;
			updated: string | null;
			seen_at: string;
			game_date: string | null;
		}[]
	).map((r) => ({
		name: r.name,
		version: r.version,
		supportedVersion: r.supported,
		updated: r.updated,
		seenAt: r.seen_at,
		gameDate: r.game_date
	}));
}

function sourceOf(db: Db, nodeId: number): string {
	return (db.prepare('SELECT source FROM node WHERE id = ?').get(nodeId) as { source: string })
		.source;
}

/**
 * The mod reports `export_resource_income_to_variable`, assumed to be net income. Where the save
 * has a balance for the same moment the two must agree; a mismatch means the assumption is wrong.
 */
export function compareBalances(
	fromLog: Resources,
	fromSave: Resources,
	tolerance = 0.05
): string[] {
	return Object.keys(fromSave)
		.filter((k) => k in fromLog && Math.abs(fromLog[k] - fromSave[k]) > tolerance)
		.map((k) => `${k}: mod ${fromLog[k]} vs save ${fromSave[k]}`);
}

/** Snapshots root → node: the history of the branch that node is on. */
export function history(db: Db, nodeId: number): Snapshot[] {
	return path(nodes(db), nodeId).map((n) => snapshotOf(db, n.id));
}

/** Manual correction of a guessed parent. Refuses to create a cycle. */
export function setParent(db: Db, nodeId: number, parentId: number | null) {
	if (parentId !== null && path(nodes(db), parentId).some((n) => n.id === nodeId)) {
		throw new Error(`node ${parentId} descends from ${nodeId}; that would make a cycle`);
	}
	db.prepare('UPDATE node SET parent_id = ?, ambiguous = 0 WHERE id = ?').run(parentId, nodeId);
}
