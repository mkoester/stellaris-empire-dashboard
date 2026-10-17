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
export const chartEvents = (): ChartEvents =>
	parseChartEvents(getSetting(getDb(), 'chartEvents')) ?? {};
