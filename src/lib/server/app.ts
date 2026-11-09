import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { appDataDir, readConfig, resolvePaths, writeConfig, type Config } from './config.ts';
import { getRequestEvent } from '$app/server';
import {
	campaignMods,
	getSetting,
	setSetting,
	headCampaign,
	headId,
	loadedNode,
	nodes,
	noteModVersions,
	openDb,
	record,
	nodeLabel,
	type Db,
	type Recorded
} from './db.ts';
import { campaignModSet, trackedMods, type CampaignMods } from '#lib/addons.ts';
import type { GameData, ModInfo, Tick } from '#lib/types.ts';
import { tailLog, toLogSnapshot, type FeedFormat } from './feed.ts';
import { loadDataMods, loadDataVersion, loadGameData } from './gamedata.ts';
import { READER, setEntryEvents, setPrescriptedNames } from './save.ts';
import { loadExplanations, type Explanations } from './explain.ts';
import { dataStore, type DataStore } from './dataStore.ts';
import { dataDbFor, ensureDataDb, extractorFromEnv, type DataMod } from './extract.ts';
import { launcherPlaysets, loadModDescriptors, readLoadOrder } from './mods.ts';
import { viewedCampaign } from './settings.ts';
import { campaignOf, watchSaves, type Watcher } from './watch.ts';

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
	/** the game data per mod set (`dataStore.ts`); each campaign reads its own (`dataOf()`) */
	data?: DataStore<DataMod[], GameDataSet>;
	/** each campaign's mods, resolved once until its saves or the launcher's files change */
	campaignData?: Map<string, CampaignData>;
	/** the launcher's files as last seen (`dlc_load.json`, `launcher-v2.sqlite`): mtimes */
	launcherStamp?: string;
	launcherTimer?: ReturnType<typeof setInterval>;
	/** one data set for every campaign, set by a throwaway test instead of starting (AGENTS.md) */
	gameData?: GameData;
	explanations?: Explanations;
	mods?: ModInfo[];
	userDir?: string; // the Stellaris user folder: the save folder's parent
	saveDir?: string;
	watcher?: Watcher;
	/** stops following game.log */
	stopTail?: () => void;
	catchUpTimer?: ReturnType<typeof setTimeout>;
	/** The node of the save the player just loaded (the mod's `load` line), for the next observation. */
	loadedFrom?: number | null;
	/** The companion mod writes a log format this build does not read (until a month is read). */
	feedFormat?: FeedFormat;
	/** when the last save or month was recorded, and the last daily tick (ms): which came last */
	recordedAt?: number;
	lastTick?: { date: string; at: number };
};
const g = globalThis as typeof globalThis & { __stellarisDashboard?: State };
const state: State = (g.__stellarisDashboard ??= { updates: new EventEmitter(), status: 'setup' });

export const updates = state.updates;

/** What pages read from one data DB. */
type GameDataSet = {
	gameData: GameData;
	explanations: Explanations;
	/** the game version and build the game data was extracted from */
	dataVersion: string | null;
	/** the mods it was extracted with (`meta.mods`), null when the data DB cannot tell */
	dataMods: string[] | null;
};

/** A campaign's mods and the data DB they make. */
type CampaignData = { set: CampaignMods; mods: DataMod[] };

const loadSet = (file: string): GameDataSet => ({
	gameData: loadGameData(file),
	explanations: loadExplanations(file),
	dataVersion: loadDataVersion(file),
	dataMods: loadDataMods(file)
});

/**
 * The campaign's mods (`campaignModSet()`: its latest save's, in the launcher's order), with
 * absolute folders. A campaign without a save yet (null) takes the launcher's last start.
 */
function campaignData(campaign: string | null): CampaignData {
	const cache = (state.campaignData ??= new Map());
	const key = campaign ?? '';
	let c = cache.get(key);
	if (!c) {
		const userDir = state.userDir ?? '';
		const active = campaign !== null && state.db ? campaignMods(state.db, campaign) : null;
		const remembered =
			campaign !== null && state.db ? getSetting(state.db, orderKey(campaign)) : undefined;
		const set = campaignModSet(
			active,
			state.mods ?? [],
			userDir ? readLoadOrder(userDir) : [],
			userDir ? launcherPlaysets(userDir) : [],
			Array.isArray(remembered) ? remembered : []
		);
		const mods = set.mods.map((m) => ({
			path: isAbsolute(m.path) ? m.path : join(userDir, m.path),
			updated: m.updated
		}));
		cache.set(key, (c = { set, mods }));
	}
	return c;
}

