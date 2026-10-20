import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import {
	headCampaign,
	noteFile,
	readFiles,
	record,
	refresh,
	type Db,
	type Recorded
} from './db.ts';
import { READER, readSave, toSnapshot } from './save.ts';

// Ingests saves from the game's `save games/` folder: what is new or changed since the last run at
// start (oldest first, so the graph is built in play order), then each save as it is written.
// The campaign is the save's folder name, e.g. `yastundevourers_-569978727`.
//
// `save_file` remembers each file's version and the reader that read it, so a start reads only
// what changed. Saves read by an older reader are read again — the head campaign's at start,
// another campaign's when it is viewed (`refreshCampaign`) — without moving the head.
//
// Polls rather than using fs.watch: the folder holds a handful of files, and polling behaves the
// same on every platform (fs.watch's recursive mode differs between FSEvents and inotify, and
// failed with EMFILE under the macOS sandbox). A file counts as written once its size and mtime
// are unchanged for one poll interval.

export type Ingested = Recorded & { file: string };

async function readSnapshot(root: string, file: string) {
	return toSnapshot(await readSave(await readFile(file)), campaignOf(root, file));
}

export function campaignOf(root: string, file: string): string {
	return relative(root, dirname(file)).split(sep)[0] || basename(dirname(file));
}

type Seen = Map<string, string>; // file → "mtime:size"

async function scan(root: string): Promise<Seen> {
	const entries = await readdir(root, { recursive: true, withFileTypes: true });
	const files = entries
		.filter((e) => e.isFile() && e.name.endsWith('.sav'))
		.map((e) => join(e.parentPath, e.name));
	const stats = await Promise.all(files.map(async (f) => [f, await stat(f)] as const));
	stats.sort((a, b) => a[1].mtimeMs - b[1].mtimeMs);
	return new Map(stats.map(([f, s]) => [f, `${s.mtimeMs}:${s.size}`]));
}

export type WatchOptions = {
	onIngest: (r: Ingested) => void;
	onError: (file: string, e: unknown) => void;
	/** A save read again by a newer reader. */
	onRefresh?: (r: Ingested) => void;
	/** The node of a save just loaded in game, if known: a new save goes below it. Asked once per save. */
	loadedFrom?: () => number | null;
	/** Identifies the reader; a save read by another is read again. Default `READER`. */
	reader?: string;
	intervalMs?: number;
	retries?: number; // a file that keeps failing to parse is reported after this many tries
};

export type Watcher = {
	stop: () => void;
	/** Re-reads the campaign's saves left to an older reader; resolves with how many were read. */
	refreshCampaign: (campaign: string) => Promise<number>;
};

/** Starts ingesting; resolves after the backfill. */
export async function watchSaves(db: Db, root: string, opts: WatchOptions): Promise<Watcher> {
	const { intervalMs = 2000, retries = 3, reader = READER } = opts;
	const done: Seen = new Map(); // last version ingested (or given up on)
	const pending: Seen = new Map(); // version seen last tick, not yet ingested
	const failures = new Map<string, number>();
	const stale = new Map<string, Seen>(); // campaign → its files read by an older reader

	// One parse at a time: the poll loop and refreshCampaign share the DB and the head.
	let lock = Promise.resolve();
	const exclusive = <T>(f: () => Promise<T>): Promise<T> => {
		const run = lock.then(f);
		lock = run.then(
			() => {},
			() => {}
		);
		return run;
	};

	const ingest = async (file: string, version: string) => {
		try {
			const snap = await readSnapshot(root, file);
			const r = record(db, snap, relative(root, file), opts.loadedFrom?.() ?? null);
			noteFile(db, relative(root, file), { version, reader });
			opts.onIngest({ ...r, file });
			done.set(file, version);
			failures.delete(file);
		} catch (e) {
			const n = (failures.get(file) ?? 0) + 1;
			failures.set(file, n);
			if (n >= retries) {
				opts.onError(file, e);
				done.set(file, version);
				failures.delete(file);
			}
		}
	};

	// A re-read is no observation: it replaces the stored reading and leaves the head alone. A
	// file that fails is reported at once — it has not changed, another try would fail the same.
	const reread = async (file: string, version: string) => {
		try {
			const r = refresh(db, await readSnapshot(root, file), relative(root, file));
			noteFile(db, relative(root, file), { version, reader });
			opts.onRefresh?.({ ...r, file });
		} catch (e) {
			opts.onError(file, e);
		}
	};

	const known = readFiles(db);
	const unchanged: Seen = new Map();
	for (const [file, version] of await scan(root)) {
		if (known.get(relative(root, file))?.version === version) unchanged.set(file, version);
		else await ingest(file, version);
	}
	// Backfill files that failed get their remaining tries through the poll loop.
	for (const file of failures.keys()) pending.set(file, '');

	const head = headCampaign(db);
	for (const [file, version] of unchanged) {
		done.set(file, version);
		if (known.get(relative(root, file))?.reader === reader) continue;
		const campaign = campaignOf(root, file);
		if (campaign === head) await reread(file, version);
		else stale.set(campaign, (stale.get(campaign) ?? new Map()).set(file, version));
	}

	let busy = false;
	const timer = setInterval(() => {
		if (busy) return;
		busy = true;
		exclusive(async () => {
			for (const [file, version] of await scan(root)) {
				if (done.get(file) === version) continue;
				if (pending.get(file) === version) await ingest(file, version);
				else pending.set(file, version);
			}
		})
			.catch((e) => opts.onError(root, e))
			.finally(() => (busy = false));
	}, intervalMs);

	const refreshCampaign = (campaign: string) => {
		const files = stale.get(campaign);
		stale.delete(campaign);
		if (!files) return Promise.resolve(0);
		return exclusive(async () => {
			let n = 0;
			for (const [file, version] of files) {
				if (done.get(file) !== version) continue; // changed since: the poll loop records it
				await reread(file, version);
				n++;
			}
			return n;
		});
	};
	return { stop: () => clearInterval(timer), refreshCampaign };
}
