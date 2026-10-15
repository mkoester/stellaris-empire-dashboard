import { upcoming } from '#lib/events.ts';
import { getDb, getGameData } from './app.ts';
import { headId, history, nodes } from './db.ts';
import { path } from '#lib/timeline.ts';

/**
 * The branch a page shows: ending at ?node=<id>, or at the head (the state last seen from the
 * game). Null before the first save.
 */
export function branch(url: URL) {
	const db = getDb();
	const all = nodes(db);
	const requested = Number(url.searchParams.get('node'));
	const tip = all.some((n) => n.id === requested) ? requested : headId(db);
	if (tip === null) return null;
	const snaps = history(db, tip);
	// Events come from the latest full save; the one before it gives the rates.
	const saves = snaps.filter((s) => s.progress !== null);
	const last = saves.at(-1);
	return {
		upcoming: last ? upcoming(last, saves.at(-2) ?? null, getGameData()) : [],
		tip,
		isHead: tip === headId(db),
		snaps,
		latest: snaps[snaps.length - 1],
		guessedLinks: path(all, tip).filter((n) => n.ambiguous).length
	};
}
