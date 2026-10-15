import { EventEmitter } from 'node:events';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { headCampaign, openDb, record, type Db, type Recorded } from './db.ts';
import type { GameData } from '#lib/types.ts';
import { tailLog, toLogSnapshot } from './feed.ts';
import { loadGameData } from './gamedata.ts';
import { watchSaves } from './watch.ts';

// Process-wide wiring: one database, one save watcher, optionally one game.log reader for the
// companion mod, and one event bus for live updates.
// DASHBOARD_DB, STELLARIS_SAVE_DIR and STELLARIS_DATA_DB (the extraction's SQLite) are required — a default pointing at a real location fails
// quietly against the wrong tree. STELLARIS_GAME_LOG is opt-in: set it when the mod is enabled.

export const updates = new EventEmitter();

let db: Db | undefined;

let gameData: GameData | undefined;

export function getGameData(): GameData {
	if (!gameData) throw new Error('dashboard not started');
	return gameData;
}

export function getDb(): Db {
	if (!db) throw new Error('dashboard not started');
	return db;
}

function required(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`${name} is not set`);
	return v;
}

function recorded(r: Recorded, source: string) {
	console.log(`${r.isNew ? 'new ' : 'seen'} node ${r.nodeId} ← ${source}`);
	for (const m of r.mismatches) console.warn(`mod and save disagree on net income: ${m}`);
	updates.emit('update', r.nodeId);
}

export async function start() {
	if (db) return;
	const dbFile = required('DASHBOARD_DB');
	const saveDir = required('STELLARIS_SAVE_DIR');
	gameData = loadGameData(required('STELLARIS_DATA_DB'));
	mkdirSync(dirname(dbFile), { recursive: true });
	const store = (db = openDb(dbFile));

	await watchSaves(store, saveDir, {
		onIngest: (r) => recorded(r, r.file),
		onError: (file, e) => console.error(`cannot ingest ${file}:`, e)
	});

	const gameLog = process.env.STELLARIS_GAME_LOG;
	if (gameLog) {
		await tailLog(gameLog, {
			onMonth: (m) => {
				// game.log names no campaign; months belong to whatever is being played.
				const campaign = headCampaign(store);
				if (campaign === null) return console.warn(`mod month ${m.date} before any save; skipped`);
				recorded(record(store, toLogSnapshot(m, campaign), 'game.log'), `game.log ${m.date}`);
			},
			onError: (e) => console.error('game.log:', e)
		});
	}
}
