import { getDb } from '#lib/server/app.ts';
import { activeProfile, chartEvents, tabs, theme } from '#lib/server/settings.ts';

export function load() {
	const { id, name } = activeProfile(getDb());
	return { theme: theme(), tabs: tabs(), chartEvents: chartEvents(), profile: { id, name } };
}
