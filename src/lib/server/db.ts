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
//   snapshots up to date on read; saves still on disk refresh theirs on every start.
// - SCHEMA versions the *tables* only. Bumping it drops everything, history included — except the
//   viewer's settings (`setting`: theme, custom tabs), which no schema change touches.
// - The galaxy (`Snapshot.galaxy`: every system with its bodies) and the lists as if all were
//   surveyed (`Snapshot.surveyedAll`) are not stored per node (~1.6 MB at 2207.03.10): `galaxy`
//   keeps each campaign's latest reading, the snapshots go without them.

const SCHEMA = '15';

export type Db = DatabaseSync;

export function openDb(file: string): Db {
	const db = new DatabaseSync(file);
	db.exec(`
		CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
		CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, json TEXT NOT NULL);
	`);
	const version = db.prepare("SELECT value FROM state WHERE key = 'schema'").get() as
		{ value: string } | undefined;
	if (version?.value !== SCHEMA) {
		db.exec(`
			DROP TABLE IF EXISTS snapshot;
			DROP TABLE IF EXISTS node;
			DELETE FROM state;
		`);
	}
	db.exec(`
		PRAGMA journal_mode = WAL;
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
	`);
	db.prepare("INSERT OR REPLACE INTO state (key, value) VALUES ('schema', ?)").run(SCHEMA);
	return db;
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
};

const toNode = (r: NodeRow): TimelineNode => ({
	id: r.id,
	kind: r.kind,
	campaign: r.campaign,
	date: r.date,
	fingerprint: r.fingerprint,
	parentId: r.parent_id,
	ambiguous: r.ambiguous === 1
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

function setHead(db: Db, id: number) {
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

/** Adds an observation to the graph (or recognises it, or merges it) and makes it the head. */
export function record(
	db: Db,
	snap: Snapshot,
	source: string,
	loadedFrom: number | null = null
): Recorded {
	const placement = place(nodes(db), headId(db), snap, loadedFrom);
	if (placement.kind === 'duplicate') {
		// Seen before: a save read by a newer dashboard has more fields — keep the fresh reading.
		if (snap.kind === 'save')
			db.prepare('UPDATE snapshot SET json = ? WHERE node_id = ?').run(
				stored(db, snap),
				placement.nodeId
			);
		setHead(db, placement.nodeId);
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
			stored(db, save),
			placement.nodeId
		);
		setHead(db, placement.nodeId);
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
				`INSERT INTO node (kind, campaign, date, fingerprint, parent_id, ambiguous, source, observed_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				snap.kind,
				snap.campaign,
				snap.date,
				snap.fingerprint,
				placement.parentId,
				placement.ambiguous ? 1 : 0,
				source,
				new Date().toISOString()
			);
		const nodeId = Number(lastInsertRowid);
		db.prepare('INSERT INTO snapshot (node_id, json) VALUES (?, ?)').run(nodeId, stored(db, snap));
		setHead(db, nodeId);
		db.exec('COMMIT');
		return { nodeId, isNew: true, mismatches: [] };
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
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
