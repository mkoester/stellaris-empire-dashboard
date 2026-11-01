import { emptyTabs } from '#lib/tabData.ts';
import { getDb } from './app.ts';
import { history } from './db.ts';

let memo: { tip: number; empty: Record<string, string> } | null = null;

/** For the tab bar, at `tip`: the tabs with nothing to show yet, each with why. Kept per tip. */
export function emptyTabsAt(tip: number | null): Record<string, string> {
	if (tip === null) return {};
	if (memo?.tip === tip) return memo.empty;
	const empty = emptyTabs(history(getDb(), tip));
	memo = { tip, empty };
	return empty;
}
