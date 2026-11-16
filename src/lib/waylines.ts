import { evaluate, type Facts, type Trigger } from './triggers.ts';
import type { StarbasePart } from './starbasePlanner.ts';
import type { GalaxySystem, Resources } from './types.ts';

// A nomad's waystations and waylines (the user's ask 2026-11-16: "where would I build
// waystations, which modules — only 2 slots at the start, so choose wisely —, where would I make
// best use of waylines, where might I get in trouble for collection with other empires"). From
// the 4.5.4 game files:
// - a waystation (starbase level `starbase_level_waystation_1..3`) holds modules only, 2/4/6 slots
//   (common/starbase_levels/05_waystation_levels.txt); it collects the system's own orbital
//   deposits, per module (`collected_system_resources`, common/starbase_modules/
//   00_waystation_modules.txt), × 0.75 / 1 / 1.25 by tier (common/ship_sizes/00_waystations.txt,
//   `starbase_collected_system_resources_mult`);
// - one waystation per system, whoever builds it; it claims no space;
// - a wayline is waystations in neighbouring systems (one hyperlane apart) — the save keeps them as
//   `waystation_networks`, which matched that for all five networks of `roamingcybergang` 2213.08;
//   a module's `waystation_network_*` modifiers reach every system and country on it;
// - in another empire's space without a Wayline Pact, a collecting module costs the owner's own
//   stations there 25 % of that resource (`waystation_collection_penalty_*_tt`), each waystation is
//   −10 opinion with them down to −200 (Unlicensed Waystations, common/opinion_modifiers/
//   00_opinion_modifiers_nomads_dlc.txt) and they gain the Expel Nomads war goal
//   (common/casus_belli/07_nomads_casus_belli.txt).
// Pure.

/** What each waystation module collects from its system's deposits (`collected_system_resources`). */
export const COLLECTS: Record<string, string[]> = {
	waystation_energy_module: ['energy'],
	waystation_mining_module: ['minerals', 'food', 'consumer_goods', 'alloys'],
	waystation_refinery_module: ['volatile_motes', 'exotic_gases', 'rare_crystals'],
	// the rare ones (dark matter, living metal, zro, nanites, artifacts, threads) only with their tech
	waystation_research_module: [
		'physics_research',
		'society_research',
		'engineering_research',
		'unity',
		'minor_artifacts',
		'astral_threads',
		'sr_dark_matter',
		'sr_living_metal',
		'sr_zro',
		'nanites'
	],
	waystation_trade_module: ['trade']
};

/** The module that collects a resource, or null. */
export const collectorOf = (resource: string): string | null =>
	Object.entries(COLLECTS).find(([, rs]) => rs.includes(resource))?.[0] ?? null;

export const TIER_FACTOR = [0.75, 1, 1.25];
export const TIER_SLOTS = [2, 4, 6];
/** A waystation's tier from its level (`waystation_2`), 1…3. */
export const tierOf = (level: string): number =>
	Math.min(3, Math.max(1, Number(/waystation_(\d)/.exec(level)?.[1] ?? 1)));

const T: Trigger = { leaf: 'always', value: 'yes' };
const F: Trigger = { leaf: 'always', value: 'no' };
const constant = (v: boolean, value: string) => ((value === 'no' ? !v : v) ? T : F);

/** A module's trigger with the starbase's own leaves answered for a waystation of ours. */
export function atWaystation(t: Trigger | null): Trigger | null {
	if (t === null) return null;
	if (!('leaf' in t)) return { op: t.op, args: t.args.map((a) => atWaystation(a) ?? T) };
	if (t.leaf === 'is_waystation_starbase') return constant(true, t.value);
	if (/is_normal_starbase|orbital_ring|space_citadel|arkship/.test(t.leaf))
		return constant(false, t.value);
	if (t.leaf === 'exists' && t.value === 'owner') return T;
	return t;
}

/** The waystation modules this empire can build at all (`potential`); null: the save cannot tell. */
export function waystationModules(
	parts: Record<string, StarbasePart>,
	f: Facts
): { part: StarbasePart; available: boolean | null }[] {
	return Object.values(parts)
		.filter((p) => p.kind === 'module' && p.key.startsWith('waystation_'))
		.flatMap((part) => {
			const available = evaluate(atWaystation(part.potential), f);
			return available === false ? [] : [{ part, available }];
		});
}

