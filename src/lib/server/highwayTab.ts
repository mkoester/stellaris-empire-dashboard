import { getDb } from './app.ts';
import { history } from './db.ts';

let memo: { tip: number; shown: boolean } | null = null;

/**
 * For the tab bar, at `tip`: whether the highway tab shows — only in a campaign with the Ancient
 * Highway mod (the branch's latest save has a highway). Kept per tip: the layout asks on every page.
 */
export function highwayTab(tip: number | null): boolean {
	if (tip === null) return false;
	if (memo?.tip === tip) return memo.shown;
	const shown = !!history(getDb(), tip).findLast((s) => s.kind === 'save')?.highway;
	memo = { tip, shown };
	return shown;
}
