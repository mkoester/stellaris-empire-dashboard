import { getDb } from '#lib/server/app.ts';
import { headCampaign } from '#lib/server/db.ts';
import { activeProfile, campaignsOf, profiles } from '#lib/server/settings.ts';

// The config tab: profiles and display options.
export function load() {
	const db = getDb();
	const active = activeProfile(db);
	return {
		profiles: profiles(db),
		active: active.id,
		display: active.settings.display,
		campaign: headCampaign(db),
		campaigns: campaignsOf(db)
	};
}
