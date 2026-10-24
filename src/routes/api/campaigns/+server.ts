import { error, json } from '@sveltejs/kit';
import { getDb } from '#lib/server/app.ts';
import { keepCampaign } from '#lib/server/campaigns.ts';
import { deleteCampaign } from '#lib/server/db.ts';

// Cleaning up: `{ action: 'keep', campaign }` (a campaign whose saves are gone stays, and is not
// asked about again), `{ action: 'delete', campaign }` (its history is forgotten).
export async function POST({ request }) {
	const b = await request.json().catch(() => error(400, 'not JSON'));
	if (typeof b?.campaign !== 'string') error(400, 'malformed request');
	const db = getDb();
	if (b.action === 'keep') keepCampaign(db, b.campaign);
	else if (b.action === 'delete') deleteCampaign(db, b.campaign);
	else error(400, 'unknown action');
	return json({ campaign: b.campaign });
}
