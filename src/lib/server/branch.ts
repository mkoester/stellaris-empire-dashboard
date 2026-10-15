import { getDb } from './app.ts';
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
	return {
		tip,
		isHead: tip === headId(db),
		snaps,
		latest: snaps[snaps.length - 1],
		guessedLinks: path(all, tip).filter((n) => n.ambiguous).length
	};
}
