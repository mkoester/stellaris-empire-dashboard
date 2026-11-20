import type { EventChains, GameData, GalaxySystem } from './types.ts';

// The frontier tab's L-Gate and Precursors panels: what the empire's situation log holds of each
// (event chains, `docs/save-format.md`), as the game's own log shows it. Pure.

const LCLUSTER = 'l_cluster_chain';

export type LGateView = {
	encountered: boolean; // a first L-Gate found (`encountered_first_lgate`): insights count from here
	insights: number; // the chain's `clues`
	needed: number; // its maximum (7)
	complete: boolean; // all gathered (`completed_lcluster_chain`): L-Gate Activation can be researched
	activated: boolean; // L-Gate Activation researched
	gates: number; // L-Gates in systems we visited or own
	insightTech: boolean; // the repeatable L-Gate Insight tech is on offer now
	activationTech: boolean; // L-Gate Activation is on offer now
};

export function lgateView(p: {
	chains: EventChains | null;
	types: GameData['eventChains'];
	flags: readonly string[];
	researched: readonly string[];
	options: Record<string, string[]> | null;
	galaxy: GalaxySystem[];
}): LGateView {
	const needed = p.types[LCLUSTER]?.counters.find((c) => c.key === 'clues')?.max ?? 7;
	const done =
		p.chains?.completed.includes(LCLUSTER) || p.flags.includes('completed_lcluster_chain');
	const running = p.chains?.active.find((c) => c.key === LCLUSTER);
	const offered = new Set(Object.values(p.options ?? {}).flat());
	return {
		encountered: p.flags.includes('encountered_first_lgate'),
		insights: done ? needed : (running?.counters.clues ?? 0),
		needed,
		complete: !!done,
		activated: p.researched.includes('tech_lgate_activation'),
		gates: p.galaxy.filter(
			(s) => (s.visited || s.owned) && (s.bypasses ?? []).some((b) => /^lgate/.test(b))
		).length,
		insightTech: offered.has('tech_repeatable_lcluster_clue'),
		activationTech: offered.has('tech_lgate_activation')
	};
}

export type PrecursorRow = {
	key: string;
	name: string; // "The Cybrex": the chain's title without its "Precursors - "
	artifacts: number | null; // its counter, null where it has none (the Inetian Traders)
	needed: number | null;
	done: boolean;
	homeworld: 'none' | 'found' | 'done'; // `<x>_homeworld_chain`: running or completed
};

/** Every precursor chain we started (the situation log's category `precursors`), its artifacts
 * and its home system's chain. A precursor nobody found stays out: which ones a galaxy has is the
 * game's secret until then. */
export function precursorRows(
	chains: EventChains | null,
	types: GameData['eventChains']
): PrecursorRow[] {
	if (!chains) return [];
	const active = new Map(chains.active.map((c) => [c.key, c.counters]));
	const completed = new Set(chains.completed);
	return Object.entries(types)
		.filter(
			([k, t]) =>
				t.category === 'precursors' &&
				!k.endsWith('_homeworld_chain') &&
				(active.has(k) || completed.has(k))
		)
		.map(([k, t]) => {
			const counter = t.counters[0] ?? null;
			const done = completed.has(k);
			const home = k.replace(/_chain$/, '_homeworld_chain');
			return {
				key: k,
				name: (t.title ?? k).replace(/^Precursors - /, ''),
				artifacts: counter
					? done && counter.max !== null
						? counter.max
						: (active.get(k)?.[counter.key] ?? 0)
					: null,
				needed: counter?.max ?? null,
				done,
				homeworld: completed.has(home) ? 'done' : active.has(home) ? 'found' : 'none'
			};
		});
}
