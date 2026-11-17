// What one browser remembers for its viewer (`localStorage`): choices about the screen, not about
// the game, so they are not in the profile. A private window or blocked storage throws on every
// access: the choice then lasts for the page.

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const browser = (): Store => localStorage;

/** What is kept under `key`: null when nothing is, or storage is unavailable. */
export function recall(key: string, store: () => Store = browser): string | null {
	try {
		return store().getItem(key);
	} catch {
		return null;
	}
}

/** Keeps `value` under `key`, if the browser lets it. */
export function keep(key: string, value: string, store: () => Store = browser) {
	try {
		store().setItem(key, value);
	} catch {
		// storage unavailable
	}
}

/** A kept list of strings (`keepList`); [] when nothing is kept or it does not read. */
export function recallList(key: string, store: () => Store = browser): string[] {
	try {
		const v: unknown = JSON.parse(recall(key, store) ?? '[]');
		return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

export const keepList = (key: string, list: string[], store: () => Store = browser) =>
	keep(key, JSON.stringify(list), store);

type Keys = Pick<Storage, 'key' | 'length' | 'removeItem'>;
const keys = (): Keys => localStorage;

/** Forgets every kept key `test` picks (⚙'s resets): how many were kept. */
export function forget(test: (key: string) => boolean, store: () => Keys = keys): number {
	try {
		const s = store();
		const found = Array.from({ length: s.length }, (_, i) => s.key(i)).filter(
			(k): k is string => k !== null && test(k)
		);
		for (const k of found) s.removeItem(k);
		return found.length;
	} catch {
		return 0;
	}
}