/** The setting holding the load order seen while the campaign was played (`rememberOrder()`). */
const orderKey = (campaign: string) => `loadOrder:${campaign}`;

/**
 * A save just written by the running game: if the active playset (`dlc_load.json`) holds exactly
 * its mods, that is the order the game runs with — kept for the campaign, as the launcher rewrites
 * `dlc_load.json` on every later playset edit (2026-11-09: edited after playing, the order lost).
 */
function rememberOrder(campaign: string) {
	if (!state.db || !state.userDir) return;
	const launch = readLoadOrder(state.userDir);
	const set = campaignModSet(campaignMods(state.db, campaign), state.mods ?? [], launch, []);
	if (set.source?.kind !== 'launch') return;
	const before = getSetting(state.db, orderKey(campaign));
	if (JSON.stringify(before) !== JSON.stringify(launch))
		setSetting(state.db, orderKey(campaign), launch);
}

/**
 * The campaign's game data now: its own if extracted (loaded from disk at first use), else the
 * most recently used — while its own is extracted in the background, after which open pages
 * reload and its saves are read again with it (`extractFor()`).
 */
function dataOf(campaign: string | null): GameDataSet {
	if (!state.data) {
		if (state.gameData && state.explanations)
			return {
				gameData: state.gameData,
				explanations: state.explanations,
				dataVersion: null,
				dataMods: null
			};
		throw new Error('dashboard not started');
	}
	const { mods } = campaignData(campaign);
	const own = state.data.get(mods);
	if (own) return own.data;
	extractFor(campaign);
	const latest = state.data.latest();
	if (!latest) throw new Error('dashboard not started');
	return latest.data;
}

/** Extracts the campaign's game data in the background, then reloads pages and reads its saves. */
function extractFor(campaign: string | null) {
	const { mods } = campaignData(campaign);
	if (!state.data || state.data.pending(mods)) return;
	updates.emit('update', 'refreshed'); // open pages show the banner
	state.data
		.ensure(mods)
		.then(() => {
			updates.emit('update', 'refreshed');
			if (campaign !== null)
				return state.watcher?.reread(campaign).then((n) => {
					if (n) console.log(`read ${n} saves of ${campaign} again with its game data`);
					updates.emit('update', 'refreshed');
				});
		})
		.catch((e) => console.error(`game data for ${campaign ?? 'new games'}:`, e));
}

// The viewed campaign's data, once per request: pages call the getters many times.
const perRequest = new WeakMap<object, GameDataSet>();
function viewedData(): GameDataSet {
	let event: object | null = null;
	try {
		event = getRequestEvent();
	} catch {
		// no request: the head campaign's
	}
	if (!event) return dataOf(state.db ? headCampaign(state.db) : null);
	let d = perRequest.get(event);
	if (!d) perRequest.set(event, (d = dataOf(state.db ? viewedCampaign(state.db) : null)));
	return d;
}

export const getExplanations = (): Explanations => viewedData().explanations;

/** The game version and build the game data comes from (`Cygnus v4.5.3 (7793)`), null if unknown. */
export const dataVersion = () => viewedData().dataVersion;

/** The mods the viewed campaign's game data includes ([] none), null when the data DB cannot tell. */
export const dataMods = () => viewedData().dataMods;

export const getGameData = (): GameData => viewedData().gameData;

/**
 * The viewed campaign's mods as the game data takes them: where their order comes from, which
 * have no folder, and whether its own data is still being extracted (pages show the older one).
 */
export function campaignDataState(): {
	source: CampaignMods['source'];
	missing: string[];
	mods: number;
	extracting: boolean;
} | null {
	if (!state.data || !state.db) return null;
	const { set, mods } = campaignData(viewedCampaign(state.db));
	return {
		source: set.source,
		missing: set.missing,
		mods: mods.length,
		extracting: state.data.pending(mods)
	};
}

/** The installed mods' descriptors, read at start. */
export function getMods(): ModInfo[] {
	if (!state.mods) throw new Error('dashboard not started');
	return state.mods;
}

/** The active playset's load order (`dlc_load.json`, rewritten on every playset edit), read on each call. */
export function getLoadOrder(): string[] {
	return state.userDir ? readLoadOrder(state.userDir) : [];
}

export function getDb(): Db {
	if (!state.db) throw new Error('dashboard not started');
	return state.db;
}

/** The loaded save's node, once: the observation after a load is its child. */
/** The save just loaded in game, until the next observation switches to its branch. */
export const pendingLoad = (): number | null => state.loadedFrom ?? null;

