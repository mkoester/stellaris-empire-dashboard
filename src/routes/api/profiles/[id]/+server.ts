import { error } from '@sveltejs/kit';
import { exportFile, parseSettings } from '#lib/profiles.ts';
import { getDb } from '#lib/server/app.ts';
import { getSetting } from '#lib/server/db.ts';
import { profiles } from '#lib/server/settings.ts';

// A profile as a file to keep or to import elsewhere.
export function GET({ params }) {
	const db = getDb();
	const p = profiles(db).find((x) => x.id === params.id);
	if (!p) error(404, 'unknown profile');
	const file = exportFile(p.name, parseSettings(getSetting(db, `profile:${p.id}`)));
	const name = p.name.replace(/[^\w .()-]/g, '_');
	return new Response(JSON.stringify(file, null, '\t'), {
		headers: {
			'content-type': 'application/json',
			'content-disposition': `attachment; filename="${name}.profile.json"`
		}
	});
}
