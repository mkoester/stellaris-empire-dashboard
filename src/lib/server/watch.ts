import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import {
	headCampaign,
	lastNode,
	noteFile,
	readFiles,
	record,
	refresh,
	type Db,
	type Recorded
} from './db.ts';
import { READER, readSave, toSnapshot } from './save.ts';

// Ingests saves from the game's `save games/` folder, then each save as it is written. The
// campaign is the save's folder name, e.g. `yastundevourers_-569978727`.
//
// `save_file` remembers each file's version and the reader that read it, so a start reads only
// what is new, changed, or read by an older reader. Of that, the start reads the head campaign's
// (with an empty DB the campaign of the newest save) before it resolves — oldest first, so the
// graph is built in play order. The other campaigns wait in a backlog that `catchUp` works off in
// the background, the most recently played first, one save at a time so the poll loop and pages
// get their turn; a campaign viewed (`refreshCampaign`) or played meanwhile is read at once. A
// backlog read is no observation of the game: it leaves the head alone.
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
	/** A save read from the backlog: again by a newer reader, or late. */
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
	/** Reads the campaign's backlog now; resolves with how many saves were read. */
	refreshCampaign: (campaign: string) => Promise<number>;
	/** Works off every campaign's backlog, the most recently played first. */
	catchUp: (onCampaign?: (campaign: string, read: number) => void) => Promise<void>;
	/** The campaigns with saves on disk, as of the last scan. */
	onDisk: () => Set<string>;
};

/** A save left to the backlog: new or changed since it was read, or read by an older reader. */
type Todo = { file: string; version: string; stale: boolean };

/** Starts ingesting; resolves once the head campaign is read. */
export async function watchSaves(db: Db, root: string, opts: WatchOptions): Promise<Watcher> {
	const { intervalMs = 2000, retries = 3, reader = READER } = opts;
	const done: Seen = new Map(); // last version ingested (or given up on, or left to the backlog)
	const pending: Seen = new Map(); // version seen last tick, not yet ingested
	const failures = new Map<string, number>();
	const backlog = new Map<string, Todo[]>(); // campaign → its saves to read, oldest first
	const cursor = new Map<string, number | null>(); // campaign → its node read last from the backlog
	let disk = new Set<string>();
	let stopped = false;

	// One parse at a time: the poll loop and the backlog share the DB and the head.
	let lock = Promise.resolve();
	const exclusive = <T>(f: () => Promise<T>): Promise<T> => {
		const run = lock.then(f);
		lock = run.then(
			() => {},
			() => {}
		);
		return run;
	};

	const scanned = async () => {
		const files = await scan(root);
		disk = new Set([...files.keys()].map((f) => campaignOf(root, f)));
		return files;
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

	// A save of the backlog is complete (it held still since the last run, or it is reported at
	// once — another try would fail the same). A re-read replaces the stored reading; a late save
	// goes after the campaign's node read last, as if that were the head.
	const readLate = async (campaign: string, t: Todo) => {
		if (done.get(t.file) !== t.version) return false; // changed since: the poll loop records it
		const source = relative(root, t.file);
		try {
			const snap = await readSnapshot(root, t.file);
			const at = cursor.has(campaign) ? cursor.get(campaign)! : lastNode(db, campaign);
			const r = t.stale ? refresh(db, snap) : record(db, snap, source, null, at);
			noteFile(db, source, { version: t.version, reader });
			if (r) {
				cursor.set(campaign, r.nodeId);
				opts.onRefresh?.({ ...r, file: t.file });
			}
		} catch (e) {
			opts.onError(t.file, e);
		}
		return true;
	};

	/** The campaign's backlog, now; within `exclusive` already. */
	const readAll = async (campaign: string) => {
		const todo = backlog.get(campaign) ?? [];
		backlog.delete(campaign);
		let n = 0;
		for (const t of todo) if (await readLate(campaign, t)) n++;
		return n;
	};

	const known = readFiles(db);
	const files = await scanned();
	const newest = [...files.keys()].at(-1);
	const first = headCampaign(db) ?? (newest ? campaignOf(root, newest) : null);
	for (const [file, version] of files) {
		const k = known.get(relative(root, file));
		const campaign = campaignOf(root, file);
		if (k?.version === version && k.reader === reader) done.set(file, version);
		else if (campaign === first && k?.version !== version) await ingest(file, version);
		else {
			done.set(file, version);
			backlog.set(campaign, [
				...(backlog.get(campaign) ?? []),
				{ file, version, stale: k?.version === version }
			]);
		}
	}
	// Files that failed get their remaining tries through the poll loop.
	for (const file of failures.keys()) pending.set(file, '');
	if (first !== null) await readAll(first);
	// most recently played first: in mtime order, a campaign's last file decides
	const order = [...new Set([...files.keys()].reverse().map((f) => campaignOf(root, f)))];

	let busy = false;
	const timer = setInterval(() => {
		if (busy) return;
		busy = true;
		exclusive(async () => {
			for (const [file, version] of await scanned()) {
				if (done.get(file) === version) continue;
				if (pending.get(file) !== version) {
					pending.set(file, version);
					continue;
				}
				// a campaign played again: what came before goes first
				await readAll(campaignOf(root, file));
				await ingest(file, version);
			}
		})
			.catch((e) => opts.onError(root, e))
			.finally(() => (busy = false));
	}, intervalMs);

	const refreshCampaign = (campaign: string) =>
		backlog.has(campaign) ? exclusive(() => readAll(campaign)) : Promise.resolve(0);

	const catchUp = async (onCampaign?: (campaign: string, read: number) => void) => {
		for (const campaign of order) {
			if (!backlog.has(campaign)) continue;
			let n = 0;
			// a save at a time, each in its own turn
			while (!stopped && backlog.get(campaign)?.length) {
				const read = await exclusive(async () => {
					const t = backlog.get(campaign)?.shift();
					if (!backlog.get(campaign)?.length) backlog.delete(campaign);
					return t ? readLate(campaign, t) : false;
				});
				if (read) n++;
			}
			if (stopped) return;
			onCampaign?.(campaign, n);
		}
	};

	return {
		stop: () => {
			stopped = true;
			clearInterval(timer);
		},
		refreshCampaign,
		catchUp,
		onDisk: () => disk
	};
}
