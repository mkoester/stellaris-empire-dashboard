import { EventEmitter } from 'node:events';
import { mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { appDataDir, readConfig, resolvePaths, writeConfig, type Config } from './config.ts';
import {
	headCampaign,
	headId,
	loadedNode,
	nodes,
	noteModVersions,
	openDb,
	record,
	type Db,
	type Recorded
} from './db.ts';
import { trackedMods } from '#lib/addons.ts';
import type { GameData, ModInfo, Tick } from '#lib/types.ts';
import { tailLog, toLogSnapshot } from './feed.ts';
import { loadGameData } from './gamedata.ts';
import { READER, setPrescriptedNames } from './save.ts';
import { loadExplanations, type Explanations } from './explain.ts';
import { ensureDataDb, extractorFromEnv } from './extract.ts';
import { loadModDescriptors } from './mods.ts';
import { watchSaves, type Watcher } from './watch.ts';

// Process-wide wiring: one database, one save watcher, optionally one game.log reader for the
// companion mod, and one event bus for live updates.
// The folders come from the environment or `config.json` (`config.ts`); while one is missing the
// dashboard waits in `setup` and every page leads to /setup, which writes the config and starts it.
// Without STELLARIS_DATA_DB the game data is extracted from the game folder first (`extract.ts`).

// Kept on globalThis: Vite re-imports this module when a server file changes in dev, and a fresh
// module-level copy would start a second watcher on the same DB (seen: it re-read the saves and
// moved the head back, so the next autosave was filed as a branch) and a second event bus that
// open pages never hear.
type State = {
	updates: EventEmitter;
	starting?: Promise<void>;
	status: 'setup' | 'starting' | 'running';
	/** why the last start failed, shown on /setup */
	error?: string;
	db?: Db;
	gameData?: GameData;
	explanations?: Explanations;
	mods?: ModInfo[];
	watcher?: Watcher;
	/** The node of the save the player just loaded (the mod's `load` line), for the next observation. */
	loadedFrom?: number | null;
};
const g = globalThis as typeof globalThis & { __stellarisDashboard?: State };
const state: State = (g.__stellarisDashboard ??= { updates: new EventEmitter(), status: 'setup' });

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

/** The loaded save's node, once: the observation after a load is its child. */
function takeLoaded(): number | null {
	const id = state.loadedFrom ?? null;
	state.loadedFrom = null;
	return id;
}

function recorded(r: Recorded, source: string) {
	console.log(`${r.isNew ? 'new ' : 'seen'} node ${r.nodeId} ← ${source}`);
	for (const m of r.mismatches) console.warn(`mod and save disagree on net income: ${m}`);
	updates.emit('update', r.nodeId);
}

function caughtUp(campaign: string, n: number) {
	if (!n) return;
	console.log(`read ${n} saves of ${campaign} in the background`);
	updates.emit('update', 'refreshed');
}

/**
 * Reads the campaign's saves still in the backlog (new since the last run, or left to an older
 * reader) in the background, once; open pages reload when it is done.
 */
export function refreshCampaign(campaign: string) {
	state.watcher?.refreshCampaign(campaign).then((n) => caughtUp(campaign, n));
}

/** The campaigns with saves on disk; empty before the start. */
export const campaignsOnDisk = (): Set<string> => state.watcher?.onDisk() ?? new Set();

/** How long after the start the other campaigns' backlog is read: the first pages come first. */
const CATCH_UP_DELAY_MS = 3000;

const appDir = () => appDataDir(process.platform, process.env, homedir());

export const status = () => state.status;

/** What /setup shows: the stored folders and why the last start failed. */
export function setupState() {
	return {
		status: state.status,
		error: state.error,
		appDir: appDir(),
		config: readConfig(appDir())
	};
}

/**
 * Stores the folders and starts the dashboard with them. Once running, the new folders apply at
 * the next start (`restart`): the watcher and DB stay as they are.
 */
export async function configure(config: Config): Promise<{ restart: boolean }> {
	writeConfig(appDir(), config);
	if (state.status === 'running') return { restart: true };
	state.starting = undefined;
	state.error = undefined;
	await start();
	return { restart: false };
}

/**
 * Starts once per process; later calls (re-imports, a second init) get the same start-up. A failed
 * start leaves the dashboard in `setup` with the reason, never a crashed server.
 */
export function start(): Promise<void> {
	return (state.starting ??= run().catch((e: Error) => {
		state.status = 'setup';
		state.error = e.message;
		console.error('cannot start:', e.message);
	}));
}

async function run() {
	const paths = resolvePaths(process.env, readConfig(appDir()), appDir());
	if (!paths) {
		state.status = 'setup';
		console.log('game folders not set yet: open the dashboard to pick them (/setup)');
		return;
	}
	state.status = 'starting';
	const { dashboardDb: dbFile, saveDir, gameLog } = paths;
	const dataDb =
		paths.dataDb ?? (await ensureDataDb(paths.gameDir!, appDir(), extractorFromEnv(process.env)));
	state.gameData = loadGameData(dataDb);
	setPrescriptedNames(state.gameData.prescriptedNames);
	state.explanations = loadExplanations(dataDb);
	state.mods = loadModDescriptors(saveDir);
	mkdirSync(dirname(dbFile), { recursive: true });
	const store = (state.db = openDb(dbFile));

	// Snapshots carry names from the data DB (prescripted empires): a new one means a new reading.
	const data = statSync(dataDb);
	state.watcher = await watchSaves(store, saveDir, {
		onIngest: (r) => recorded(r, r.file),
		loadedFrom: takeLoaded,
		onRefresh: (r) => console.log(`${r.isNew ? 'late' : 're-read'} node ${r.nodeId} ← ${r.file}`),
		onError: (file, e) => console.error(`cannot ingest ${file}:`, e),
		reader: `${READER}:${data.mtimeMs}:${data.size}`
	});
	// after the backfill, so the note carries the latest game date
	const head = headId(store);
	noteModVersions(
		store,
		trackedMods(state.mods),
		new Date().toISOString(),
		nodes(store).find((n) => n.id === head)?.date ?? null
	);
	state.status = 'running';
	setTimeout(() => {
		state.watcher
			?.catchUp(caughtUp)
			.then(() => console.log('every campaign is up to date'))
			.catch((e) => console.error('catching up:', e));
	}, CATCH_UP_DELAY_MS);

	if (gameLog) {
		await tailLog(gameLog, {
			onMonth: (m) => {
				// game.log names no campaign; months belong to whatever is being played.
				const campaign = headCampaign(store);
				if (campaign === null) return console.warn(`mod month ${m.date} before any save; skipped`);
				recorded(
					record(store, toLogSnapshot(m, campaign), 'game.log', takeLoaded()),
					`game.log ${m.date}`
				);
			},
			onTick: (t) => updates.emit('tick', t satisfies Tick),
			onLoad: (date, id) => {
				const campaign = headCampaign(store);
				state.loadedFrom =
					campaign === null || id === null ? null : loadedNode(store, campaign, date, id);
				console.log(
					`save loaded at ${date}: ${state.loadedFrom === null ? 'unknown node' : `node ${state.loadedFrom}`}`
				);
			},
			onError: (e) => console.error('game.log:', e)
		});
	}
}
