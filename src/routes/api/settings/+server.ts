import { error, json } from '@sveltejs/kit';
import { parsePatch } from '#lib/profiles.ts';
import { getDb } from '#lib/server/app.ts';
import { setSetting } from '#lib/server/db.ts';
import { updateProfile } from '#lib/server/settings.ts';
import { parseTheme } from '#lib/settings.ts';

// Stores the viewer settings a page changed. `{ theme }` is global; every other key is a setting
// of the profile in use (`ProfileSettings`, read by `SETTING_PARSERS` in #lib/profiles.ts):
// `{ tabs }` (the whole list), `{ chartEvents }` (entries merged into the stored map),
// `{ colonyView }`, `{ display }`, … Nothing is stored unless all of it reads.
export async function PUT({ request }) {
	const body = await request.json().catch(() => error(400, 'not JSON'));
	const theme = body?.theme === undefined ? undefined : parseTheme(body.theme);
	if (theme === null) error(400, 'unknown theme');
	const patch = parsePatch(body);
	if ('malformed' in patch) error(400, `malformed ${patch.malformed}`);
	const db = getDb();
	if (theme) setSetting(db, 'theme', theme);
	if (Object.keys(patch).length) updateProfile(db, patch);
	return json({ ok: true });
}
