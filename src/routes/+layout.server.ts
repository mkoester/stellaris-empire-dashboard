import { chartEvents, tabs, theme } from '#lib/server/settings.ts';

export function load() {
	return { theme: theme(), tabs: tabs(), chartEvents: chartEvents() };
}
