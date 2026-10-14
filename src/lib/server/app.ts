import { EventEmitter } from 'node:events';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDb, type Db } from './db.ts';
import { watchSaves } from './watch.ts';

// Process-wide wiring: one database, one save watcher, one event bus for live updates.
// Both paths are required — a default pointing at a real location fails quietly against the
// wrong tree.

export const updates = new EventEmitter();

let db: Db | undefined;

export function getDb(): Db {
	if (!db) throw new Error('dashboard not started');
	return db;
}

function required(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`${name} is not set`);
	return v;
}

export async function start() {
	if (db) return;
	const dbFile = required('DASHBOARD_DB');
	const saveDir = required('STELLARIS_SAVE_DIR');
	mkdirSync(dirname(dbFile), { recursive: true });
	db = openDb(dbFile);
	await watchSaves(db, saveDir, {
		onIngest: (r) => {
			console.log(`${r.isNew ? 'new ' : 'seen'} node ${r.nodeId} ← ${r.file}`);
			updates.emit('update', r.nodeId);
		},
		onError: (file, e) => console.error(`cannot ingest ${file}:`, e)
	});
}
