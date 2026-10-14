import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { record, type Db, type Recorded } from './db.ts';
import { readSave, toSnapshot } from './save.ts';

// Ingests saves from the game's `save games/` folder: everything already there at start (oldest
// first, so the graph is built in play order), then each save as it is written.
// The campaign is the save's folder name, e.g. `yastundevourers_-569978727`.
//
// Polls rather than using fs.watch: the folder holds a handful of files, and polling behaves the
// same on every platform (fs.watch's recursive mode differs between FSEvents and inotify, and
// failed with EMFILE under the macOS sandbox). A file counts as written once its size and mtime
// are unchanged for one poll interval.

export type Ingested = Recorded & { file: string };

export async function ingestFile(db: Db, root: string, file: string): Promise<Ingested> {
	const snap = toSnapshot(await readSave(await readFile(file)), campaignOf(root, file));
	return { ...record(db, snap, relative(root, file)), file };
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
	intervalMs?: number;
	retries?: number; // a file that keeps failing to parse is reported after this many tries
};

/** Starts ingesting; resolves after the backfill with a function that stops polling. */
export async function watchSaves(db: Db, root: string, opts: WatchOptions): Promise<() => void> {
	const { intervalMs = 2000, retries = 3 } = opts;
	const done: Seen = new Map(); // last version ingested (or given up on)
	const pending: Seen = new Map(); // version seen last tick, not yet ingested
	const failures = new Map<string, number>();

	const ingest = async (file: string, version: string) => {
		try {
			opts.onIngest(await ingestFile(db, root, file));
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

	for (const [file, version] of await scan(root)) await ingest(file, version);
	// Backfill files that failed get their remaining tries through the poll loop.
	for (const file of failures.keys()) pending.set(file, '');

	let busy = false;
	const timer = setInterval(async () => {
		if (busy) return;
		busy = true;
		try {
			for (const [file, version] of await scan(root)) {
				if (done.get(file) === version) continue;
				if (pending.get(file) === version) await ingest(file, version);
				else pending.set(file, version);
			}
		} catch (e) {
			opts.onError(root, e);
		} finally {
			busy = false;
		}
	}, intervalMs);
	return () => clearInterval(timer);
}
