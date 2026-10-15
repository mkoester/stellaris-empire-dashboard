import { getDb } from '#lib/server/app.ts';
import { headId, history, nodes } from '#lib/server/db.ts';
import { path } from '#lib/timeline.ts';
import {
	popSeries,
	researchSeries,
	resourceSeries,
	scalarSeries,
	withoutResearch,
	xRange
} from '#lib/series.ts';

// Shows the branch ending at ?node=<id>, or at the head (the state last seen from the game).
export function load({ url }) {
	const db = getDb();
	const all = nodes(db);
	const requested = Number(url.searchParams.get('node'));
	const tip = all.some((n) => n.id === requested) ? requested : headId(db);
	if (tip === null) return { empty: true as const };

	const snaps = history(db, tip);
	const latest = snaps[snaps.length - 1];
	return {
		empty: false as const,
		tip,
		isHead: tip === headId(db),
		latest,
		guessedLinks: path(all, tip).filter((n) => n.ambiguous).length,
		xRange: xRange(snaps),
		charts: {
			pops: popSeries(snaps),
			empireSize: scalarSeries(snaps, 'empire size', (s) => s.empireSize),
			research: researchSeries(snaps),
			stockpile: resourceSeries(snaps, (s) => withoutResearch(s.stockpile)),
			balance: resourceSeries(snaps, (s) => withoutResearch(s.balance)),
			income: resourceSeries(snaps, (s) => withoutResearch(s.income))
		}
	};
}
