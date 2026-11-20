import { campaignsOnDisk, getDb } from '#lib/server/app.ts';
import { campaignRows } from '#lib/server/campaigns.ts';
import { nodeParam } from '#lib/server/request.ts';
import {
	activeProfile,
	campaignsOf,
	campaignAt,
	profiles,
	updateHours,
	viewedNoCheats
} from '#lib/server/settings.ts';
import { updateState } from '#lib/server/updates.ts';
import { isRelease } from '#lib/updates.ts';

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
		incomeWindow: active.settings.incomeWindow,
		campaign: campaignAt(db, nodeParam(url)),
		noCheats: viewedNoCheats(db),
		campaigns: campaignsOf(db),
		games: campaignRows(db, campaignsOnDisk()),
		updates: { hours: updateHours(), release: isRelease(__APP_VERSION__), ...updateState() }
	};
}
