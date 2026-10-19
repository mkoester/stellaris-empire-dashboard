import { getDb } from '#lib/server/app.ts';
import { activeProfile, campaignsOf, profiles, viewedCampaign } from '#lib/server/settings.ts';

// The config tab: profiles and display options.
export function load() {
	const db = getDb();
	const active = activeProfile(db);
	return {
		profiles: profiles(db),
		active: active.id,
		display: active.settings.display,
		campaign: viewedCampaign(db),
		campaigns: campaignsOf(db)
	};
}