/** What one unit of a resource is worth in trade, for ranking (#lib/value.ts). */
export type Worth = (resource: string) => number;

/**
 * A system's station deposits: the base output a month of the orbital deposits on its surveyed,
 * uncolonised bodies (a colony's deposits are its own).
 */
export function siteDeposits(
	s: GalaxySystem,
	data: {
		depositCategory: Record<string, string | null>;
		produces: (deposit: string) => Resources | undefined;
	}
): Resources {
	const out: Resources = {};
	for (const b of s.bodies ?? []) {
		if (b.colonized || b.surveyed === false) continue;
		for (const d of b.deposits) {
			if (!/^orbital_/.test(data.depositCategory[d] ?? '')) continue;
			for (const [r, v] of Object.entries(data.produces(d) ?? {})) out[r] = (out[r] ?? 0) + v;
		}
	}
	return out;
}

export type ModulePick = {
	key: string;
	name: string;
	collects: Resources; // a month, at the tier
	worth: number; // collects × worth
	wayline: boolean; // has modifiers along the whole wayline
	maybe: boolean; // the save cannot tell whether the empire may build it
	built: boolean;
};

/**
 * Every module that would do something at a waystation of `tier` over these deposits, best first:
 * collectors by what they collect here (none where the system has nothing for them — the game
 * refuses those), then flat `starbase_collected_system_<r>_add` the empire qualifies for (the
 * Hydroponics Bay's food), then the wayline modules — worth nothing locally, but each of their
 * effects reaches the whole wayline, so one per wayline (`onLine`) is enough.
 */
export function modulePicks(
	deposits: Resources,
	modules: { part: StarbasePart; available: boolean | null }[],
	f: Facts,
	worth: Worth,
	tier: number,
	built: string[] = [],
	onLine: Set<string> = new Set()
): ModulePick[] {
	const factor = TIER_FACTOR[tier - 1] ?? 1;
	const out: ModulePick[] = [];
	for (const { part, available } of modules) {
		const collects: Resources = {};
		for (const r of COLLECTS[part.key] ?? []) if (deposits[r]) collects[r] = deposits[r] * factor;
		for (const m of part.modifiers) {
			const flat = /^starbase_collected_system_(\w+)_add$/.exec(m.key);
			if (!flat || m.scope !== 'station') continue;
			if (evaluate(atWaystation(m.when), f) !== true) continue;
			collects[flat[1]] = (collects[flat[1]] ?? 0) + m.value * factor;
		}
		const wayline = part.modifiers.some((m) => m.scope.startsWith('waystation_network'));
		const value = Object.entries(collects).reduce((t, [r, v]) => t + v * worth(r), 0);
		if (value <= 0 && !(wayline && !onLine.has(part.key))) continue;
		out.push({
			key: part.key,
			name: part.name,
			collects,
			worth: value,
			wayline,
			maybe: available === null,
			built: built.includes(part.key)
		});
	}
	return out.sort((a, b) => b.worth - a.worth || Number(a.wayline) - Number(b.wayline));
}

/** The best modules for the free slots: collectors first (worth > 0), then wayline modules. */
export function bestModules(picks: ModulePick[], slots: number): ModulePick[] {
	return picks.filter((p) => !p.built).slice(0, Math.max(0, slots));
}

type Lanes = Pick<GalaxySystem, 'id' | 'lanes'>[];

/** Neighbours by hyperlane, both directions. */
export function neighbours(systems: Lanes): Map<number, number[]> {
	const out = new Map<number, number[]>();
	const add = (a: number, b: number) => out.set(a, [...(out.get(a) ?? []), b]);
	for (const s of systems)
		for (const to of s.lanes) {
			add(s.id, to);
			add(to, s.id);
		}
	return out;
}

/** Waylines: waystation systems connected through neighbouring waystation systems. */
export function networks(next: Map<number, number[]>, waystations: Iterable<number>): number[][] {
	const set = new Set(waystations);
	const seen = new Set<number>();
	const out: number[][] = [];
	for (const start of set) {
		if (seen.has(start)) continue;
		const group: number[] = [];
		const stack = [start];
		seen.add(start);
		while (stack.length) {
			const at = stack.pop()!;
			group.push(at);
			for (const n of next.get(at) ?? [])
				if (set.has(n) && !seen.has(n)) {
					seen.add(n);
					stack.push(n);
				}
		}
		out.push(group.sort((a, b) => a - b));
	}
	return out.sort((a, b) => b.length - a.length || a[0] - b[0]);
}

