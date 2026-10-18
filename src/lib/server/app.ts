import { EventEmitter } from 'node:events';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
	headCampaign,
	headId,
	nodes,
	noteModVersions,
	openDb,
	record,
	type Db,
	type Recorded
} from './db.ts';
import type { GameData, ModInfo } from '#lib/types.ts';
import { tailLog, toLogSnapshot } from './feed.ts';
import { loadGameData } from './gamedata.ts';
import { setPrescriptedNames } from './save.ts';
import { loadExplanations, type Explanations } from './explain.ts';
import { loadModDescriptors } from './mods.ts';
import { watchSaves } from './watch.ts';

// Process-wide wiring: one database, one save watcher, optionally one game.log reader for the
// companion mod, and one event bus for live updates.
// DASHBOARD_DB, STELLARIS_SAVE_DIR and STELLARIS_DATA_DB (the extraction's SQLite) are required — a default pointing at a real location fails
// quietly against the wrong tree. STELLARIS_GAME_LOG is opt-in: set it when the mod is enabled.

// Kept on globalThis: Vite re-imports this module when a server file changes in dev, and a fresh
// module-level copy would start a second watcher on the same DB (seen: it re-read the saves and
// moved the head back, so the next autosave was filed as a branch) and a second event bus that
// open pages never hear.
type State = {
	updates: EventEmitter;
	starting?: Promise<void>;
	db?: Db;
	gameData?: GameData;
	explanations?: Explanations;
	mods?: ModInfo[];
};
const g = globalThis as typeof globalThis & { __stellarisDashboard?: State };
const state: State = (g.__stellarisDashboard ??= { updates: new EventEmitter() });

export const updates = state.updates;

export function getExplanations(): Explanations {
	if (!state.explanations) throw new Error('dashboard not started');
	return state.explanations;
}

export function getGameData(): GameData {
	if (!state.gameData) throw new Error('dashboard not started');
	return state.gameData;
}

/** The installed mods' descriptors, read at start. */
export function getMods(): ModInfo[] {
	if (!state.mods) throw new Error('dashboard not started');
	return state.mods;
}

export function getDb(): Db {
	if (!state.db) throw new Error('dashboard not started');
	return state.db;
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

/** Starts once per process; later calls (re-imports, a second init) get the same start-up. */
export function start(): Promise<void> {
	return (state.starting ??= run());
}

async function run() {
	const dbFile = required('DASHBOARD_DB');
	const saveDir = required('STELLARIS_SAVE_DIR');
	state.gameData = loadGameData(required('STELLARIS_DATA_DB'));
	setPrescriptedNames(state.gameData.prescriptedNames);
	state.explanations = loadExplanations(required('STELLARIS_DATA_DB'));
	state.mods = loadModDescriptors(saveDir);
	mkdirSync(dirname(dbFile), { recursive: true });
	const store = (state.db = openDb(dbFile));

	await watchSaves(store, saveDir, {
		onIngest: (r) => recorded(r, r.file),
		onError: (file, e) => console.error(`cannot ingest ${file}:`, e)
	});
	// after the backfill, so the note carries the latest game date
	const head = headId(store);
	noteModVersions(
		store,
		state.mods,
		new Date().toISOString(),
		nodes(store).find((n) => n.id === head)?.date ?? null
	);

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
