import { campaignsOnDisk, getDb } from '#lib/server/app.ts';
import { campaignRows } from '#lib/server/campaigns.ts';
import {
	activeProfile,
	campaignsOf,
	profiles,
	viewedCampaign,
	viewedNoCheats
} from '#lib/server/settings.ts';

// The config tab: profiles, display options and the games in the history.
export function load() {
	const db = getDb();
	const active = activeProfile(db);
	return {
		profiles: profiles(db),
		active: active.id,
		display: active.settings.display,
		quadrants: active.settings.quadrants,
		popWindow: active.settings.popWindow,
		campaign: viewedCampaign(db),
		noCheats: viewedNoCheats(db),
		campaigns: campaignsOf(db),
		games: campaignRows(db, campaignsOnDisk())
	};
}
