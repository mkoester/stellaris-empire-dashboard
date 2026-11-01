import { galaxyRadii } from '#lib/quadrants.ts';
import { mainNetwork } from '#lib/situations.ts';
import { getDb } from './app.ts';
import { galaxyOf } from './db.ts';

const memo = new Map<string, { inner: number; outer: number }>();

/**
 * The campaign's inner and outer ring around the core, from every system on the main hyperlane
 * network — not the special systems off it, nor the L-Cluster, which may lie outside. The game
 * shows every star from the start, so this reveals nothing. Kept per campaign: the galaxy's
 * extent does not change once generated.
 */
export function galaxyRings(campaign: string | null): { inner: number; outer: number } | null {
	if (campaign === null) return null;
	const kept = memo.get(campaign);
	if (kept) return kept;
	const systems = galaxyOf(getDb(), campaign)?.systems;
	if (!systems?.length) return null;
	const main = mainNetwork(systems);
	const r = galaxyRadii(systems.filter((s) => main.has(s.id) && !s.lcluster));
	if (r) memo.set(campaign, r);
	return r;
}
