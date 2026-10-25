import { error, json } from '@sveltejs/kit';
import { getDb } from '#lib/server/app.ts';
import { dismiss } from '#lib/server/campaigns.ts';
import { viewedCampaign } from '#lib/server/settings.ts';

// `{ dismiss: <id> }`: a cooldown that ran out leaves the upcoming list of the viewed campaign
// (the page's `?node=`) until it runs out again.
export async function POST({ request }) {
	const b = await request.json().catch(() => error(400, 'not JSON'));
	if (typeof b?.dismiss !== 'string' || b.dismiss.length > 300) error(400, 'malformed request');
	const db = getDb();
	const campaign = viewedCampaign(db);
	if (!campaign) error(404, 'no campaign');
	dismiss(db, campaign, b.dismiss);
	return json({ dismissed: b.dismiss });
}
