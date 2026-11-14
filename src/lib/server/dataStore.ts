// The game data per mod set: each campaign's pages read the data extracted with its own mods
// (`campaignModSet()`), so several data DBs can be in use at once. A data DB is named by the game,
// its DLCs, the extractor and the mods in load order (`dataDbFor()`), extracted once and kept on
// disk; the store loads the ones asked for, keeps the most recently used few in memory, and runs
// one extraction at a time.

/** A data DB's file and what the pages read from it. */
export type Loaded<D> = { file: string; data: D };

export type DataSource<M, D> = {
	/** the data DB for this mod set, extracted or not — the store's key */
	fileFor: (mods: M) => string;
	/** whether that file is on disk already (then it loads without extracting) */
	exists: (file: string) => boolean;
	/** extracts it when missing; resolves with the file to read (the game's own after a failure) */
	ensure: (mods: M) => Promise<string>;
	load: (file: string) => D;
};

export type DataStore<M, D> = {
	/**
	 * The data for this mod set if loaded or on disk (loaded now; marked most recently used), else
	 * undefined: it needs an extraction (`ensure`).
	 */
	get: (mods: M) => Loaded<D> | undefined;
	/** loads (extracting first if needed) the data for this mod set; one run per file at a time */
	ensure: (mods: M) => Promise<Loaded<D>>;
	/** the most recently used data, for a mod set still extracting */
	latest: () => Loaded<D> | undefined;
	/** whether the data for this mod set is being made */
	pending: (mods: M) => boolean;
};

export function dataStore<M, D>(
	src: DataSource<M, D>,
	{ keep = 3, onError = console.error }: { keep?: number; onError?: (e: unknown) => void } = {}
): DataStore<M, D> {
	const loaded = new Map<string, Loaded<D>>(); // by key, least recently used first
	const running = new Map<string, Promise<Loaded<D>>>();
	let queue: Promise<unknown> = Promise.resolve(); // one extraction at a time

	const use = (key: string, l: Loaded<D>) => {
		loaded.delete(key);
		loaded.set(key, l);
		while (loaded.size > keep) loaded.delete(loaded.keys().next().value!);
		return l;
	};

	const get = (mods: M) => {
		const key = src.fileFor(mods);
		const l = loaded.get(key);
		if (l) return use(key, l);
		if (!running.has(key) && src.exists(key)) return use(key, { file: key, data: src.load(key) });
		return undefined;
	};

	const ensure = (mods: M): Promise<Loaded<D>> => {
		const key = src.fileFor(mods);
		const have = get(mods);
		if (have) return Promise.resolve(have);
		let run = running.get(key);
		if (!run) {
			run = queue
				.then(() => src.ensure(mods))
				.then((file) => {
					// a failed modded run gives the game's own data, which may be loaded already
					const same = [...loaded.values()].find((l) => l.file === file);
					return use(key, same ?? { file, data: src.load(file) });
				})
				.finally(() => running.delete(key));
			queue = run.catch(onError);
			running.set(key, run);
		}
		return run;
	};

	return {
		get,
		ensure,
		latest: () => [...loaded.values()].at(-1),
		pending: (mods) => running.has(src.fileFor(mods))
	};
}