/** Which of the waylines a waystation in `system` would join (it neighbours one of theirs). */
export function touches(next: Map<number, number[]>, lines: number[][], system: number): number[] {
	const near = new Set([system, ...(next.get(system) ?? [])]);
	return lines.flatMap((l, i) => (l.some((x) => near.has(x)) ? [i] : []));
}

/**
 * The systems between the nearest of `from` and `to` that would carry the wayline there: the
 * shortest hyperlane path, without its ends; null when `to` cannot be reached, or `from` is empty.
 * `blocked` systems cannot hold a waystation of ours (someone else's is there).
 */
export function chainTo(
	next: Map<number, number[]>,
	from: Iterable<number>,
	to: number,
	blocked: Set<number> = new Set()
): number[] | null {
	const start = [...from];
	if (!start.length) return null;
	if (start.includes(to)) return [];
	const parent = new Map<number, number>();
	const seen = new Set(start);
	let frontier = start;
	while (frontier.length && !seen.has(to)) {
		const step: number[] = [];
		for (const at of frontier)
			for (const n of next.get(at) ?? []) {
				if (seen.has(n) || (blocked.has(n) && n !== to)) continue;
				seen.add(n);
				parent.set(n, at);
				step.push(n);
			}
		frontier = step;
	}
	if (!seen.has(to)) return null;
	const path: number[] = [];
	for (let p = parent.get(to); p !== undefined && parent.has(p); p = parent.get(p)) path.unshift(p);
	return path;
}

/**
 * Where on a wayline to collect: the station from which the others are fewest jumps away along the
 * line (a Logistics Hub collects the whole wayline's stockpile there, 4.5.4).
 */
export function collectionPoint(next: Map<number, number[]>, line: number[]): number | null {
	if (!line.length) return null;
	const on = new Set(line);
	let best: { id: number; far: number; sum: number } | null = null;
	for (const s of line) {
		const jumps = new Map([[s, 0]]);
		let frontier = [s];
		for (let d = 1; frontier.length; d++) {
			const step: number[] = [];
			for (const at of frontier)
				for (const n of next.get(at) ?? [])
					if (on.has(n) && !jumps.has(n)) {
						jumps.set(n, d);
						step.push(n);
					}
			frontier = step;
		}
		const far = Math.max(...jumps.values());
		const sum = [...jumps.values()].reduce((t, v) => t + v, 0);
		if (!best || far < best.far || (far === best.far && sum < best.sum)) best = { id: s, far, sum };
	}
	return best!.id;
}

export type Trouble =
	| { kind: 'none' }
	| { kind: 'taken'; ownerId: number } // someone else's waystation is there
	| { kind: 'pact'; ownerId: number } // their space, with a Wayline Pact
	| { kind: 'unlicensed'; ownerId: number }; // their space, without one

/** What a waystation of ours in this system means with the empire whose space it is. */
export function trouble(s: GalaxySystem, me: number, pacts: Set<number>): Trouble {
	if (s.waystation !== undefined && s.waystation !== me)
		return { kind: 'taken', ownerId: s.waystation };
	if (s.ownerId === null || s.ownerId === me) return { kind: 'none' };
	return pacts.has(s.ownerId)
		? { kind: 'pact', ownerId: s.ownerId }
		: { kind: 'unlicensed', ownerId: s.ownerId };
}

/** Opinion per waystation without a pact, and its floor (script_values/08_script_values_nomads.txt). */
export const UNLICENSED_OPINION = -10;
export const UNLICENSED_FLOOR = -200;

/** Per empire, our waystations in its space without a pact: how many, and the opinion they cost. */
export function unlicensed(
	systems: GalaxySystem[],
	ours: Iterable<number>,
	me: number,
	pacts: Set<number>
): Map<number, { count: number; opinion: number }> {
	const byId = new Map(systems.map((s) => [s.id, s]));
	const out = new Map<number, { count: number; opinion: number }>();
	for (const id of ours) {
		const s = byId.get(id);
		const t = s ? trouble(s, me, pacts) : null;
		if (t?.kind !== 'unlicensed') continue;
		const count = (out.get(t.ownerId)?.count ?? 0) + 1;
		out.set(t.ownerId, {
			count,
			opinion: Math.max(UNLICENSED_FLOOR, count * UNLICENSED_OPINION)
		});
	}
	return out;
}
