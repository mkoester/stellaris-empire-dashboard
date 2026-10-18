import { mapView } from '#lib/situations.ts';
import type { KnownSystem, Snapshot } from '#lib/types.ts';
import { getDb } from './app.ts';
import { galaxyOf } from './db.ts';
import { display } from './settings.ts';

/**
 * The systems a map draws: the discovered ones (`knownSystems`: visited or own), plus with the
 * `unknownStars` switch every other star (no lanes), or with `wholeGalaxy` everything.
 */
export function mapSystems(snaps: Snapshot[]): (KnownSystem & { known?: boolean })[] {
	const known = snaps.findLast((s) => s.knownSystems)?.knownSystems ?? [];
	const { wholeGalaxy: whole, unknownStars: stars } = display();
	const last = snaps.at(-1);
	const g = (whole || stars) && last ? galaxyOf(getDb(), last.campaign) : null;
	if (!g) return known;
	const capital = known.find((k) => k.capital)?.id;
	return mapView(g.systems, { whole, stars }).map((s) => ({ ...s, capital: s.id === capital }));
}