/** A log format of the companion mod this build skips, for the layout's banner. */
export const unsupportedFeed = (): FeedFormat | null => state.feedFormat ?? null;

function setFeedFormat(f: FeedFormat | undefined) {
	if (f?.format === state.feedFormat?.format) return;
	state.feedFormat = f;
	if (f) console.warn(`game.log: companion mod log format ${f.format} is not read by this build`);
	updates.emit('update', 'refreshed'); // open pages show or drop the banner
}

/**
 * The game data per mod set: extracted next to the dashboard's data, or a dev run's one data DB
 * for every campaign (`STELLARIS_DATA_DB`, unmodded).
 */
function gameDataStore(gameDir: string, fixed: string | undefined) {
	const extractor = extractorFromEnv(process.env);
	const files = new Map<string, string>(); // reads the game folder once per mod set
	const fileFor = (mods: DataMod[]) => {
		if (fixed) return fixed;
		const key = JSON.stringify(mods);
		let f = files.get(key);
		if (!f) files.set(key, (f = dataDbFor(gameDir, appDir(), extractor, mods).file));
		return f;
	};
	return dataStore<DataMod[], GameDataSet>({
		fileFor,
		exists: existsSync,
		ensure: async (mods) => fixed ?? ensureDataDb(gameDir, appDir(), extractor, console.log, mods),
		load: loadSet
	});
}

/**
 * Who read a campaign's saves: the reader and the campaign's data DB (its file, as the stamp of
 * its content) — another data DB means another reading. Before it is extracted: `pending`.
 */
function readerOf(campaign: string): string {
	const file = state.data?.get(campaignData(campaign).mods)?.file;
	if (!file || !existsSync(file)) return `${READER}:pending`;
	const data = statSync(file);
	return `${READER}:${data.mtimeMs}:${data.size}`;
}

/** A new save may name other mods: the campaign's data follows it, its saves read again. */
function modsMayHaveChanged(campaign: string) {
	const before = state.campaignData?.get(campaign);
	state.campaignData?.delete(campaign);
	if (before) follow(campaign, before, `${campaign}'s latest save`);
}

/** The campaign's mods resolved again: on a change its data follows, its saves read again. */
function follow(campaign: string, before: CampaignData, why: string) {
	const after = campaignData(campaign);
	if (JSON.stringify(after.mods) === JSON.stringify(before.mods)) return;
	console.log(`${why}: ${campaign}'s game data follows (${after.mods.length} mods)`);
	if (state.data?.get(after.mods))
		state.watcher?.reread(campaign).then(() => updates.emit('update', 'refreshed'));
	else extractFor(campaign);
}

/** How often the launcher's files are checked for a playset change. */
const LAUNCHER_POLL_MS = 5000;

const launcherStamp = (userDir: string) =>
	['dlc_load.json', 'launcher-v2.sqlite', 'launcher-v2.sqlite-wal']
		.map((f) => {
			try {
				return statSync(join(userDir, f)).mtimeMs;
			} catch {
				return 0;
			}
		})
		.join(':');

/**
 * A playset edited or a game started in the launcher: every campaign's mods are resolved again
 * (the order may come from another playset now), mod updates noticed, open pages reloaded.
 */
function watchLauncher() {
	if (!state.userDir || !state.saveDir) return;
	const stamp = launcherStamp(state.userDir);
	if (stamp === state.launcherStamp) return;
	state.launcherStamp = stamp;
	state.mods = loadModDescriptors(state.saveDir);
	const before = new Map(state.campaignData);
	state.campaignData = new Map();
	for (const [campaign, c] of before) if (campaign !== '') follow(campaign, c, 'launcher changed');
	updates.emit('update', 'refreshed');
}

function takeLoaded(): number | null {
	const id = state.loadedFrom ?? null;
	state.loadedFrom = null;
	return id;
}

function recorded(r: Recorded, source: string) {
	const label = state.db ? nodeLabel(state.db, r.nodeId) : `id ${r.nodeId}`;
	console.log(`${r.isNew ? 'new ' : 'seen'} node ${label} ← ${source}`);
	for (const m of r.mismatches) console.warn(`mod and save disagree on net income: ${m}`);
	state.recordedAt = Date.now();
	updates.emit('update', r.nodeId);
}

/**
 * The game date of the latest data, in the order it came: the last daily tick of the companion
 * mod when it came after the last save or month, else the head's date (`headDate`). By arrival,
 * not by date: after loading an older save, the older ticks are the latest data.
 */
