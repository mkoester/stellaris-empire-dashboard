import type { KnownSystem, Snapshot } from '#lib/types.ts';
import { getDb } from './app.ts';
import { galaxyOf } from './db.ts';
import { display } from './settings.ts';

/**
 * The systems a map draws: the discovered ones (`knownSystems`: visited or own), or with the
 * `wholeGalaxy` switch every system of the campaign's galaxy.
 */
export function mapSystems(snaps: Snapshot[]): KnownSystem[] {
	const known = snaps.findLast((s) => s.knownSystems)?.knownSystems ?? [];
	const last = snaps.at(-1);
	const g = display().wholeGalaxy && last ? galaxyOf(getDb(), last.campaign) : null;
	if (!g) return known;
	const capital = known.find((k) => k.capital)?.id;
	return g.systems.map((s) => ({
		id: s.id,
		name: s.name,
		x: s.x,
		y: s.y,
		owned: s.owned,
		capital: s.id === capital,
		lanes: s.lanes
	}));
}
