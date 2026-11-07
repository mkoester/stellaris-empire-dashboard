import type { SlaveMarketMode } from '#lib/profiles.ts';
import { slaveTabShown } from '#lib/slaveMarket.ts';
import { getDb } from './app.ts';
import { history } from './db.ts';

let memo: { tip: number; mode: SlaveMarketMode; shown: boolean } | null = null;

/**
 * For the tab bar, at `tip`: whether the slave market tab shows (`slaveTabShown()`, from the
 * branch's latest save). Kept per tip and mode: the layout asks on every page.
 */
export function slaveTab(tip: number | null, mode: SlaveMarketMode): boolean {
	if (tip === null) return false;
	if (memo?.tip === tip && memo.mode === mode) return memo.shown;
	const shown = slaveTabShown(
		history(getDb(), tip).findLast((s) => s.kind === 'save'),
		mode
	);
	memo = { tip, mode, shown };
	return shown;
}
