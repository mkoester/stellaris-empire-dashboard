import { error, json } from '@sveltejs/kit';
import { parseView } from '#lib/colonyTable.ts';
import { parseContactView } from '#lib/contacts.ts';
import { parseDiplomacyView } from '#lib/diplomacy.ts';
import { parseExpansionView } from '#lib/expansion.ts';
import { parseMapFilter } from '#lib/mapLayers.ts';
import { parseMegaView } from '#lib/megastructures.ts';
import { parseSystemView } from '#lib/systems.ts';
import { parseProduceView } from '#lib/produce.ts';
import { parseDisplay } from '#lib/profiles.ts';
import { getDb } from '#lib/server/app.ts';
import { setSetting } from '#lib/server/db.ts';
import { updateProfile } from '#lib/server/settings.ts';
import { parseChartEvents, parseTabs, parseTheme } from '#lib/settings.ts';

// Stores the viewer settings a page changed. `{ theme }` is global; into the profile in use go
// `{ tabs }` (the whole list), `{ chartEvents }` (entries merged into the stored map),
// `{ colonyView }` (the colonies tab's mode, sort, filters and columns), `{ expansionView }`,
// `{ contactView }`, `{ diplomacyView }`, `{ megastructureView }`, `{ systemView }`, `{ produceView }`, `{ mapFilter }` and `{ display }`.
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
	if (body?.contactView !== undefined)
		updateProfile(getDb(), { contactView: parseContactView(body.contactView) });
	if (body?.diplomacyView !== undefined)
		updateProfile(getDb(), { diplomacyView: parseDiplomacyView(body.diplomacyView) });
	if (body?.megastructureView !== undefined)
		updateProfile(getDb(), { megastructureView: parseMegaView(body.megastructureView) });
	if (body?.systemView !== undefined)
		updateProfile(getDb(), { systemView: parseSystemView(body.systemView) });
	if (body?.produceView !== undefined)
		updateProfile(getDb(), { produceView: parseProduceView(body.produceView) });
	if (body?.mapFilter !== undefined)
		updateProfile(getDb(), { mapFilter: parseMapFilter(body.mapFilter) });
	if (body?.display !== undefined) updateProfile(getDb(), { display: parseDisplay(body.display) });
	return json({ ok: true });
}
