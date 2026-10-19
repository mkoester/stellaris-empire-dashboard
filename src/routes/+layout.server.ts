import { getDb } from '#lib/server/app.ts';
import { campaignName, headId, nodes } from '#lib/server/db.ts';
import { activeProfile, chartEvents, tabs, theme, viewedCampaign } from '#lib/server/settings.ts';
import { campaignTips } from '#lib/timeline.ts';

export function load() {
	const db = getDb();
	const { id, name } = activeProfile(db);
	// the campaigns to switch between, each named after its empire
	const campaigns = campaignTips(nodes(db), headId(db)).map((c) => ({
		...c,
		name: campaignName(db, c.campaign) || c.campaign
	}));
	return {
		theme: theme(),
		tabs: tabs(),
		chartEvents: chartEvents(),
		profile: { id, name },
		campaigns,
		campaign: viewedCampaign(db)
	};
}
