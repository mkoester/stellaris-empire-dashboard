import { DatabaseSync } from 'node:sqlite';
import { path, place } from '#lib/timeline.ts';
import type { Snapshot, TimelineNode } from '#lib/types.ts';

// The dashboard's own store: the save graph plus one snapshot per node. Everything in it can be
// rebuilt from saves, so there are no migrations — delete the file when the schema changes.

export type Db = DatabaseSync;

export function openDb(file: string): Db {
	const db = new DatabaseSync(file);
	db.exec(`
		PRAGMA journal_mode = WAL;
		CREATE TABLE IF NOT EXISTS node (
			id          INTEGER PRIMARY KEY,
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
		CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
	`);
	return db;
}

type NodeRow = {
	id: number;
	campaign: string;
	date: string;
	fingerprint: string;
	parent_id: number | null;
	ambiguous: number;
};

const toNode = (r: NodeRow): TimelineNode => ({
	id: r.id,
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

function setHead(db: Db, id: number) {
	db.prepare("INSERT OR REPLACE INTO state (key, value) VALUES ('head', ?)").run(String(id));
}

/** Adds a snapshot to the graph (or recognises it) and makes it the head. */
export function record(
	db: Db,
	snap: Snapshot,
	source: string,
	loadedFrom: number | null = null
): { nodeId: number; isNew: boolean } {
	const placement = place(nodes(db), headId(db), snap, loadedFrom);
	if (placement.kind === 'duplicate') {
		setHead(db, placement.nodeId);
		return { nodeId: placement.nodeId, isNew: false };
	}
	db.exec('BEGIN');
	try {
		const { lastInsertRowid } = db
			.prepare(
				`INSERT INTO node (campaign, date, fingerprint, parent_id, ambiguous, source, observed_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				snap.campaign,
				snap.date,
				snap.fingerprint,
				placement.parentId,
				placement.ambiguous ? 1 : 0,
				source,
				new Date().toISOString()
			);
		const nodeId = Number(lastInsertRowid);
		db.prepare('INSERT INTO snapshot (node_id, json) VALUES (?, ?)').run(
			nodeId,
			JSON.stringify(snap)
		);
		setHead(db, nodeId);
		db.exec('COMMIT');
		return { nodeId, isNew: true };
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
}

/** Snapshots root → node: the history of the branch that node is on. */
export function history(db: Db, nodeId: number): Snapshot[] {
	const ids = path(nodes(db), nodeId).map((n) => n.id);
	const get = db.prepare('SELECT json FROM snapshot WHERE node_id = ?');
	return ids.map((id) => JSON.parse((get.get(id) as { json: string }).json) as Snapshot);
}

/** Manual correction of a guessed parent. Refuses to create a cycle. */
export function setParent(db: Db, nodeId: number, parentId: number | null) {
	if (parentId !== null && path(nodes(db), parentId).some((n) => n.id === nodeId)) {
		throw new Error(`node ${parentId} descends from ${nodeId}; that would make a cycle`);
	}
	db.prepare('UPDATE node SET parent_id = ?, ambiguous = 0 WHERE id = ?').run(parentId, nodeId);
}
