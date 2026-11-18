import { facts } from './government.ts';
import { evaluate, type Facts, type Trigger } from './triggers.ts';
import type { GameData, Snapshot } from './types.ts';

// Tradition swaps (data DB `tradition_swap`): a tradition or ascension perk the game replaces
// with a variant when its trigger holds — a nomad's Mastery of Nature raises harvest output and
// unlocks no planet decision, Voidborne and Shared Destiny change for nomads, gestalts and DLCs
// rename others (4.5.4 `common/ascension_perks/00_ascension_perks.txt`, `common/traditions/`).
// The variant's modifiers are stored under its id (`<owner>#<n>`); `inherit_effects` keeps the
// owner's. Pure.

export type Swap = {
	id: string; // `<owner>#<n>`
	name: string | null;
	trigger: Trigger | null;
	inherit: boolean; // the owner's modifiers apply, not the swap's own
};

/** The swap the game shows for `key`: the first whose trigger holds; null for none or unknown. */
export function activeSwap(swaps: Swap[] | undefined, f: Facts): Swap | null {
	for (const s of swaps ?? []) {
		const v = evaluate(s.trigger, f);
		if (v === null) return null; // an earlier swap may hold: cannot tell
		if (v) return s;
	}
	return null;
}

/**
 * How an empire's held traditions and perks are looked up: `shown` names the explanation
 * (the swap's own name, text and effects), `source` the modifier owner (the swap's id unless
 * it inherits the owner's effects).
 */
export function swapLookup(all: Record<string, Swap[]>, f: Facts) {
	const cache = new Map<string, Swap | null>();
	const swapOf = (key: string) => {
		if (!cache.has(key)) cache.set(key, activeSwap(all[key], f));
		return cache.get(key)!;
	};
	return {
		shown: (key: string) => swapOf(key)?.id ?? key,
		source: (key: string) => {
			const s = swapOf(key);
			return s && !s.inherit ? s.id : key;
		}
	};
}

export type SwapLookup = ReturnType<typeof swapLookup>;

/** No swaps: every key is itself. */
export const NO_SWAPS: SwapLookup = { shown: (k) => k, source: (k) => k };

/**
 * Explanations picked for a page with each `tradition:`/`perk:` id the empire sees swapped
 * replaced by its swap's (`all` holds those under `<kind>:<swap id>`, #lib/server/explain.ts).
 */
export function swapExplanations<T>(
	picked: Record<string, T>,
	all: Record<string, T>,
	swaps: SwapLookup
): Record<string, T> {
	const out = { ...picked };
	for (const id of Object.keys(picked)) {
		const m = /^(tradition|perk):(.+)$/.exec(id);
		if (!m) continue;
		const swapped = `${m[1]}:${swaps.shown(m[2])}`;
		if (swapped !== id && all[swapped]) out[id] = all[swapped];
	}
	return out;
}

/** The swaps an empire sees, from its snapshot (none without one). */
export function empireSwaps(
	s: Snapshot | null | undefined,
	data: Pick<GameData, 'traditionSwaps' | 'scriptedTriggers' | 'shipKinds'>
): SwapLookup {
	if (!s) return NO_SWAPS;
	return swapLookup(
		data.traditionSwaps ?? {},
		facts(s, data.scriptedTriggers, { shipKinds: data.shipKinds })
	);
}
