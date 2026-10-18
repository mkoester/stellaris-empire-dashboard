import { error, json } from '@sveltejs/kit';
import { parseView } from '#lib/colonyTable.ts';
import { parseExpansionView } from '#lib/expansion.ts';
import { parseDisplay } from '#lib/profiles.ts';
import { getDb } from '#lib/server/app.ts';
import { setSetting } from '#lib/server/db.ts';
import { updateProfile } from '#lib/server/settings.ts';
import { parseChartEvents, parseTabs, parseTheme } from '#lib/settings.ts';

// Stores the viewer settings a page changed. `{ theme }` is global; into the profile in use go
// `{ tabs }` (the whole list), `{ chartEvents }` (entries merged into the stored map),
// `{ colonyView }` (the colonies tab's mode, sort, filters and columns), `{ expansionView }` and
// `{ display }`.
export async function PUT({ request }) {
	const body = await request.json().catch(() => error(400, 'not JSON'));
	if (body?.theme !== undefined) {
		const theme = parseTheme(body.theme);
		if (!theme) error(400, 'unknown theme');
		setSetting(getDb(), 'theme', theme);
	}
	if (body?.tabs !== undefined) {
		const tabs = parseTabs(body.tabs);
		if (!tabs) error(400, 'malformed tabs');
		updateProfile(getDb(), { tabs });
	}
	if (body?.chartEvents !== undefined) {
		const chartEvents = parseChartEvents(body.chartEvents);
		if (!chartEvents) error(400, 'malformed chartEvents');
		updateProfile(getDb(), { chartEvents });
	}
	if (body?.colonyView !== undefined)
		updateProfile(getDb(), { colonyView: parseView(body.colonyView) });
	if (body?.expansionView !== undefined)
		updateProfile(getDb(), { expansionView: parseExpansionView(body.expansionView) });
	if (body?.display !== undefined) updateProfile(getDb(), { display: parseDisplay(body.display) });
	return json({ ok: true });
}
