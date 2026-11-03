import { campaignsOnDisk, getDb } from '#lib/server/app.ts';
import { campaignRows } from '#lib/server/campaigns.ts';
import {
	activeProfile,
	campaignsOf,
	profiles,
	viewedCampaign,
	viewedMultiplayer
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
		campaign: viewedCampaign(db),
		multiplayer: viewedMultiplayer(db),
		campaigns: campaignsOf(db),
		games: campaignRows(db, campaignsOnDisk())
	};
}
