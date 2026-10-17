import {
	parseChartEvents,
	parseTabs,
	parseTheme,
	type ChartEvents,
	type CustomTab,
	type Theme
} from '#lib/settings.ts';
import { getDb } from './app.ts';
import { getSetting } from './db.ts';

// The stored viewer settings, falling back to the defaults when unset or unreadable.
export const theme = (): Theme => parseTheme(getSetting(getDb(), 'theme')) ?? 'system';
export const tabs = (): CustomTab[] => parseTabs(getSetting(getDb(), 'tabs')) ?? [];
// Colony charts were stored as `planet:<title>` before the rename.
export const chartEvents = (): ChartEvents =>
	Object.fromEntries(
		Object.entries(parseChartEvents(getSetting(getDb(), 'chartEvents')) ?? {}).map(([k, v]) => [
			k.replace(/^planet:/, 'colony:'),
			v
		])
	);
