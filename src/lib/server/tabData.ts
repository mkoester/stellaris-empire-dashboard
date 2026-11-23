import { emptyTabs, megastructuresEmpty } from '#lib/tabData.ts';
import { getDb, getGameData } from './app.ts';
import { galaxyOf, history } from './db.ts';

let memo: { tip: number; empty: Record<string, string> } | null = null;

/**
 * For the tab bar, at `tip`: the tabs with nothing to show yet, each with why. Kept per tip (the
 * galaxy is written with each save, which moves the tip).
 */
export function emptyTabsAt(tip: number | null): Record<string, string> {
	if (tip === null) return {};
	if (memo?.tip === tip) return memo.empty;
	const db = getDb();
	const snaps = history(db, tip);
	const campaign = snaps.at(-1)?.campaign;
	// the galaxy as read, not as the display switches reveal it
	const mega = megastructuresEmpty(
		snaps,
		campaign ? (galaxyOf(db, campaign)?.systems ?? null) : null
	);
	const empty = {
		...emptyTabs(snaps, getGameData().contractTypes),
		...(mega ? { megastructures: mega } : {})
	};
	memo = { tip, empty };
	return empty;
}
