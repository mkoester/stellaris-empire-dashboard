import { error, json } from '@sveltejs/kit';
import { importFile } from '#lib/profiles.ts';
import { getDb } from '#lib/server/app.ts';
import { profileAction } from '#lib/server/settings.ts';

// Profiles: `{ action: 'create', name, copyOf? }`, `{ action: 'rename', id, name }`,
// `{ action: 'delete', id }`, `{ action: 'select', id }`, `{ action: 'import', file }` (an
// exported profile). Answers with the id acted on.
export async function POST({ request }) {
	const b = await request.json().catch(() => error(400, 'not JSON'));
	const str = (v: unknown) => (typeof v === 'string' ? v : error(400, 'malformed request'));
	const db = getDb();
	let id: string | null;
	switch (b?.action) {
		case 'create':
			id = profileAction(db, {
				action: 'create',
				name: str(b.name),
				copyOf: b.copyOf === undefined ? undefined : str(b.copyOf)
			});
			break;
		case 'rename':
			id = profileAction(db, { action: 'rename', id: str(b.id), name: str(b.name) });
			break;
		case 'delete':
		case 'select':
			id = profileAction(db, { action: b.action, id: str(b.id) });
			break;
		case 'import': {
			const file = importFile(b.file);
			if (!file) error(400, 'not an exported dashboard profile');
			id = profileAction(db, { action: 'import', ...file });
			break;
		}
		default:
			error(400, 'unknown action');
	}
	if (id === null) error(409, 'not possible: unknown profile, or the last one');
	return json({ id });
}
