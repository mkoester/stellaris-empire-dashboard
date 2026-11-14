import { SYSTEM_RANGES } from './systems.ts';
import type { Station } from './types.ts';

// The starbases tab (the user's ask 2026-11-09: "overview of my starbases — maybe separate
// regular ones and shipyards like in the outliner, or add a toggle"): which starbases a view
// shows, and the slots each has left. Pure.

/** Which starbases: all, those with a shipyard, those without. */
export const YARD_FILTERS = ['all', 'yards', 'plain'] as const;
export type YardFilter = (typeof YARD_FILTERS)[number];
export const YARD_LABELS: Record<YardFilter, string> = {
	all: 'all',
	yards: 'shipyards',
	plain: 'without shipyard'
};

export type StarbaseView = {
	yard: YardFilter;
	outposts: boolean; // show outposts (level `outpost`): many, and nothing to build on them
	range: string; // the planner's: SYSTEM_RANGES — 'mine' | '1'…'10' beyond the border | 'all'
};
export const DEFAULT_STARBASE_VIEW: StarbaseView = { yard: 'all', outposts: false, range: 'mine' };

export function parseStarbaseView(v: unknown): StarbaseView {
	const o = (v && typeof v === 'object' ? v : {}) as Partial<StarbaseView>;
	return {
		yard: YARD_FILTERS.includes(o.yard as YardFilter)
			? (o.yard as YardFilter)
			: DEFAULT_STARBASE_VIEW.yard,
		outposts: typeof o.outposts === 'boolean' ? o.outposts : DEFAULT_STARBASE_VIEW.outposts,
		range: SYSTEM_RANGES.includes(o.range as string)
			? (o.range as string)
			: DEFAULT_STARBASE_VIEW.range
	};
}

export const isOutpost = (s: Station) => s.level === 'outpost';

/** The starbases a view shows, in the save's order. */
export const shownStations = (stations: Station[], v: StarbaseView): Station[] =>
	stations.filter(
		(s) =>
			(v.outposts || !isOutpost(s)) &&
			(v.yard === 'all' || (v.yard === 'yards') === (s.shipyard !== null))
	);

export type Slots = Record<string, { modules: number; buildings: number }>;

/**
 * How many modules and buildings a starbase level holds. **4.5 counts them from the level's ship
 * size** (`starbase_module_capacity_add`, `starbase_building_capacity_add` in its modifiers;
 * checked 2026-11-09 on 4.5.3): the level's `module_slots|building_slots` only list slot keys, of
 * "at least the correct size" (`starbase_levels/00_documentation.txt`). In vanilla the two agree;
 * mods change the ship size (Slightly Larger Starbases [4.5]: a starport's modules 2 → 3, Outpost
 * Slots: an outpost's 0 → 1). Without a capacity (a level without one, an older data DB) the list.
 */
export function levelSlots(
	listed: { modules: number; buildings: number },
	sizeModifiers: Record<string, number> | null
): { modules: number; buildings: number } {
	return {
		modules: sizeModifiers?.starbase_module_capacity_add ?? listed.modules,
		buildings: sizeModifiers?.starbase_building_capacity_add ?? listed.buildings
	};
}

/**
 * Module and building slots a starbase has left: its level's (`levelSlots()`, keyed without
 * `starbase_level_`) less what is built; null where the level is not in the data DB
 * (a mod's, or an older data DB). Queued items are not taken off: they show in the queue.
 */
export function freeSlots(
	s: Station,
	slots: Slots
): { modules: number | null; buildings: number | null } {
	const l = slots[s.level];
	return l
		? {
				modules: Math.max(0, l.modules - s.modules.length),
				buildings: Math.max(0, l.buildings - s.buildings.length)
			}
		: { modules: null, buildings: null };
}
