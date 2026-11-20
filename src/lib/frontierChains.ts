import type { EventChains, GameData, GalaxySystem, PrecursorIntel } from './types.ts';

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

// Every precursor the game knows (4.5.4): its galaxy-setup key and star flag, its chain, a name
// for where the data DB has no title. Zroni come from dig sites and have no chain.
export const PRECURSORS: { flag: string; chain: string | null; name: string }[] = [
	{ flag: 'precursor_1', chain: 'vultaum_chain', name: 'The Vultaum' },
	{ flag: 'precursor_2', chain: 'yuht_chain', name: 'The Yuht' },
	{ flag: 'precursor_3', chain: 'first_league_chain', name: 'The First League' },
	{ flag: 'precursor_4', chain: 'irassian_chain', name: 'The Irassians' },
	{ flag: 'precursor_5', chain: 'cybrex_chain', name: 'The Cybrex' },
	{ flag: 'precursor_baol_1', chain: 'baol_chain', name: 'The Baol' },
	{ flag: 'precursor_zroni_1', chain: null, name: 'The Zroni' },
	{ flag: 'precursor_inetian', chain: 'cs_inetian_chain', name: 'The Inetian Traders' },
	{ flag: 'precursor_adakkaria', chain: 'cs_adAkkaria_chain', name: 'The adAkkaria' }
];

export type PrecursorGalaxyRow = {
	flag: string;
	name: string;
	enabled: boolean; // not in the galaxy setup's `disabled_precursors`
	systems: number | null; // systems with its star flag; null where it has none of its own
	visited: number | null; // of those, the ones we visited or own
	empires: {
		country: string;
		us: boolean;
		artifacts: number | null;
		needed: number | null;
		done: boolean;
		homeworld: 'none' | 'found' | 'done';
	}[];
};

/** The cheat: every precursor, whether this galaxy has it, its systems and who collects it. */
export function precursorGalaxy(
	intel: PrecursorIntel,
	types: GameData['eventChains'],
	known: (systemId: number) => boolean,
	us: number
): PrecursorGalaxyRow[] {
	const disabled = new Set(intel.disabled);
	return PRECURSORS.map((p) => {
		const own = intel.systems[p.flag];
		const counter = p.chain ? (types[p.chain]?.counters[0] ?? null) : null;
		const home = p.chain?.replace(/_chain$/, '_homeworld_chain');
		const of = (id: number) => intel.chains.filter((c) => c.countryId === id);
		const ids = [
			...new Set(
				intel.chains.filter((c) => c.key === p.chain || c.key === home).map((c) => c.countryId)
			)
		];
		return {
			flag: p.flag,
			name: (p.chain && types[p.chain]?.title?.replace(/^Precursors - /, '')) || p.name,
			enabled: !disabled.has(p.flag),
			systems: own ? own.length : p.flag.match(/^precursor_\d$/) ? 0 : null,
			visited: own ? own.filter(known).length : p.flag.match(/^precursor_\d$/) ? 0 : null,
			empires: ids.map((id) => {
				const cs = of(id);
				const chain = cs.find((c) => c.key === p.chain);
				const homes = cs.filter((c) => c.key === home);
				const done = !!chain?.done;
				return {
					country: cs[0].country,
					us: id === us,
					artifacts: counter
						? done && counter.max !== null
							? counter.max
							: (chain?.counters[counter.key] ?? 0)
						: null,
					needed: counter?.max ?? null,
					done,
					homeworld: homes.some((h) => h.done) ? 'done' : homes.length ? 'found' : 'none'
				};
			})
		};
	});
}