export function lastDataDate(headDate: string | null): string | null {
	const t = state.lastTick;
	return t && t.at > (state.recordedAt ?? 0) ? t.date : headDate;
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
	// once per process: /setup starts again, and Vite re-imports this module
	if (!process.listenerCount('sveltekit:shutdown')) process.once('sveltekit:shutdown', stop);
	return (state.starting ??= run().catch((e: Error) => {
		state.status = 'setup';
		state.error = e.message;
		console.error('cannot start:', e.message);
	}));
}

/**
 * The packaged launcher's shutdown (adapter-node's `sveltekit:shutdown`, emitted once the HTTP
 * server is closed): lets a start-up and the save being read finish, then closes the DB, which
 * folds the WAL back into it. Nothing is left running, so the process ends by itself.
 */
async function stop() {
	await state.starting;
	clearTimeout(state.catchUpTimer);
	clearInterval(state.launcherTimer);
	state.stopTail?.();
	await state.watcher?.stop();
	state.db?.close();
	state.db = undefined;
	console.log('stopped');
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
	state.mods = loadModDescriptors(saveDir);
	state.userDir = dirname(saveDir);
	state.saveDir = saveDir;
	state.campaignData = new Map();
	mkdirSync(dirname(dbFile), { recursive: true });
	const store = (state.db = openDb(dbFile));
	state.data = gameDataStore(paths.gameDir!, paths.dataDb);
	// the head campaign's data before the first page (later ones extract in the background)
	await state.data.ensure(campaignData(headCampaign(store)).mods);
	state.launcherStamp = launcherStamp(state.userDir);
	state.launcherTimer = setInterval(watchLauncher, LAUNCHER_POLL_MS);

	// Snapshots carry names from the data DB (prescripted empires, entry events): each campaign's
	// saves are read with its own data, and read again when that changes (its stamp in `reader`).
	state.watcher = await watchSaves(store, saveDir, {
		onIngest: (r) => {
			recorded(r, r.file);
			const campaign = campaignOf(saveDir, r.file);
			// written by the running game (a start reads saves written while the dashboard was off)
			if (state.status === 'running') rememberOrder(campaign);
			modsMayHaveChanged(campaign);
		},
		loadedFrom: takeLoaded,
		onRefresh: (r) => {
			console.log(`${r.isNew ? 'late' : 're-read'} node ${nodeLabel(store, r.nodeId)} ← ${r.file}`);
			// a campaign new to the history is read in the background: its first save names its mods
			if (r.isNew) modsMayHaveChanged(campaignOf(saveDir, r.file));
		},
		onError: (file, e) => console.error(`cannot ingest ${file}:`, e),
		prepare: async (campaign) => {
			const d = (await state.data!.ensure(campaignData(campaign).mods)).data;
			setPrescriptedNames(d.gameData.prescriptedNames);
			setEntryEvents(d.gameData.entryEvents);
		},
		reader: (campaign) => readerOf(campaign)
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
	state.catchUpTimer = setTimeout(() => {
		state.watcher
			?.catchUp(caughtUp)
			.then(() => console.log('every campaign is up to date'))
			.catch((e) => console.error('catching up:', e));
	}, CATCH_UP_DELAY_MS);

	if (gameLog) {
		state.stopTail = await tailLog(gameLog, {
			onMonth: (m) => {
				setFeedFormat(undefined);
				// game.log names no campaign; months belong to whatever is being played.
				const campaign = headCampaign(store);
				if (campaign === null) return console.warn(`mod month ${m.date} before any save; skipped`);
				recorded(
					record(store, toLogSnapshot(m, campaign), 'game.log', takeLoaded()),
					`game.log ${m.date}`
				);
			},
			onTick: (t) => {
				state.lastTick = { date: t.date, at: Date.now() };
				updates.emit('tick', t satisfies Tick);
			},
			onLoad: (date, id) => {
				const campaign = headCampaign(store);
				state.loadedFrom =
					campaign === null || id === null ? null : loadedNode(store, campaign, date, id);
				console.log(
					`save loaded at ${date}: ${state.loadedFrom === null ? 'unknown node' : `node ${state.loadedFrom}`}`
				);
				// open pages ask whether to show it now (the layout's `loaded`)
				if (state.loadedFrom !== null) updates.emit('loaded');
			},
			onUnsupported: (f) => setFeedFormat({ format: f.format, newer: f.newer }),
			onError: (e) => console.error('game.log:', e)
		});
	}
}
