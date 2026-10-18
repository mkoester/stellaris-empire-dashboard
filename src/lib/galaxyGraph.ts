// The galaxy as a graph for distances: systems joined by hyperlanes and by the bypasses the
// country can use (wormholes, gateways, L-Gates). Every hyperlane jump and every bypass
// traversal counts as one jump, so a breadth-first search gives exact shortest distances; from
// several sources at once (all own systems) it gives each system's distance to the nearest
// border in one pass, O(systems + links).

/**
 * Bypass types ships path through, after 4.5.2's `common/bypass/00_bypasses.txt` — re-check on
 * game updates. `tech`: its `prerequisites`; `explore`: `requires_exploration`; `always`:
 * `always_active` (else the instance's `active` counts); `blockedBy`: global flags that close
 * it. L-Gates join by script (see `bypassLinks`). Left out: `quantum_catapult` (no pathfinding),
 * `relay_bypass` (synth-queen convoys only), `shroud_tunnel` (into the Shroud, no system) and
 * `entropy_wormhole` (crisis).
 */
export const BYPASS_RULES: Record<
	string,
	{ tech: string | null; explore: boolean; always: boolean; blockedBy?: string[] }
> = {
	wormhole: { tech: 'tech_wormhole_stabilization', explore: true, always: true },
	strange_wormhole: {
		tech: 'tech_rift_sphere',
		explore: true,
		always: true,
		blockedBy: ['strange_wormholes_locked', 'strange_wormhole_closed']
	},
	gateway: { tech: 'tech_gateway_activation', explore: false, always: false },
	gateway_ness: { tech: 'tech_gateway_activation', explore: false, always: false },
	starlit_wormhole: { tech: 'tech_wormhole_stabilization', explore: false, always: true },
	lgate: { tech: null, explore: false, always: false }
};

/** One bypass as the save lists it: its system and the bypasses it leads to. */
export type Bypass = {
	id: number;
	type: string;
	active: boolean;
	system: number | null;
	links: number[]; // `active_connections`, else `connections`, else `linked_to`
};
export type Link = { from: number; to: number; via: string };

/** The bypass links the country can use. */
export function bypassLinks(p: {
	bypasses: Bypass[];
	researched: string[];
	visited: number[]; // explored systems
	globalFlags: string[];
	lgateSystems: number[]; // systems with the star flag `lgate`
	lclusterSystems: number[]; // … `lcluster1`, the L-Cluster's entrance
}): Link[] {
	const byId = new Map(p.bypasses.map((b) => [b.id, b]));
	const visited = new Set(p.visited);
	const usable = (b: Bypass | undefined): b is Bypass & { system: number } => {
		const rule = b && BYPASS_RULES[b.type];
		return (
			!!rule &&
			b.system !== null &&
			(rule.tech === null || p.researched.includes(rule.tech)) &&
			(rule.always || b.active) &&
			!(rule.blockedBy ?? []).some((f) => p.globalFlags.includes(f))
		);
	};
	const out: Link[] = [];
	for (const b of p.bypasses) {
		if (b.type === 'lgate' || !usable(b)) continue;
		for (const id of b.links) {
			const to = byId.get(id);
			if (!usable(to) || to.type !== b.type) continue;
			// a wormhole has to be explored: known once a ship has been to either end
			if (BYPASS_RULES[b.type].explore && !visited.has(b.system) && !visited.has(to.system))
				continue;
			out.push({ from: b.system, to: to.system, via: b.type });
		}
	}
	// L-Gates: every L-Gate system to the L-Cluster, once they are opened for everyone
	if (p.globalFlags.includes('lgates_activated_globally'))
		for (const from of p.lgateSystems)
			for (const to of p.lclusterSystems) out.push({ from, to, via: 'lgate' });
	return out;
}

export type Graph = Map<number, { to: number; via: string | null }[]>;

/** Hyperlanes (`[a, b]` pairs) and bypass links, both directions. */
export function graph(lanes: [number, number][], links: Link[]): Graph {
	const g: Graph = new Map();
	const add = (a: number, b: number, via: string | null) => {
		if (!g.has(a)) g.set(a, []);
		g.get(a)!.push({ to: b, via });
	};
	for (const [a, b] of lanes) {
		add(a, b, null);
		add(b, a, null);
	}
	for (const l of links) {
		add(l.from, l.to, l.via);
		add(l.to, l.from, l.via);
	}
	return g;
}

export type Distances = {
	jumps: Map<number, number>; // reachable systems only
	via: (system: number) => string[]; // bypass types on one shortest path to it
};

/** Breadth-first from all `sources` at once (distance 0). */
export function distances(g: Graph, sources: Iterable<number>): Distances {
	const jumps = new Map<number, number>();
	const parent = new Map<number, { from: number; via: string | null }>();
	let frontier = [...new Set(sources)];
	for (const s of frontier) jumps.set(s, 0);
	for (let d = 1; frontier.length; d++) {
		const next: number[] = [];
		for (const s of frontier)
			for (const e of g.get(s) ?? [])
				if (!jumps.has(e.to)) {
					jumps.set(e.to, d);
					parent.set(e.to, { from: s, via: e.via });
					next.push(e.to);
				}
		frontier = next;
	}
	const via = (system: number) => {
		const out: string[] = [];
		for (let p = parent.get(system); p; p = parent.get(p.from)) if (p.via) out.unshift(p.via);
		return out;
	};
	return { jumps, via };
}
