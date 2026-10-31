import {
	campaignsOnDisk,
	dataVersion,
	getDb,
	lastDataDate,
	pendingLoad,
	refreshCampaign,
	status,
	unsupportedFeed
} from '#lib/server/app.ts';
import { FEED_FORMATS } from '#lib/server/feed.ts';
import { askGone } from '#lib/server/campaigns.ts';
import { campaignName, headCampaign, headId, latestSaveDate, nodes } from '#lib/server/db.ts';
import {
	activeProfile,
	chartEvents,
	display,
	tabs,
	theme,
	viewedCampaign
} from '#lib/server/settings.ts';
import { campaignTips } from '#lib/timeline.ts';
import type { ChartEvents, CustomTab } from '#lib/settings.ts';

export function load() {
	// /setup runs before there is a DB: the layout then shows no tab bar
	if (status() !== 'running')
		return {
			setup: true,
			theme: 'system' as const,
			tabs: [] as CustomTab[],
			chartEvents: {} as ChartEvents,
			profile: { id: '', name: '' },
			campaigns: [],
			campaign: null,
			gone: [],
			tradeoffs: false,
			loaded: null,
			feed: null,
			head: null,
			gameVersion: null,
			dates: null
		};
	const db = getDb();
	const { id, name } = activeProfile(db);
	// the campaigns to switch between, each named after its empire
	const campaigns = campaignTips(nodes(db), headId(db)).map((c) => ({
		...c,
		name: campaignName(db, c.campaign) || c.campaign
	}));
	const campaign = viewedCampaign(db);
	// another campaign's saves are read again by a newer reader once it is viewed
	if (campaign !== null && campaign !== headCampaign(db)) refreshCampaign(campaign);
	// a save just loaded in game: shown at once if the player wants, else with the next save or month
	const load = pendingLoad();
	const loadedNode = load === null ? undefined : nodes(db).find((n) => n.id === load);
	return {
		setup: false,
		theme: theme(),
		tabs: tabs(),
		chartEvents: chartEvents(),
		profile: { id, name },
		campaigns,
		campaign,
		// campaigns whose saves are all gone: delete their history? asked once
		gone: askGone(db, campaignsOnDisk()),
		// the exploratory trade-offs tab, a display switch
		tradeoffs: display().tradeoffs,
		loaded: loadedNode ? { node: loadedNode.id, date: loadedNode.date } : null,
		// the companion mod writes a log format this build skips: which side to update
		feed: (() => {
			const f = unsupportedFeed();
			return f && { ...f, ...FEED_FORMATS };
		})(),
		// the save being played, so a page pinned to it keeps following the game
		head: headId(db),
		// the game build the data is from: an open beta shares its version with the release
		gameVersion: dataVersion(),
		// the game being played: its latest save, and its latest data (a save, month or daily tick)
		dates: (() => {
			const head = headId(db);
			const node = head === null ? undefined : nodes(db).find((n) => n.id === head);
			return node
				? {
						save: latestSaveDate(db, node.campaign),
						data: lastDataDate(node.date),
						at: Date.now() // ticks the page hears after this are newer
					}
				: null;
		})()
	};
}
