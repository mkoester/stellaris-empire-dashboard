import { error, json } from '@sveltejs/kit';
import { getDb } from '#lib/server/app.ts';
import { setSetting } from '#lib/server/db.ts';
import { parseTabs, parseTheme } from '#lib/settings.ts';

// Stores the viewer settings a page changed: `{ theme }`, `{ tabs }` (the whole list), or both.
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
		setSetting(getDb(), 'tabs', tabs);
	}
	return json({ ok: true });
}
