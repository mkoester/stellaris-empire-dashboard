import { campaignsOnDisk, getDb } from '#lib/server/app.ts';
import { campaignRows } from '#lib/server/campaigns.ts';
import { nodeParam } from '#lib/server/request.ts';
import {
	activeProfile,
	campaignsOf,
	campaignAt,
	profiles,
	viewedNoCheats
} from '#lib/server/settings.ts';

// The config tab: profiles, display options and the games in the history.
export function load({ url }) {
	const db = getDb();
	const active = activeProfile(db);
	return {
		profiles: profiles(db),
		active: active.id,
		display: active.settings.display,
		quadrants: active.settings.quadrants,
		popWindow: active.settings.popWindow,
		campaign: campaignAt(db, nodeParam(url)),
		noCheats: viewedNoCheats(db),
		campaigns: campaignsOf(db),
		games: campaignRows(db, campaignsOnDisk())
	};
}
